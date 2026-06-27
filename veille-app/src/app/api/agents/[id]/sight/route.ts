import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { agentScope, requireUser, resolveOwningTeam } from "@/lib/auth";
import {
  defaultMessageFor,
  defaultTargetUrlFor,
  formatQuotedSnippet,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";

/**
 * Crée un « Vu » (kind=SIGHT) ou un « Commentaire personnalisé » (kind=NOTE)
 * sur un agent. Apparaît dans l'historique transverse.
 *  - SIGHT : commentaire optionnel, pas de photos.
 *  - NOTE  : commentaire obligatoire, photos optionnelles (uploadées
 *            séparément via /api/photos avec agentSightingId du retour).
 */
const schema = z.object({
  kind: z.enum(["SIGHT", "NOTE"]).default("SIGHT"),
  comment: z.string().trim().max(2000).optional().nullable(),
  sightedAt: z.string().datetime().optional(),
  /** Équipe propriétaire (agent multi-équipes) — requise si ambiguë. */
  teamId: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: agentId } = await ctx.params;
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, ...agentScope(u) },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent inconnu" }, { status: 404 });
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  if (parsed.data.kind === "NOTE" && !parsed.data.comment?.trim()) {
    return NextResponse.json(
      { error: "Un commentaire est requis pour une note." },
      { status: 400 }
    );
  }
  // Équipe propriétaire désambiguïsée dans le périmètre de l'AUTEUR (pas
  // l'équipe legacy de l'agent) — sinon une NOTE créée par un membre hors
  // équipe principale serait estampillée hors de son scope et disparaîtrait
  // de sa propre fiche (la lecture des NOTE est cloisonnée par teamScope).
  const owning = resolveOwningTeam(
    u,
    [agent.teamId, ...agent.memberships.map((m) => m.teamId)],
    parsed.data.teamId,
  );
  if (!owning.ok) {
    const status = owning.code === "TEAM_REQUIRED" ? 400 : 403;
    return NextResponse.json(
      {
        error:
          owning.code === "TEAM_REQUIRED"
            ? "Agent partagé : précisez l'équipe."
            : owning.code === "NO_TEAM"
              ? "Aucune équipe de votre périmètre rattachée à cet agent."
              : "Équipe hors de votre périmètre.",
        code: owning.code,
      },
      { status }
    );
  }
  const teamId = owning.teamId;
  const sighting = await prisma.agentSighting.create({
    data: {
      agentId,
      teamId,
      observerId: u.id,
      kind: parsed.data.kind,
      comment: parsed.data.comment?.trim() || null,
      sightedAt: parsed.data.sightedAt
        ? new Date(parsed.data.sightedAt)
        : new Date(),
    },
  });

  // Flux d'activité aligné sur la lecture : « Vu » (SIGHT) transversal →
  // toutes les équipes de l'agent ; « Note » (NOTE) cloisonnée → équipe
  // propriétaire uniquement (cf. décision §5).
  const agentName = `${agent.lastName} ${agent.firstName}`.trim();
  const type = parsed.data.kind === "NOTE" ? "AGENT_NOTE" : "AGENT_SIGHTED";
  const teamIds =
    type === "AGENT_SIGHTED"
      ? [...new Set([teamId, ...agent.memberships.map((m) => m.teamId)])]
      : [teamId];
  await recordActivitySafe({
    teamIds,
    actorId: u.id,
    actorName: u.name,
    type,
    entityType: "agent",
    entityId: agentId,
    entityLabel: agentName,
    // Enrichi C10 — on inclut le commentaire (optionnel pour SIGHT,
    // obligatoire pour NOTE) directement dans le message pour qu'il
    // soit visible côté push et /notifications sans cliquer.
    message: joinActivityParts([
      defaultMessageFor({
        type,
        actorName: u.name,
        entityLabel: agentName,
      }),
      formatQuotedSnippet(parsed.data.comment),
    ]),
    targetUrl: defaultTargetUrlFor({ entityType: "agent", entityId: agentId }),
    metadata: {
      sightingId: sighting.id,
      kind: parsed.data.kind,
      hasComment: Boolean(parsed.data.comment?.trim()),
    },
  });

  return NextResponse.json(sighting);
}
