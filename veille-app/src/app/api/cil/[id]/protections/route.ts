import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { createEvent, usedNumbers } from "@/lib/cil/repo";
import { randomAvailableNumber, NUMBER_RANGES } from "@/lib/cil/numbering";

/**
 * Création d'une PROTECTION = 2 dépêches numérotées (imprimé officiel 2024) :
 *  - électrique → CRC + RSS de Lyon
 *  - circulation → CRC + AC
 * Chacune consomme un numéro de la plage protections (10-29), avec son propre
 * N° donné (réservé serveur) / N° reçu. Réservation atomique + retry P2002.
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
  occurredAt: z.string().datetime(),
  texte: z.string().trim().max(4000).default(""),
  geometry: geometrySchema,
  /** N° reçu de la dépêche au CRC. */
  crcNumeroRecu: z.string().trim().max(20).nullable().optional(),
  /** N° reçu de la 2ᵉ dépêche (RSS de Lyon / AC). */
  secondNumeroRecu: z.string().trim().max(20).nullable().optional(),
  /** Libellé de l'AC (circulation) — ex. "AC de Givors". */
  acLabel: z.string().trim().max(120).nullable().optional(),
  /** « Avis à (obligatoire) » — heures d'avis aux autorités présentes. */
  avisCosAt: z.string().datetime().nullable().optional(),
  avisOpjAt: z.string().datetime().nullable().optional(),
  /**
   * Numéros tirés côté client (affichés à l'utilisateur). Utilisés tels quels
   * s'ils sont encore libres ; sinon tirage serveur (anti-collision).
   */
  numeroDonne: z.number().int().min(10).max(29).optional(),
  numeroDonne2: z.number().int().min(10).max(29).optional(),
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
  const secondInterlocutor = p.kind === "CIRCULATION" ? "AC" : "RSS";
  const occurredAt = new Date(p.occurredAt);
  const geometry = { ...(p.geometry ?? {}) };
  if (p.acLabel) (geometry as Record<string, string>).acLabel = p.acLabel;
  const metadata = Object.keys(geometry).length ? JSON.stringify(geometry) : null;
  const label =
    p.kind === "CIRCULATION"
      ? "Protection circulation"
      : "Protection électrique";

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = await usedNumbers(prisma, id);
    const usedSet = new Set(used);
    // Numéros proposés par le client (tirés et affichés côté UI) s'ils sont
    // encore libres — garantit que le n° annoncé est celui retenu.
    const wanted1 =
      attempt === 0 && p.numeroDonne != null && !usedSet.has(p.numeroDonne)
        ? p.numeroDonne
        : null;
    const n1 = wanted1 ?? randomAvailableNumber(NUMBER_RANGES.PROTECTION, used);
    const wanted2 =
      attempt === 0 &&
      p.numeroDonne2 != null &&
      !usedSet.has(p.numeroDonne2) &&
      p.numeroDonne2 !== n1
        ? p.numeroDonne2
        : null;
    const n2 =
      n1 === null
        ? null
        : (wanted2 ??
          randomAvailableNumber(NUMBER_RANGES.PROTECTION, [...used, n1]));
    if (n1 === null || n2 === null) {
      return NextResponse.json(
        { error: "Pas assez de numéros disponibles (plage protections)." },
        { status: 409 },
      );
    }
    try {
      const created = await prisma.$transaction(async (tx) => {
        const mkDepeche = async (
          numeroDonne: number,
          interlocutor: string,
          numeroRecu: string | null,
          /** Les avis COS/OPJ sont portés par la dépêche CRC de la protection. */
          avis?: { cos: Date | null; opj: Date | null },
          texte: string = p.texte,
        ) => {
          const event = await createEvent(tx, {
            incidentId: id,
            type: "DEPECHE",
            occurredAt,
            label: `${label} — ${interlocutor} — n° ${numeroDonne}`,
            actorId: u.id,
            actorName: u.name,
          });
          const dep = await tx.cilDepeche.create({
            data: {
              incidentId: id,
              eventId: event.id,
              subtype,
              interlocutor,
              texte,
              numeroDonne,
              numeroRecu,
              avisCosAt: avis?.cos ?? null,
              avisOpjAt: avis?.opj ?? null,
              metadata,
            },
          });
          await tx.cilEvent.update({
            where: { id: event.id },
            data: { refType: "DEPECHE", refId: dep.id },
          });
          return dep.id;
        };
        // La 2ᵉ dépêche s'adresse au RSS / à l'AC : on réécrit l'en-tête
        // « … à CRC de Lyon : » pour que le texte relu soit cohérent avec son
        // destinataire (sans impact sur le livret, qui a ses propres cases).
        const acNom = p.acLabel?.trim();
        const secondHeader =
          p.kind === "CIRCULATION"
            ? // « AC de Givors » si le poste est donné, sinon « AC » seul ; on
              // n'ajoute pas « AC de » si le libellé le porte déjà.
              `à ${!acNom ? "AC" : /^AC\b/i.test(acNom) ? acNom : `AC de ${acNom}`} :`
            : "à RSS de Lyon :";
        const secondTexte = p.texte.replace(
          /à\s+CRC\s+de\s+Lyon\s*:/i,
          secondHeader,
        );

        const crcId = await mkDepeche(n1, "CRC", p.crcNumeroRecu ?? null, {
          cos: p.avisCosAt ? new Date(p.avisCosAt) : null,
          opj: p.avisOpjAt ? new Date(p.avisOpjAt) : null,
        });
        const secondId = await mkDepeche(
          n2,
          secondInterlocutor,
          p.secondNumeroRecu ?? null,
          undefined,
          secondTexte,
        );
        return { crcId, secondId };
      });
      return NextResponse.json({
        ...created,
        numeros: [n1, n2],
        interlocutors: ["CRC", secondInterlocutor],
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue; // collision → retry
      }
      throw e;
    }
  }
  return NextResponse.json(
    { error: "Impossible de réserver les numéros (réessayez)." },
    { status: 409 },
  );
}
