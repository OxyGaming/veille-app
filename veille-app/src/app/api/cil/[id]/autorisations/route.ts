import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent } from "@/lib/cil/repo";
import { DEPECHE_SUBTYPE_LABELS, type DepecheSubtype } from "@/lib/cil/types";

/**
 * Autorisations recueillies AVANT la dépêche de reprise / rétablissement.
 *
 * Chaque autorité est enregistrée séparément dès que son accord est obtenu :
 * le CIL peut prendre celui du COS maintenant et revenir plus tard pour l'OPJ.
 * L'upsert permet de corriger une saisie (nouvelle heure / nouvelle signature)
 * sans créer de doublon.
 */
const REPRISE_SUBTYPES = [
  "REPRISE_PARTIELLE",
  "REPRISE_NORMALE",
  "RETABLISSEMENT_PARTIEL",
  "RETABLISSEMENT_NORMAL",
] as const;

const bodySchema = z.object({
  subtype: z.enum(REPRISE_SUBTYPES),
  role: z.enum(["COS", "OPJ"]),
  grantedAt: z.string().datetime(),
  signerName: z.string().trim().max(160).nullable().optional(),
  imageB64: z.string().min(1).max(500_000),
});

async function loadIncident(id: string) {
  return prisma.cilIncident.findUnique({
    where: { id },
    select: { id: true, teamId: true, status: true },
  });
}

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
  const incident = await loadIncident(id);
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
  const grantedAt = new Date(p.grantedAt);

  const created = await prisma.$transaction(async (tx) => {
    const autorisation = await tx.cilAutorisation.upsert({
      where: {
        incidentId_subtype_role: {
          incidentId: id,
          subtype: p.subtype,
          role: p.role,
        },
      },
      create: {
        incidentId: id,
        subtype: p.subtype,
        role: p.role,
        grantedAt,
        signerName: p.signerName ?? null,
        imageB64: p.imageB64,
      },
      update: {
        grantedAt,
        signerName: p.signerName ?? null,
        imageB64: p.imageB64,
      },
    });
    // Trace dans la chronologie : l'accord d'une autorité est un fait daté.
    await createEvent(tx, {
      incidentId: id,
      type: "NOTE",
      occurredAt: grantedAt,
      label: `Autorisation du ${p.role} recueillie — ${DEPECHE_SUBTYPE_LABELS[p.subtype as DepecheSubtype]}`,
      actorId: u.id,
      actorName: u.name,
    });
    return autorisation;
  });

  return NextResponse.json({ id: created.id });
}

/** Retire une autorisation (erreur de saisie, autorité finalement absente…). */
export async function DELETE(
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
  const incident = await loadIncident(id);
  if (!incident)
    return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
  }
  const url = new URL(req.url);
  const subtype = url.searchParams.get("subtype");
  const role = url.searchParams.get("role");
  if (!subtype || !role) {
    return NextResponse.json(
      { error: "Paramètres `subtype` et `role` requis." },
      { status: 400 },
    );
  }
  await prisma.cilAutorisation.deleteMany({
    where: { incidentId: id, subtype, role },
  });
  return NextResponse.json({ ok: true });
}
