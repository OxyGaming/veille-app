import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent } from "@/lib/cil/repo";
import { INTERVENANT_TYPE_LABELS, type IntervenantType } from "@/lib/cil/types";

const patchSchema = z.object({
  nom: z.string().trim().max(160).nullable().optional(),
  tel: z.string().trim().max(40).nullable().optional(),
  arrivedAt: z.string().datetime().nullable().optional(),
  departedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; intId: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id, intId } = await ctx.params;
  const it = await prisma.cilIntervenant.findUnique({
    where: { id: intId },
    include: { incident: { select: { teamId: true, status: true } } },
  });
  if (!it || it.incidentId !== id) {
    return NextResponse.json({ error: "Intervenant inconnu" }, { status: 404 });
  }
  if (!assertTeamAccess(u, it.incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (it.incident.status === "CLOSED") {
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
  const label = INTERVENANT_TYPE_LABELS[it.type as IntervenantType];
  const who = p.nom?.trim() || it.nom?.trim() || "";
  // Nouveaux horodatages posés pour la 1ʳᵉ fois → créent l'événement de frise.
  const settingArrival =
    p.arrivedAt !== undefined && p.arrivedAt && !it.arrivedAt;
  const settingDeparture =
    p.departedAt !== undefined && p.departedAt && !it.departedAt;

  await prisma.$transaction(async (tx) => {
    await tx.cilIntervenant.update({
      where: { id: intId },
      data: {
        ...(p.nom !== undefined ? { nom: p.nom } : {}),
        ...(p.tel !== undefined ? { tel: p.tel } : {}),
        ...(p.arrivedAt !== undefined
          ? { arrivedAt: p.arrivedAt ? new Date(p.arrivedAt) : null }
          : {}),
        ...(p.departedAt !== undefined
          ? { departedAt: p.departedAt ? new Date(p.departedAt) : null }
          : {}),
      },
    });
    if (settingArrival) {
      await createEvent(tx, {
        incidentId: id,
        type: "INTERVENANT_ARRIVAL",
        occurredAt: new Date(p.arrivedAt!),
        label: `Arrivée ${label}${who ? ` — ${who}` : ""}`,
        actorId: u.id,
        actorName: u.name,
        refType: "INTERVENANT",
        refId: intId,
      });
    }
    if (settingDeparture) {
      await createEvent(tx, {
        incidentId: id,
        type: "INTERVENANT_DEPARTURE",
        occurredAt: new Date(p.departedAt!),
        label: `Départ ${label}${who ? ` — ${who}` : ""}`,
        actorId: u.id,
        actorName: u.name,
        refType: "INTERVENANT",
        refId: intId,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
