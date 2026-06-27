import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { effectiveTeamIds, requireUser } from "@/lib/auth";
import { encodeTags, normalizeTag } from "@/lib/tags";

/**
 * Création rapide d'une action.
 *
 * Sélection des cibles :
 *  - agentIds[] explicite si fourni (multi-sélection côté UI) ;
 *  - sinon : broadcast vers tous les agents visibles et actifs des équipes
 *    précisées via teamIds[] ; à défaut, des équipes de l'utilisateur.
 *
 * Tags libres, multi. Echéance par défaut +7 mois (éditable).
 */
const schema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  agentIds: z.array(z.string()).optional(),
  /** Équipe propriétaire — obligatoire : l'action est créée dans CETTE équipe
   *  et seuls ses agents membres sont ciblés (cloisonnement). */
  teamId: z.string().min(1),
});

export async function POST(req: Request) {
  let u;
  try {
    // Création d'action ouverte à tout utilisateur authentifié ; cloisonnement
    // assuré par la validation effectiveTeamIds du teamId cible ci-dessous.
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
  const data = parsed.data;
  const title = data.title;
  const dueAt = data.dueAt ? new Date(data.dueAt) : addMonths(new Date(), 7);
  const teamId = data.teamId;

  // L'équipe cible doit être dans le périmètre agissable de l'utilisateur.
  const eff = effectiveTeamIds(u);
  if (eff !== null && !eff.includes(teamId)) {
    return NextResponse.json(
      { error: "Équipe non autorisée." },
      { status: 403 }
    );
  }

  // Agents cibles, TOUJOURS contraints à l'équipe propriétaire (primaire ou
  // membership) : impossible d'assigner l'action à un agent hors de l'équipe,
  // ce qui la rendrait invisible côté fiche.
  const inTeam = {
    OR: [{ teamId }, { memberships: { some: { teamId } } }],
  };
  const agents = data.agentIds?.length
    ? await prisma.agent.findMany({
        where: { id: { in: data.agentIds }, isActive: true, ...inTeam },
        select: { id: true },
      })
    : await prisma.agent.findMany({
        where: { isActive: true, isVisible: true, ...inTeam },
        select: { id: true },
      });
  if (!agents.length) {
    return NextResponse.json(
      { error: "Aucun agent cible rattaché à cette équipe." },
      { status: 400 }
    );
  }

  const tagsClean = data.tags
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const externalId = `manual-${randomUUID()}`;
  const dedupHash = createHash("sha1")
    .update(
      [
        title.toLowerCase().trim(),
        "",
        "",
        dueAt.toISOString().slice(0, 10),
        tagsClean.map(normalizeTag).sort().join(","),
        "",
      ].join("|")
    )
    .digest("hex");

  const now = new Date();
  await prisma.importedAction.createMany({
    data: agents.map((a) => ({
      externalId,
      teamId,
      agentId: a.id,
      localStatus: "ACTIVE",
      dedupHash,
      originalStatus: "Planifiée",
      keyPoint: title,
      veilleType: "Agent",
      dueAt,
      tags: encodeTags(tagsClean),
      lastSeenAt: now,
    })),
  });

  return NextResponse.json({
    externalId,
    title,
    dueAt: dueAt.toISOString(),
    agentsCount: agents.length,
    tags: tagsClean,
  });
}
