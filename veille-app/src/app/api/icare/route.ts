import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";

/**
 * Résout l'équipe propriétaire de l'entité référencée par (refType, refId).
 * Renvoie `undefined` si l'entité n'existe pas. Sert au contrôle d'accès :
 * une marque Icare ne peut être posée/retirée que sur une entité du périmètre.
 */
async function resolveRefTeamId(
  refType: string,
  refId: string,
): Promise<string | undefined> {
  switch (refType) {
    case "visit": {
      const v = await prisma.siteVisit.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      if (v) return v.teamId;
      // L'historique range aussi les tournées véhicule sous « visit ».
      const r = await prisma.vehicleRound.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      return r?.teamId;
    }
    case "session": {
      const s = await prisma.veilleSession.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      return s?.teamId;
    }
    case "validation": {
      const v = await prisma.actionValidation.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      return v?.teamId;
    }
    case "sighting":
    case "note": {
      const s = await prisma.agentSighting.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      return s?.teamId;
    }
    case "site-sighting":
    case "site-note": {
      const s = await prisma.siteSighting.findUnique({
        where: { id: refId },
        select: { teamId: true },
      });
      return s?.teamId;
    }
    default:
      return undefined;
  }
}

/**
 * Toggle Icare : marque (ou démarque) un événement de l'historique comme
 * "saisie Icare effectuée". L'événement est identifié par (refType, refId).
 *
 * refType ∈ { visit | session | validation | sighting | site-sighting |
 *             note | site-note }.
 *
 * Réponse : { done: boolean }.
 */
const REF_TYPES = [
  "visit",
  "session",
  "validation",
  "sighting",
  "site-sighting",
  "note",
  "site-note",
] as const;

const schema = z.object({
  refType: z.enum(REF_TYPES),
  refId: z.string().min(1),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
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
  const { refType, refId } = parsed.data;
  // Cloisonnement : l'entité référencée doit être dans le périmètre de l'user
  // (empêche un toggle Icare IDOR sur une donnée d'une autre équipe).
  const refTeamId = await resolveRefTeamId(refType, refId);
  if (refTeamId === undefined) {
    return NextResponse.json({ error: "Référence inconnue" }, { status: 404 });
  }
  if (!assertTeamAccess(u, refTeamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const existing = await prisma.icareEntry.findUnique({
    where: { refType_refId: { refType, refId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.icareEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ done: false });
  }
  await prisma.icareEntry.create({
    data: { refType, refId, doneById: u.id },
  });
  return NextResponse.json({ done: true });
}
