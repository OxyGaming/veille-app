import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent } from "@/lib/cil/repo";

/**
 * Événements de frise « simples » (sans entité métier dédiée) :
 * MISSION_CIL, CHANGEMENT_CIL, NOTE. Les dépêches / intervenants passent par
 * leurs routes propres (qui créent aussi leur événement).
 */
const SIMPLE_EVENT_TYPES = ["MISSION_CIL", "CHANGEMENT_CIL", "NOTE"] as const;

const bodySchema = z.object({
  type: z.enum(SIMPLE_EVENT_TYPES),
  occurredAt: z.string().datetime(),
  label: z.string().trim().max(300).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  /** Changement de CIL : nom du remplaçant (repris dans le label). */
  remplacant: z.string().trim().max(160).nullable().optional(),
});

const DEFAULT_LABEL: Record<(typeof SIMPLE_EVENT_TYPES)[number], string> = {
  MISSION_CIL: "Mission CIL",
  CHANGEMENT_CIL: "Changement de CIL",
  NOTE: "Note",
};

export async function POST(
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
  const incident = await prisma.cilIncident.findUnique({ where: { id } });
  if (!incident)
    return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;
  let label = p.label || DEFAULT_LABEL[p.type];
  if (p.type === "CHANGEMENT_CIL" && p.remplacant) {
    label = `Changement de CIL — remplacé par ${p.remplacant}`;
  }

  const event = await prisma.$transaction((tx) =>
    createEvent(tx, {
      incidentId: id,
      type: p.type,
      occurredAt: new Date(p.occurredAt),
      label,
      note: p.note ?? null,
      actorId: u.id,
      actorName: u.name,
      metadata: p.remplacant ? { remplacant: p.remplacant } : null,
    }),
  );
  return NextResponse.json({ id: event.id });
}
