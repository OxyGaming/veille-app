import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";

/**
 * Correction d'un événement de frise (point 10) : modifier l'heure, le libellé
 * ou la note. Suppression réservée aux notes (les événements structurels
 * restent la trace de la chronologie).
 */
const patchSchema = z.object({
  occurredAt: z.string().datetime().optional(),
  label: z.string().trim().min(1).max(300).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  /**
   * Clés de `metadata` à FUSIONNER (les autres sont conservées) : sert à
   * horodater les avis d'un changement de CIL (`avis_ac`, `avis_crc`, …).
   */
  metadata: z.record(z.string().max(40), z.string().max(200)).optional(),
});

async function loadEvent(id: string, eventId: string) {
  const e = await prisma.cilEvent.findUnique({
    where: { id: eventId },
    include: { incident: { select: { teamId: true, status: true } } },
  });
  if (!e || e.incidentId !== id) return null;
  return e;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; eventId: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id, eventId } = await ctx.params;
  const e = await loadEvent(id, eventId);
  if (!e) return NextResponse.json({ error: "Événement inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, e.incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (e.incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
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
  const p = parsed.data;
  // Fusion (et non remplacement) du metadata : chaque avis est horodaté au fil
  // de l'eau sans écraser les précédents.
  let mergedMetadata: string | undefined;
  if (p.metadata) {
    let current: Record<string, unknown> = {};
    try {
      const parsedMeta = e.metadata ? JSON.parse(e.metadata) : null;
      if (parsedMeta && typeof parsedMeta === "object") current = parsedMeta;
    } catch {
      // metadata illisible → on repart d'un objet vide plutôt que d'échouer
    }
    mergedMetadata = JSON.stringify({ ...current, ...p.metadata });
  }
  await prisma.cilEvent.update({
    where: { id: eventId },
    data: {
      ...(p.occurredAt !== undefined ? { occurredAt: new Date(p.occurredAt) } : {}),
      ...(p.label !== undefined ? { label: p.label } : {}),
      ...(p.note !== undefined ? { note: p.note } : {}),
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; eventId: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id, eventId } = await ctx.params;
  const e = await loadEvent(id, eventId);
  if (!e) return NextResponse.json({ error: "Événement inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, e.incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (e.incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
  }
  // Seules les notes libres sont supprimables (intégrité de la chronologie).
  if (e.type !== "NOTE") {
    return NextResponse.json(
      { error: "Seules les notes peuvent être supprimées." },
      { status: 409 },
    );
  }
  await prisma.cilEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
