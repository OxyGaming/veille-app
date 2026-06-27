import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

const schema = z.object({
  description: z.string().min(1).max(500).optional(),
  riskIdentified: z.string().nullable().optional(),
  evrpCotation: z.string().nullable().optional(),
  proposedMeasures: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  plannedDate: z.string().datetime().nullable().optional(),
  redressedDate: z.string().datetime().nullable().optional(),
  closedDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; ncId: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: visitId, ncId } = await ctx.params;
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, ...teamScope(u) },
    select: { id: true },
  });
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Cloisonnement : la NC doit appartenir à la visite scopée. Sans cette
  // corrélation, un `ncId` d'une visite d'une autre équipe pourrait être muté
  // (IDOR) via un `visitId` que l'on possède.
  const nc = await prisma.siteVisitNonConformity.findFirst({
    where: { id: ncId, visitId },
    select: { id: true },
  });
  if (!nc) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

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
  const updated = await prisma.siteVisitNonConformity.update({
    where: { id: ncId },
    data: {
      description: parsed.data.description,
      riskIdentified:
        parsed.data.riskIdentified === undefined
          ? undefined
          : parsed.data.riskIdentified,
      evrpCotation:
        parsed.data.evrpCotation === undefined
          ? undefined
          : parsed.data.evrpCotation,
      proposedMeasures:
        parsed.data.proposedMeasures === undefined
          ? undefined
          : parsed.data.proposedMeasures,
      responsible:
        parsed.data.responsible === undefined
          ? undefined
          : parsed.data.responsible,
      plannedDate:
        parsed.data.plannedDate === undefined
          ? undefined
          : parsed.data.plannedDate
          ? new Date(parsed.data.plannedDate)
          : null,
      redressedDate:
        parsed.data.redressedDate === undefined
          ? undefined
          : parsed.data.redressedDate
          ? new Date(parsed.data.redressedDate)
          : null,
      closedDate:
        parsed.data.closedDate === undefined
          ? undefined
          : parsed.data.closedDate
          ? new Date(parsed.data.closedDate)
          : null,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; ncId: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: visitId, ncId } = await ctx.params;
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, ...teamScope(u) },
    select: { id: true },
  });
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : la NC doit appartenir à la visite scopée (corrélation
  // ncId + visitId) — empêche la suppression d'une NC d'une autre équipe.
  const nc = await prisma.siteVisitNonConformity.findFirst({
    where: { id: ncId, visitId },
  });
  if (!nc) return NextResponse.json({ ok: true });
  // Si une action a été générée, on la marque OBSOLETE plutôt que la supprimer
  // (préservation de l'historique cf. règle métier actions).
  await prisma.$transaction(async (tx) => {
    if (nc.generatedActionId) {
      await tx.importedAction.update({
        where: { id: nc.generatedActionId },
        data: { localStatus: "OBSOLETE" },
      });
    }
    await tx.siteVisitNonConformity.delete({ where: { id: ncId } });
  });
  return NextResponse.json({ ok: true });
}
