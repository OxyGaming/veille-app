import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent } from "@/lib/cil/repo";
import { INTERVENANT_TYPES, INTERVENANT_TYPE_LABELS } from "@/lib/cil/types";

const bodySchema = z.object({
  type: z.enum(INTERVENANT_TYPES),
  typeLibre: z.string().trim().max(120).nullable().optional(),
  nom: z.string().trim().max(160).nullable().optional(),
  tel: z.string().trim().max(40).nullable().optional(),
  arrivedAt: z.string().datetime().nullable().optional(),
  departedAt: z.string().datetime().nullable().optional(),
});

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

  // Règle métier : l'heure de départ des Pompes Funèbres est obligatoire.
  if (p.type === "POMPES_FUNEBRES" && !p.departedAt) {
    return NextResponse.json(
      { error: "L'heure de départ est obligatoire pour les Pompes Funèbres." },
      { status: 400 },
    );
  }

  const arrivedAt = p.arrivedAt ? new Date(p.arrivedAt) : null;
  const departedAt = p.departedAt ? new Date(p.departedAt) : null;
  const label = INTERVENANT_TYPE_LABELS[p.type];
  const who = p.nom?.trim() || (p.type === "AUTRE" ? p.typeLibre ?? "" : "");

  const created = await prisma.$transaction(async (tx) => {
    const it = await tx.cilIntervenant.create({
      data: {
        incidentId: id,
        type: p.type,
        typeLibre: p.typeLibre ?? null,
        nom: p.nom ?? null,
        tel: p.tel ?? null,
        arrivedAt,
        departedAt,
      },
    });
    if (arrivedAt) {
      await createEvent(tx, {
        incidentId: id,
        type: "INTERVENANT_ARRIVAL",
        occurredAt: arrivedAt,
        label: `Arrivée ${label}${who ? ` — ${who}` : ""}`,
        actorId: u.id,
        actorName: u.name,
        refType: "INTERVENANT",
        refId: it.id,
      });
    }
    if (departedAt) {
      await createEvent(tx, {
        incidentId: id,
        type: "INTERVENANT_DEPARTURE",
        occurredAt: departedAt,
        label: `Départ ${label}${who ? ` — ${who}` : ""}`,
        actorId: u.id,
        actorName: u.name,
        refType: "INTERVENANT",
        refId: it.id,
      });
    }
    return it;
  });

  return NextResponse.json({ id: created.id });
}
