/**
 * POST /api/agents/[id]/development/pdf-log
 *
 * Trace une génération de PDF « Fiche de développement individuel »
 * (action `AGENT_DEVELOPMENT_PDF_GENERATED`). Le PDF lui-même est généré
 * côté client avec jsPDF — ce endpoint ne fait que la vérification de
 * périmètre + l'écriture du log d'audit, pour ne pas faire confiance
 * aux compteurs envoyés depuis le navigateur.
 *
 * Sécurité :
 *  - ADMIN ou EDITOR uniquement (USER → 403).
 *  - Vérifie l'accès à l'agent via `agentScope(u)` — un EDITOR hors
 *    périmètre prend 404 (pas de fuite d'existence).
 *  - Re-calcule les compteurs serveur via `aggregateAgentDevelopment`
 *    avec la même période, et inscrit CES valeurs dans le log (et non
 *    celles envoyées par le client).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { agentScope, effectiveTeamIds, requireUser } from "@/lib/auth";
import { aggregateAgentDevelopment } from "@/lib/agent-development-aggregator";

const schema = z.object({
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
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
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;

  // Vérif accès agent — un EDITOR hors périmètre prend 404.
  const agent = await prisma.agent.findFirst({
    where: { id, ...agentScope(u) },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const from = new Date(parsed.data.periodFrom);
  const to = new Date(parsed.data.periodTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json(
      { error: "Période invalide" },
      { status: 400 },
    );
  }

  // Recalcule les compteurs serveur — le log doit refléter la réalité,
  // pas ce que le client veut bien raconter.
  const summary = await aggregateAgentDevelopment(id, from, to, effectiveTeamIds(u));
  if (!summary) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      userEmail: u.email,
      action: "AGENT_DEVELOPMENT_PDF_GENERATED",
      entity: "Agent",
      entityId: id,
      details: JSON.stringify({
        agentId: id,
        agentName: `${agent.lastName} ${agent.firstName}`.trim(),
        periodFrom: from.toISOString(),
        periodTo: to.toISOString(),
        generatedBy: u.name,
        sessionCount: summary.counts.sessions,
        sightingCount: summary.counts.sightings,
        validationCount: summary.counts.validations,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
