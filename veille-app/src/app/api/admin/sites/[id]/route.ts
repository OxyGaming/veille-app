import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnAnyTeam, canActOnTeam, requireRole } from "@/lib/auth";

/**
 * Audit non bloquant des mutations d'équipes sur un site. Trace
 * pour le futur centre de notifications (cf. memory/business-rules.md
 * §Notifications) — à brancher quand le flux d'événements TeamActivity
 * sera consommé.
 */
async function logSiteTeamChange(
  userId: string,
  userEmail: string | null,
  action: "SITE_TEAM_ADDED" | "SITE_TEAM_REMOVED",
  siteId: string,
  teamId: string,
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId,
        userEmail,
        action,
        entity: "SiteTeam",
        entityId: siteId,
        details: JSON.stringify({ siteId, teamId }),
      },
    })
    .catch(() => null);
}

const schema = z.object({
  name: z.string().min(1).max(160).optional(),
  code: z.string().max(40).optional().nullable(),
  type: z.string().max(80).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  hasGreasingArea: z.boolean().optional(),
  isOccupied: z.boolean().optional(),
  teamIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let actor;
  try {
    actor = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const existing = await prisma.site.findUnique({
    where: { id },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Cloisonnement : l'acteur doit partager une équipe avec le site existant.
  const existingTeams = [
    existing.teamId,
    ...existing.memberships.map((m) => m.teamId),
  ];
  if (!canActOnAnyTeam(actor, existingTeams)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }
  // …et toute équipe ajoutée/retirée doit appartenir à son périmètre (pas de
  // rattachement/détachement d'une équipe tierce sur un site partagé).
  if (parsed.data.teamIds) {
    const wanted = new Set(parsed.data.teamIds);
    const currentSet = new Set(existingTeams.filter((t): t is string => !!t));
    const touched = [
      ...parsed.data.teamIds.filter((t) => !currentSet.has(t)), // ajoutées
      ...[...currentSet].filter((t) => !wanted.has(t)), // retirées
    ];
    const touchedOutOfScope = touched.filter((t) => !canActOnTeam(actor, t));
    if (touchedOutOfScope.length > 0) {
      return NextResponse.json(
        { error: "Modification d'un rattachement d'équipe hors de votre périmètre." },
        { status: 403 }
      );
    }
  }

  // Règle métier : un site doit toujours appartenir à au moins une équipe.
  // Cohérent avec memory/business-rules.md §Sites et le scope multi-team.
  if (parsed.data.teamIds && parsed.data.teamIds.length === 0) {
    return NextResponse.json(
      { error: "Au moins une équipe est requise pour un site." },
      { status: 400 },
    );
  }

  const auditDiff: { added: string[]; removed: string[] } = {
    added: [],
    removed: [],
  };

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code === undefined ? undefined : parsed.data.code,
        type: parsed.data.type === undefined ? undefined : parsed.data.type,
        address:
          parsed.data.address === undefined ? undefined : parsed.data.address,
        description:
          parsed.data.description === undefined
            ? undefined
            : parsed.data.description,
        isVisible: parsed.data.isVisible,
        isActive: parsed.data.isActive,
        hasGreasingArea: parsed.data.hasGreasingArea,
        isOccupied: parsed.data.isOccupied,
      },
    });
    if (parsed.data.teamIds) {
      const wanted = new Set(parsed.data.teamIds);
      const current = await tx.siteTeam.findMany({ where: { siteId: id } });
      const currentIds = new Set(current.map((m) => m.teamId));
      const toRemove = current.filter((m) => !wanted.has(m.teamId));
      const toAdd = [...wanted].filter((t) => !currentIds.has(t));
      if (toRemove.length) {
        await tx.siteTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
        auditDiff.removed = toRemove.map((m) => m.teamId);
      }
      for (const teamId of toAdd) {
        await tx.siteTeam.create({ data: { siteId: id, teamId } });
      }
      auditDiff.added = toAdd;
      // Si la team principale (legacy Site.teamId) a été retirée, on la
      // remplace par la première équipe restante pour éviter une référence
      // pendante vers une équipe non liée.
      if (
        existing.teamId &&
        !wanted.has(existing.teamId) &&
        wanted.size > 0
      ) {
        await tx.site.update({
          where: { id },
          data: { teamId: [...wanted][0] },
        });
      }
    }
  });
  // Audit hors transaction (non bloquant).
  for (const teamId of auditDiff.added) {
    await logSiteTeamChange(actor.id, actor.email, "SITE_TEAM_ADDED", id, teamId);
  }
  for (const teamId of auditDiff.removed) {
    await logSiteTeamChange(actor.id, actor.email, "SITE_TEAM_REMOVED", id, teamId);
  }
  return NextResponse.json({ ok: true });
}

/**
 * Suppression d'un site.
 *  - ?mode=soft (défaut) : alias de PATCH isActive=false (le site disparaît
 *    des listes mais l'historique reste).
 *  - ?mode=hard : suppression définitive uniquement si aucune trace
 *    opérationnelle (visite, action, validation, sighting). Sinon 409.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let actor;
  try {
    actor = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const site = await prisma.site.findUnique({
    where: { id },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!site) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : un ADMIN scopé ne supprime que les sites de son périmètre.
  if (
    !canActOnAnyTeam(actor, [
      site.teamId,
      ...site.memberships.map((m) => m.teamId),
    ])
  ) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }

  if (mode === "soft") {
    await prisma.site.update({
      where: { id },
      data: { isActive: false, isVisible: false },
    });
    return NextResponse.json({ ok: true });
  }

  // === Mode hard ===
  const [visits, actions, validations, sightings] = await Promise.all([
    prisma.siteVisit.count({ where: { siteId: id } }),
    prisma.importedAction.count({ where: { siteId: id } }),
    prisma.actionValidation.count({ where: { siteId: id } }),
    prisma.siteSighting.count({ where: { siteId: id } }),
  ]);
  const counts: Record<string, number> = {
    visits,
    actions,
    validations,
    sightings,
  };
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonEmpty.length > 0) {
    const detail = nonEmpty.map(([k, n]) => `${n} ${k}`).join(", ");
    return NextResponse.json(
      {
        error: `Suppression refusée — le site a des données rattachées (${detail}). Désactivez-le plutôt.`,
        counts,
      },
      { status: 409 }
    );
  }
  // Aucune trace : on supprime memberships puis site.
  await prisma.$transaction([
    prisma.siteTeam.deleteMany({ where: { siteId: id } }),
    prisma.site.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deleted: site.name });
}
