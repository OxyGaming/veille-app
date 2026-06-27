import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnTeam, requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
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
  // Cloisonnement : un ADMIN scopé ne modifie que ses propres équipes.
  if (!canActOnTeam(actor, id)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }
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
  const updated = await prisma.team.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

/**
 * Suppression d'une équipe.
 *  - ?mode=soft (défaut) : isActive=false (utile pour archiver une équipe
 *    dissoute sans perdre l'historique).
 *  - ?mode=hard : suppression définitive si aucun objet n'a cette équipe comme
 *    référence principale. Refus sinon.
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
  // Cloisonnement : un ADMIN scopé ne supprime/archive que ses propres équipes.
  if (!canActOnTeam(actor, id)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  if (mode === "soft") {
    await prisma.team.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  const [
    users,
    agentsPrimary,
    sitesPrimary,
    sessions,
    visits,
    actions,
    validations,
    agentSightings,
    siteSightings,
  ] = await Promise.all([
    prisma.user.count({ where: { teamId: id } }),
    prisma.agent.count({ where: { teamId: id } }),
    prisma.site.count({ where: { teamId: id } }),
    prisma.veilleSession.count({ where: { teamId: id } }),
    prisma.siteVisit.count({ where: { teamId: id } }),
    prisma.importedAction.count({ where: { teamId: id } }),
    prisma.actionValidation.count({ where: { teamId: id } }),
    prisma.agentSighting.count({ where: { teamId: id } }),
    prisma.siteSighting.count({ where: { teamId: id } }),
  ]);
  const counts = {
    users,
    agentsPrimary,
    sitesPrimary,
    sessions,
    visits,
    actions,
    validations,
    agentSightings,
    siteSightings,
  };
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonEmpty.length > 0) {
    const detail = nonEmpty.map(([k, n]) => `${n} ${k}`).join(", ");
    return NextResponse.json(
      {
        error: `Suppression refusée — l'équipe a des références (${detail}). Désactivez-la plutôt.`,
        counts,
      },
      { status: 409 }
    );
  }
  await prisma.$transaction([
    prisma.userTeam.deleteMany({ where: { teamId: id } }),
    prisma.agentTeam.deleteMany({ where: { teamId: id } }),
    prisma.siteTeam.deleteMany({ where: { teamId: id } }),
    prisma.team.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deleted: team.name });
}
