import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Stats activité :
 *  - heatmap          : 7×24 (jour × heure) tous événements confondus
 *  - loadPerUser      : nombre d'événements par utilisateur, ventilation par type
 *  - topProcedures    : procédures les plus observées en session
 *  - vuVsSession      : ratio Vu/Notes vs Sessions par agent
 *  - sessionDuration  : distribution des durées de session
 */
export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from") + "T00:00:00")
    : new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to") + "T23:59:59")
    : new Date();

  const scope = teamScope(u);
  const dateOn = (field: string) => ({ [field]: { gte: from, lte: to } });

  const [
    visits,
    sessions,
    validations,
    agentSightings,
    siteSightings,
    vehicleRounds,
  ] = await Promise.all([
      prisma.siteVisit.findMany({
        where: { ...scope, ...dateOn("visitDate") },
        select: {
          visitDate: true,
          observer: { select: { name: true } },
        },
      }),
      prisma.veilleSession.findMany({
        where: { ...scope, ...dateOn("startedAt") },
        select: {
          startedAt: true,
          finishedAt: true,
          observer: { select: { name: true } },
          agent: { select: { firstName: true, lastName: true } },
          procedures: { include: { procedure: { select: { title: true } } } },
        },
      }),
      prisma.actionValidation.findMany({
        where: { ...scope, ...dateOn("realizedAt") },
        select: {
          realizedAt: true,
          validatedBy: { select: { name: true } },
        },
      }),
      prisma.agentSighting.findMany({
        where: { ...scope, ...dateOn("sightedAt") },
        select: {
          kind: true,
          sightedAt: true,
          observer: { select: { name: true } },
          agent: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.siteSighting.findMany({
        where: { ...scope, ...dateOn("sightedAt") },
        select: {
          kind: true,
          sightedAt: true,
          observer: { select: { name: true } },
        },
      }),
      prisma.vehicleRound.findMany({
        where: { ...scope, ...dateOn("roundDate") },
        select: {
          roundDate: true,
          observer: { select: { name: true } },
        },
      }),
    ]);

  // 1. Heatmap 7×24 (lundi=0…dimanche=6, heures 0..23).
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  const push = (d: Date) => {
    const day = (d.getDay() + 6) % 7; // lundi=0
    heatmap[day][d.getHours()]++;
  };
  for (const v of visits) push(v.visitDate);
  for (const s of sessions) push(s.startedAt);
  for (const v of validations) push(v.realizedAt);
  for (const s of agentSightings) push(s.sightedAt);
  for (const s of siteSightings) push(s.sightedAt);
  for (const r of vehicleRounds) push(r.roundDate);

  // 2. Charge par utilisateur.
  type Slot = { visit: number; session: number; validation: number; sighting: number; note: number };
  const empty = (): Slot => ({
    visit: 0,
    session: 0,
    validation: 0,
    sighting: 0,
    note: 0,
  });
  const userMap = new Map<string, Slot>();
  const add = (name: string, k: keyof Slot) => {
    const s = userMap.get(name) ?? empty();
    s[k]++;
    userMap.set(name, s);
  };
  for (const v of visits) add(v.observer.name, "visit");
  // Les tournées VS comptent comme des "visits" (cohérent avec l'onglet
  // fusionné Visites & Tournées).
  for (const r of vehicleRounds) add(r.observer.name, "visit");
  for (const s of sessions) add(s.observer.name, "session");
  for (const v of validations) add(v.validatedBy.name, "validation");
  for (const s of agentSightings)
    add(s.observer.name, s.kind === "NOTE" ? "note" : "sighting");
  for (const s of siteSightings)
    add(s.observer.name, s.kind === "NOTE" ? "note" : "sighting");
  const loadPerUser = [...userMap.entries()]
    .map(([name, s]) => ({
      name,
      total: s.visit + s.session + s.validation + s.sighting + s.note,
      ...s,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // 3. Top procédures observées.
  const procMap = new Map<string, number>();
  for (const s of sessions) {
    for (const po of s.procedures) {
      const k = po.procedure.title;
      procMap.set(k, (procMap.get(k) ?? 0) + 1);
    }
  }
  const topProcedures = [...procMap.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 4. Vu / Notes vs Sessions par agent.
  type Mix = { sessions: number; sightings: number; notes: number };
  const mixMap = new Map<string, Mix>();
  const emptyMix = (): Mix => ({ sessions: 0, sightings: 0, notes: 0 });
  for (const s of sessions) {
    if (!s.agent) continue;
    const k = `${s.agent.lastName} ${s.agent.firstName}`;
    const row = mixMap.get(k) ?? emptyMix();
    row.sessions++;
    mixMap.set(k, row);
  }
  for (const sg of agentSightings) {
    if (!sg.agent) continue;
    const k = `${sg.agent.lastName} ${sg.agent.firstName}`;
    const row = mixMap.get(k) ?? emptyMix();
    if (sg.kind === "NOTE") row.notes++;
    else row.sightings++;
    mixMap.set(k, row);
  }
  const vuVsSession = [...mixMap.entries()]
    .map(([name, m]) => ({
      name,
      total: m.sessions + m.sightings + m.notes,
      ...m,
      // ratio "surface" = (vu+notes) / total
      surfaceRatio:
        m.sessions + m.sightings + m.notes > 0
          ? Math.round(
              ((m.sightings + m.notes) /
                (m.sessions + m.sightings + m.notes)) *
                100
            )
          : 0,
    }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // 5. Distribution des durées de session (minutes).
  const buckets = [
    { label: "< 5 min", max: 5 },
    { label: "5-15 min", max: 15 },
    { label: "15-30 min", max: 30 },
    { label: "30-60 min", max: 60 },
    { label: "> 1 h", max: Infinity },
  ];
  const sessionDuration = buckets.map((b) => ({ label: b.label, count: 0 }));
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const min =
      (s.finishedAt.getTime() - s.startedAt.getTime()) / 60000;
    const idx = buckets.findIndex((b) => min <= b.max);
    if (idx >= 0) sessionDuration[idx].count++;
  }

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    heatmap,
    loadPerUser,
    topProcedures,
    vuVsSession,
    sessionDuration,
  });
}
