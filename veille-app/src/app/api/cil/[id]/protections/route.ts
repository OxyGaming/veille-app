import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent, usedNumbers } from "@/lib/cil/repo";
import { randomAvailableNumber, NUMBER_RANGES } from "@/lib/cil/numbering";

/**
 * Création d'UNE dépêche de protection.
 *
 * Une protection en compte deux (CRC + RSS de Lyon / AC), mais elles sont
 * transmises l'une APRÈS l'autre : chacune a donc sa propre heure et son propre
 * n° reçu, et est enregistrée séparément. Le second envoi peut intervenir bien
 * plus tard — la voie de protection le rappelle tant qu'il manque.
 *
 * Le n° reçu est OBLIGATOIRE : une dépêche sans collationnement du numéro n'est
 * pas une dépêche passée.
 */
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
  kind: z.enum(["CIRCULATION", "ELECTRIQUE"]),
  /** Destinataire de CETTE dépêche. */
  interlocutor: z.enum(["CRC", "RSS", "AC"]),
  occurredAt: z.string().datetime(),
  texte: z.string().trim().max(4000).default(""),
  geometry: geometrySchema,
  /** N° reçu de l'interlocuteur — obligatoire (collationnement). */
  numeroRecu: z.string().trim().min(1).max(20),
  /** Libellé de l'AC (circulation) — ex. « Givors ». */
  acLabel: z.string().trim().max(120).nullable().optional(),
  /** « Avis à (obligatoire) » — heures d'avis aux autorités présentes. */
  avisCosAt: z.string().datetime().nullable().optional(),
  avisOpjAt: z.string().datetime().nullable().optional(),
  /** Numéro tiré côté client (affiché) — retenu s'il est encore libre. */
  numeroDonne: z.number().int().min(10).max(29).optional(),
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
  const subtype =
    p.kind === "CIRCULATION" ? "PROTECTION_CIRCULATION" : "PROTECTION_ELECTRIQUE";
  // Le second interlocuteur dépend de la nature de la protection.
  const expectedSecond = p.kind === "CIRCULATION" ? "AC" : "RSS";
  if (p.interlocutor !== "CRC" && p.interlocutor !== expectedSecond) {
    return NextResponse.json(
      {
        error: `Interlocuteur invalide pour une protection ${p.kind.toLowerCase()} : attendu CRC ou ${expectedSecond}.`,
      },
      { status: 400 },
    );
  }

  // Une même protection ne se transmet pas deux fois au même interlocuteur.
  const deja = await prisma.cilDepeche.findFirst({
    where: { incidentId: id, subtype, interlocutor: p.interlocutor },
    select: { id: true, numeroDonne: true },
  });
  if (deja) {
    return NextResponse.json(
      {
        error: `Cette protection a déjà été transmise au ${p.interlocutor} (n° ${deja.numeroDonne}).`,
      },
      { status: 409 },
    );
  }

  const occurredAt = new Date(p.occurredAt);
  const geometry = { ...(p.geometry ?? {}) };
  if (p.acLabel) (geometry as Record<string, string>).acLabel = p.acLabel;
  const metadata = Object.keys(geometry).length ? JSON.stringify(geometry) : null;
  const label =
    p.kind === "CIRCULATION" ? "Protection circulation" : "Protection électrique";

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = await usedNumbers(prisma, id);
    // Numéro proposé par le client (déjà affiché) s'il est encore libre.
    const wanted =
      attempt === 0 && p.numeroDonne != null && !used.includes(p.numeroDonne)
        ? p.numeroDonne
        : null;
    const numeroDonne =
      wanted ?? randomAvailableNumber(NUMBER_RANGES.PROTECTION, used);
    if (numeroDonne === null) {
      return NextResponse.json(
        { error: "Plage de numéros épuisée (protections)." },
        { status: 409 },
      );
    }
    try {
      const created = await prisma.$transaction(async (tx) => {
        const event = await createEvent(tx, {
          incidentId: id,
          type: "DEPECHE",
          occurredAt,
          label: `${label} — ${p.interlocutor} — n° ${numeroDonne}`,
          actorId: u.id,
          actorName: u.name,
        });
        const dep = await tx.cilDepeche.create({
          data: {
            incidentId: id,
            eventId: event.id,
            subtype,
            interlocutor: p.interlocutor,
            texte: p.texte,
            numeroDonne,
            numeroRecu: p.numeroRecu,
            // Les avis COS/OPJ sont portés par la dépêche au CRC.
            avisCosAt:
              p.interlocutor === "CRC" && p.avisCosAt
                ? new Date(p.avisCosAt)
                : null,
            avisOpjAt:
              p.interlocutor === "CRC" && p.avisOpjAt
                ? new Date(p.avisOpjAt)
                : null,
            metadata,
          },
        });
        await tx.cilEvent.update({
          where: { id: event.id },
          data: { refType: "DEPECHE", refId: dep.id },
        });
        return dep;
      });
      return NextResponse.json({
        id: created.id,
        numeroDonne,
        interlocutor: p.interlocutor,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue; // collision de numéro → retry
      }
      throw e;
    }
  }
  return NextResponse.json(
    { error: "Impossible de réserver un numéro (réessayez)." },
    { status: 409 },
  );
}
