import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent, usedNumbers } from "@/lib/cil/repo";
import { randomNumberForSubtype, rangeForSubtype } from "@/lib/cil/numbering";
import { missingRequirementsMessage, repriseAllowed } from "@/lib/cil/machine";
import {
  DEPECHE_SENS,
  DEPECHE_SUBTYPES,
  DEPECHE_SUBTYPE_LABELS,
  REPRISE_AUTHORIZATIONS,
  type CilEventType,
  type DepecheSubtype,
} from "@/lib/cil/types";

/** Type d'événement de frise associé à un sous-type de dépêche. */
function eventTypeForSubtype(subtype: DepecheSubtype): CilEventType {
  switch (subtype) {
    case "REPRISE_PARTIELLE":
      return "REPRISE_PARTIELLE_CIRCULATION";
    case "REPRISE_NORMALE":
      return "REPRISE_CIRCULATION";
    case "RETABLISSEMENT_PARTIEL":
      return "RETABLISSEMENT_PARTIEL_TENSION";
    case "RETABLISSEMENT_NORMAL":
      return "RETABLISSEMENT_TENSION";
    default:
      return "DEPECHE";
  }
}

const geometrySchema = z
  .object({
    voies: z.string().optional(),
    km: z.string().optional(),
    gareA: z.string().optional(),
    gareB: z.string().optional(),
    gareUnique: z.string().optional(),
    motif: z.string().optional(),
    marcheInterdite: z.string().optional(),
    marchePrudente: z.string().optional(),
    marcheNormale: z.string().optional(),
  })
  .optional();

const bodySchema = z.object({
  subtype: z.enum(DEPECHE_SUBTYPES),
  occurredAt: z.string().datetime(),
  texte: z.string().trim().max(4000).default(""),
  sens: z.enum(DEPECHE_SENS).nullable().optional(),
  numeroRecu: z.string().trim().max(20).nullable().optional(),
  avisCrcAt: z.string().datetime().nullable().optional(),
  avisCosAt: z.string().datetime().nullable().optional(),
  avisOpjAt: z.string().datetime().nullable().optional(),
  departEffectifAt: z.string().datetime().nullable().optional(),
  repriseAuthorization: z.enum(REPRISE_AUTHORIZATIONS).nullable().optional(),
  geometry: geometrySchema,
  destinataires: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        numeroRecu: z.string().trim().max(20).nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  signatureB64: z.string().max(500_000).nullable().optional(),
  signerName: z.string().trim().max(120).nullable().optional(),
  /**
   * Signatures des autorités présentes (COS / OPJ) recueillies sur une
   * reprise/rétablissement — remplacent la signature du CIL.
   */
  signatures: z
    .array(
      z.object({
        role: z.enum(["COS", "OPJ"]),
        name: z.string().trim().max(160).nullable().optional(),
        imageB64: z.string().min(1).max(500_000),
      }),
    )
    .max(2)
    .optional(),
  /** Numéro tiré côté client (affiché à l'utilisateur) — utilisé s'il est libre. */
  numeroDonne: z.number().int().min(10).max(69).optional(),
});

