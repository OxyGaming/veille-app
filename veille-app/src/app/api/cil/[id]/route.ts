import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent, loadIncidentFull, serializeIncident } from "@/lib/cil/repo";
import { ETABLISSEMENTS, GARE_MODES } from "@/lib/cil/types";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const row = await loadIncidentFull(id);
  if (!row) return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, row.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.json(serializeIncident(row));
}

const headerSchema = z.object({
  action: z.literal("update"),
  lieu: z.string().trim().min(1).max(200).optional(),
  poste: z.string().trim().max(120).nullable().optional(),
  voie: z.string().trim().max(60).nullable().optional(),
  observations: z.string().trim().max(2000).nullable().optional(),
  gareMode: z.enum(GARE_MODES).nullable().optional(),
  gareUnique: z.string().trim().max(120).nullable().optional(),
  gareA: z.string().trim().max(120).nullable().optional(),
  gareB: z.string().trim().max(120).nullable().optional(),
  voies: z.string().trim().max(120).nullable().optional(),
  km: z.string().trim().max(60).nullable().optional(),
  acLabel: z.string().trim().max(120).nullable().optional(),
  motif: z.string().trim().max(300).nullable().optional(),
  typeLibre: z.string().trim().max(120).nullable().optional(),
  cilNom: z.string().trim().max(120).nullable().optional(),
  cilPrenom: z.string().trim().max(120).nullable().optional(),
  cilEtablissement: z.enum(ETABLISSEMENTS).nullable().optional(),
  designatedAt: z.string().datetime().nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});
const arrivalSchema = z.object({
  action: z.literal("arrival"),
  at: z.string().datetime(),
});
const closeSchema = z.object({
  action: z.literal("close"),
  at: z.string().datetime(),
});
const reopenSchema = z.object({ action: z.literal("reopen") });
const patchSchema = z.discriminatedUnion("action", [
  headerSchema,
  arrivalSchema,
  closeSchema,
  reopenSchema,
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const existing = await prisma.cilIncident.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Réouverture — seule action autorisée sur un incident CLOSED, EDITOR/ADMIN.
  if (data.action === "reopen") {
    if (existing.status !== "CLOSED") {
      return NextResponse.json({ error: "Incident déjà ouvert." }, { status: 409 });
    }
    if (u.role !== "EDITOR" && u.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Réouverture réservée aux éditeurs/administrateurs." },
        { status: 403 },
      );
    }
    await prisma.cilIncident.update({
      where: { id },
      data: { status: "OPEN", closedAt: null },
    });
    const row = await loadIncidentFull(id);
    return NextResponse.json(serializeIncident(row!));
  }

  // Invariant dur : aucune écriture sur un incident CLOSED.
  if (existing.status === "CLOSED") {
    return NextResponse.json(
      { error: "Incident clôturé, lecture seule." },
      { status: 409 },
    );
  }

  if (data.action === "arrival") {
    const at = new Date(data.at);
    await prisma.$transaction(async (tx) => {
      await tx.cilIncident.update({
        where: { id },
        data: { arrivedOnSiteAt: at },
      });
      await createEvent(tx, {
        incidentId: id,
        type: "ARRIVAL_ON_SITE",
        occurredAt: at,
        label: "Arrivée sur site — responsabilité des protections transférée au CIL",
        actorId: u.id,
        actorName: u.name,
      });
    });
  } else if (data.action === "close") {
    const at = new Date(data.at);
    await prisma.$transaction(async (tx) => {
      await tx.cilIncident.update({
        where: { id },
        data: { status: "CLOSED", closedAt: at },
      });
      await createEvent(tx, {
        incidentId: id,
        type: "CLOSURE",
        occurredAt: at,
        label: "Clôture de l'incident",
        actorId: u.id,
        actorName: u.name,
      });
    });
  } else {
    // Mise à jour d'en-tête (autosave).
    await prisma.cilIncident.update({
      where: { id },
      data: {
        ...(data.lieu !== undefined ? { lieu: data.lieu } : {}),
        ...(data.poste !== undefined ? { poste: data.poste } : {}),
        ...(data.voie !== undefined ? { voie: data.voie } : {}),
        ...(data.observations !== undefined ? { observations: data.observations } : {}),
        ...(data.gareMode !== undefined ? { gareMode: data.gareMode } : {}),
        ...(data.gareUnique !== undefined ? { gareUnique: data.gareUnique } : {}),
        ...(data.gareA !== undefined ? { gareA: data.gareA } : {}),
        ...(data.gareB !== undefined ? { gareB: data.gareB } : {}),
        ...(data.voies !== undefined ? { voies: data.voies } : {}),
        ...(data.km !== undefined ? { km: data.km } : {}),
        ...(data.acLabel !== undefined ? { acLabel: data.acLabel } : {}),
        ...(data.motif !== undefined ? { motif: data.motif } : {}),
        ...(data.typeLibre !== undefined ? { typeLibre: data.typeLibre } : {}),
        ...(data.cilNom !== undefined ? { cilNom: data.cilNom } : {}),
        ...(data.cilPrenom !== undefined ? { cilPrenom: data.cilPrenom } : {}),
        ...(data.cilEtablissement !== undefined
          ? { cilEtablissement: data.cilEtablissement }
          : {}),
        ...(data.designatedAt !== undefined
          ? { designatedAt: data.designatedAt ? new Date(data.designatedAt) : null }
          : {}),
        ...(data.occurredAt !== undefined
          ? { occurredAt: new Date(data.occurredAt) }
          : {}),
      },
    });
  }

  const row = await loadIncidentFull(id);
  return NextResponse.json(serializeIncident(row!));
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const existing = await prisma.cilIncident.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (existing.status === "CLOSED") {
    return NextResponse.json(
      { error: "Incident clôturé, suppression interdite." },
      { status: 409 },
    );
  }
  await prisma.cilIncident.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
