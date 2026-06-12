import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { agentScope, requireRole } from "@/lib/auth";
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
  teamIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
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

  // Résolution des agents cibles.
  let agents: { id: string; teamId: string | null }[] = [];
  const scope = agentScope(u);
  if (data.agentIds?.length) {
    agents = await prisma.agent.findMany({
      where: { id: { in: data.agentIds }, isActive: true, ...scope },
      select: { id: true, teamId: true },
    });
  } else {
    const teamFilter = data.teamIds?.length
      ? { memberships: { some: { teamId: { in: data.teamIds } } } }
      : scope;
    agents = await prisma.agent.findMany({
      where: { isActive: true, isVisible: true, ...teamFilter },
      select: { id: true, teamId: true },
    });
  }
  if (!agents.length) {
    return NextResponse.json(
      { error: "Aucun agent cible — vérifiez la sélection ou les équipes." },
      { status: 400 }
    );
  }

  // Choix du teamId scalaire pour l'enregistrement (équipe principale de
  // l'utilisateur, sinon première équipe trouvée).
  const teamId = u.teamId ?? agents[0]?.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Impossible de déterminer l'équipe propriétaire de l'action." },
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
