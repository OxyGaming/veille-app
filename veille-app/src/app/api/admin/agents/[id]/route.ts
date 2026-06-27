import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnAnyTeam, canActOnTeam, requireRole } from "@/lib/auth";

const schema = z.object({
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  /** Liste complète des teamIds — remplace l'appartenance actuelle. */
  teamIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireRole("ADMIN");
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

  const existing = await prisma.agent.findUnique({
    where: { id },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Cloisonnement : l'acteur doit partager une équipe avec l'agent.
  const existingTeams = [
    existing.teamId,
    ...existing.memberships.map((m) => m.teamId),
  ];
  if (!canActOnAnyTeam(u, existingTeams)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }
  // Tout rattachement ajouté/retiré doit rester dans son périmètre.
  if (parsed.data.teamIds) {
    const wanted = new Set(parsed.data.teamIds);
    const currentSet = new Set(existingTeams.filter((t): t is string => !!t));
    const touched = [
      ...parsed.data.teamIds.filter((t) => !currentSet.has(t)),
      ...[...currentSet].filter((t) => !wanted.has(t)),
    ];
    if (touched.some((t) => !canActOnTeam(u, t))) {
      return NextResponse.json(
        { error: "Modification d'un rattachement d'équipe hors de votre périmètre." },
        { status: 403 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (
      parsed.data.isVisible !== undefined ||
      parsed.data.isActive !== undefined
    ) {
      await tx.agent.update({
        where: { id },
        data: {
          isVisible: parsed.data.isVisible,
          isActive: parsed.data.isActive,
        },
      });
    }
    if (parsed.data.teamIds) {
      const wanted = new Set(parsed.data.teamIds);
      const current = await tx.agentTeam.findMany({ where: { agentId: id } });
      const currentIds = new Set(current.map((m) => m.teamId));
      const toAdd = [...wanted].filter((t) => !currentIds.has(t));
      const toRemove = current.filter((m) => !wanted.has(m.teamId));
      if (toRemove.length) {
        await tx.agentTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
      }
      for (const teamId of toAdd) {
        await tx.agentTeam.create({ data: { agentId: id, teamId } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

/**
 * Suppression d'un agent.
 *  - ?mode=soft (défaut) : isActive=false + isVisible=false (ne touche pas à
 *    l'historique). Permet d'archiver un agent qui a quitté.
 *  - ?mode=hard : suppression définitive uniquement si aucune trace
 *    opérationnelle (session, sighting, action importée, validation).
 *    Sinon 409 avec compteurs.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!agent) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : un ADMIN scopé ne supprime que les agents de son périmètre.
  if (
    !canActOnAnyTeam(u, [
      agent.teamId,
      ...agent.memberships.map((m) => m.teamId),
    ])
  ) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }

  if (mode === "soft") {
    await prisma.agent.update({
      where: { id },
      data: { isActive: false, isVisible: false },
    });
    return NextResponse.json({ ok: true });
  }

  const [sessions, sightings, actions, validations] = await Promise.all([
    prisma.veilleSession.count({ where: { agentId: id } }),
    prisma.agentSighting.count({ where: { agentId: id } }),
    prisma.importedAction.count({ where: { agentId: id } }),
    prisma.actionValidation.count({ where: { agentId: id } }),
  ]);
  const counts = { sessions, sightings, actions, validations };
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonEmpty.length > 0) {
    const detail = nonEmpty.map(([k, n]) => `${n} ${k}`).join(", ");
    return NextResponse.json(
      {
        error: `Suppression refusée — l'agent a des données rattachées (${detail}). Désactivez-le plutôt.`,
        counts,
      },
      { status: 409 }
    );
  }
  await prisma.$transaction([
    prisma.agentTeam.deleteMany({ where: { agentId: id } }),
    prisma.userAgentHidden.deleteMany({ where: { agentId: id } }),
    prisma.agent.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deleted: `${agent.lastName} ${agent.firstName}` });
}
