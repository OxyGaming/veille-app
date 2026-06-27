import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { agentScope, requireUser, teamScope } from "@/lib/auth";

/**
 * Renvoie un mini timeline d'activité par agent sur les 30 derniers jours
 * et la date de la dernière activité (sans limite).
 *
 * Format : {
 *   agents: { [agentId]: number[] },              // 30 buckets pour sparkline
 *   lastAt: { [agentId]: ISO date | null },       // date de la dernière trace
 *   days, firstDay, lastDay
 * }
 *
 * "Dernière activité" = max(session, validation, sighting) toutes sources.
 */
export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const days = 30;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const agents = await prisma.agent.findMany({
    where: { isActive: true, isVisible: true, ...agentScope(u) },
    select: { id: true },
  });
  const ids = agents.map((a) => a.id);
  if (!ids.length)
    return NextResponse.json({ agents: {}, lastAt: {}, days });

  // Cloisonnement §5 : l'activité agrégée (veilles + validations) est strictement
  // par équipe ; seuls les « Vu » (SIGHT) restent transversaux.
  const scope = teamScope(u);
  const sightingScope = { OR: [{ kind: "SIGHT" }, { ...scope }] };

  const [
    sessions,
    validations,
    sightings,
    lastSessions,
    lastValidations,
    lastSightings,
  ] = await Promise.all([
    prisma.veilleSession.findMany({
      where: { agentId: { in: ids }, startedAt: { gte: from, lte: today }, ...scope },
      select: { agentId: true, startedAt: true },
    }),
    prisma.actionValidation.findMany({
      where: { agentId: { in: ids }, realizedAt: { gte: from, lte: today }, ...scope },
      select: { agentId: true, realizedAt: true },
    }),
    prisma.agentSighting.findMany({
      where: { agentId: { in: ids }, sightedAt: { gte: from, lte: today }, ...sightingScope },
      select: { agentId: true, sightedAt: true },
    }),
    // Toutes périodes confondues, on prend le max par agent.
    prisma.veilleSession.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, ...scope },
      _max: { startedAt: true },
    }),
    prisma.actionValidation.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, ...scope },
      _max: { realizedAt: true },
    }),
    prisma.agentSighting.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, ...sightingScope },
      _max: { sightedAt: true },
    }),
  ]);

  const dayIndex = (d: Date) => {
    const diff = Math.floor((d.getTime() - from.getTime()) / 86400000);
    return Math.max(0, Math.min(days - 1, diff));
  };
  const buckets: Record<string, number[]> = {};
  for (const id of ids) buckets[id] = Array(days).fill(0);
  for (const s of sessions) {
    if (!s.agentId) continue;
    buckets[s.agentId][dayIndex(s.startedAt)]++;
  }
  for (const v of validations) {
    if (!v.agentId) continue;
    buckets[v.agentId][dayIndex(v.realizedAt)]++;
  }
  for (const s of sightings) {
    buckets[s.agentId][dayIndex(s.sightedAt)]++;
  }
  // Max sur les 3 sources -> dernière activité de chaque agent.
  const lastAt: Record<string, string | null> = {};
  for (const id of ids) lastAt[id] = null;
  const stash = (
    rows: { agentId: string | null; _max: Record<string, Date | null> }[],
    field: string
  ) => {
    for (const r of rows) {
      if (!r.agentId) continue;
      const d = r._max[field];
      if (!d) continue;
      const cur = lastAt[r.agentId];
      if (!cur || new Date(cur) < d) lastAt[r.agentId] = d.toISOString();
    }
  };
  stash(lastSessions as never, "startedAt");
  stash(lastValidations as never, "realizedAt");
  stash(lastSightings as never, "sightedAt");

  // Premier et dernier jour pour les labels (le client n'en a pas vraiment besoin).
  const firstDay = format(from, "yyyy-MM-dd");
  const lastDay = format(addDays(from, days - 1), "yyyy-MM-dd");

  return NextResponse.json({
    agents: buckets,
    lastAt,
    days,
    firstDay,
    lastDay,
  });
}