const d = (s: string | null | undefined) => (s ? new Date(s) : null);

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
  const occurredAt = new Date(p.occurredAt);
  const eventType = eventTypeForSubtype(p.subtype);
  const geometry = p.geometry ?? {};

  // Garde-fou métier : une reprise / un rétablissement exige l'autorisation de
  // chaque COS/OPJ PRÉSENT (arrivé, non reparti), portée par avisCosAt/avisOpjAt,
  // sauf s'il est déjà parti.
  const isReprise =
    p.subtype === "REPRISE_PARTIELLE" ||
    p.subtype === "REPRISE_NORMALE" ||
    p.subtype === "RETABLISSEMENT_PARTIEL" ||
    p.subtype === "RETABLISSEMENT_NORMAL";
  if (isReprise) {
    const intervenants = await prisma.cilIntervenant.findMany({
      where: { incidentId: id, type: { in: ["COS", "OPJ"] } },
      select: { type: true, arrivedAt: true, departedAt: true },
    });
    const presence = intervenants.map((i) => ({
      type: i.type,
      arrivedAt: i.arrivedAt ? i.arrivedAt.toISOString() : null,
      departedAt: i.departedAt ? i.departedAt.toISOString() : null,
    }));
    // La signature de l'autorité est exigée au même titre que son autorisation.
    const signedBy = (role: "COS" | "OPJ") =>
      (p.signatures ?? []).some((s) => s.role === role && !!s.imageB64);
    const { ok, missing } = repriseAllowed(presence, {
      COS: { authorized: !!p.avisCosAt, signed: signedBy("COS") },
      OPJ: { authorized: !!p.avisOpjAt, signed: signedBy("OPJ") },
    });
    if (!ok) {
      return NextResponse.json(
        { error: missingRequirementsMessage(missing) },
        { status: 409 },
      );
    }
  }

  // Réservation transactionnelle du prochain numéro libre, avec retry sur
  // collision (@@unique([incidentId, numeroDonne])) — garantit l'unicité serveur.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = await usedNumbers(prisma, id);
    // Numéro proposé par le client (déjà affiché) s'il est encore libre et
    // dans la bonne plage ; sinon tirage serveur.
    const [rmin, rmax] = rangeForSubtype(p.subtype);
    const wanted =
      attempt === 0 &&
      p.numeroDonne != null &&
      p.numeroDonne >= rmin &&
      p.numeroDonne <= rmax &&
      !used.includes(p.numeroDonne)
        ? p.numeroDonne
        : null;
    const numeroDonne = wanted ?? randomNumberForSubtype(p.subtype, used);
    if (numeroDonne === null) {
      return NextResponse.json(
        { error: "Plage de numéros épuisée pour ce type de dépêche." },
        { status: 409 },
      );
    }
    try {
      const depeche = await prisma.$transaction(async (tx) => {
        const event = await createEvent(tx, {
          incidentId: id,
          type: eventType,
          occurredAt,
          label: `${DEPECHE_SUBTYPE_LABELS[p.subtype]} — n° ${numeroDonne}`,
          actorId: u.id,
          actorName: u.name,
          metadata: p.repriseAuthorization
            ? { repriseAuthorization: p.repriseAuthorization }
            : null,
        });
        const dep = await tx.cilDepeche.create({
          data: {
            incidentId: id,
            eventId: event.id,
            subtype: p.subtype,
            sens: p.sens ?? null,
            texte: p.texte,
            numeroDonne,
            numeroRecu: p.numeroRecu ?? null,
            avisCrcAt: d(p.avisCrcAt),
            avisCosAt: d(p.avisCosAt),
            avisOpjAt: d(p.avisOpjAt),
            departEffectifAt: d(p.departEffectifAt),
            repriseAuthorization: p.repriseAuthorization ?? null,
            metadata: Object.keys(geometry).length
              ? JSON.stringify(geometry)
              : null,
            destinataires: p.destinataires?.length
              ? {
                  create: p.destinataires.map((x) => ({
                    label: x.label,
                    numeroRecu: x.numeroRecu ?? null,
                  })),
                }
              : undefined,
          },
        });
        // Lien de l'événement vers la dépêche (pour la frise / le PDF).
        await tx.cilEvent.update({
          where: { id: event.id },
          data: { refType: "DEPECHE", refId: dep.id },
        });
        // Signatures des autorités présentes (COS/OPJ) — le rôle est conservé
        // pour placer chaque signature dans la bonne case du livret.
        if (p.signatures?.length) {
          await tx.cilSignature.createMany({
            data: p.signatures.map((s) => ({
              incidentId: id,
              ownerType: "DEPECHE",
              ownerId: dep.id,
              signerRole: s.role,
              signerName: s.name ?? null,
              imageB64: s.imageB64,
            })),
          });
        } else if (p.signatureB64) {
          // Compat : signature unique sans rôle (ancien flux).
          await tx.cilSignature.create({
            data: {
              incidentId: id,
              ownerType: "DEPECHE",
              ownerId: dep.id,
              signerName: p.signerName ?? null,
              imageB64: p.signatureB64,
            },
          });
        }
        return dep;
      });
      return NextResponse.json({ id: depeche.id, numeroDonne });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue; // collision de numéro → retry avec le suivant
      }
      throw e;
    }
  }
  return NextResponse.json(
    { error: "Impossible de réserver un numéro (réessayez)." },
    { status: 409 },
  );
}
