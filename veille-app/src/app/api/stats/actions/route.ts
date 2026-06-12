import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { actionScope, requireUser, teamScope } from "@/lib/auth";

/**
 * Stats actions :
 *  - overdue            : actions actives en retard, ventilation agent/site
 *  - soon               : actions actives à échéance < 7 j
 *  - validationDelay    : délai moyen et médian entre due/realized
 *  - actionsActiveAging : distribution des durées d'ancienneté
 *  - monthlyValidations : cumul des validations par mois
 *  - syncStatus         : LOCAL vs SYNCED des photos (proxy qualité offline)
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
    : new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to") + "T23:59:59")
    : new Date();

  const scope = teamScope(u);
  const aScope = actionScope(u);

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 24 * 3600 * 1000);

  const [activeActions, validations, photos] = await Promise.all([
    prisma.importedAction.findMany({
      where: { ...aScope, localStatus: "ACTIVE" },
      select: {
        id: true,
        dueAt: true,
        createdAt: true,
        agent: { select: { firstName: true, lastName: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.actionValidation.findMany({
      where: { ...scope, realizedAt: { gte: from, lte: to } },
      select: {
        realizedAt: true,
        action: { select: { dueAt: true, createdAt: true } },
      },
    }),
    prisma.photo.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { syncStatus: true },
    }),
  ]);

  // 1 & 2. En retard / à venir.
  type AgentSlot = { name: string; count: number };
  const overdueByAgent = new Map<string, number>();
  const overdueBySite = new Map<string, number>();
  const soonByAgent = new Map<string, number>();
  const soonBySite = new Map<string, number>();
  let overdueTotal = 0;
  let soonTotal = 0;
  for (const a of activeActions) {
    if (!a.dueAt) continue;
    if (a.dueAt < today) {
      overdueTotal++;
      if (a.agent) {
        const n = `${a.agent.lastName} ${a.agent.firstName}`;
        overdueByAgent.set(n, (overdueByAgent.get(n) ?? 0) + 1);
      } else if (a.site) {
        overdueBySite.set(a.site.name, (overdueBySite.get(a.site.name) ?? 0) + 1);
      }
    } else if (a.dueAt <= in7) {
      soonTotal++;
      if (a.agent) {
        const n = `${a.agent.lastName} ${a.agent.firstName}`;
        soonByAgent.set(n, (soonByAgent.get(n) ?? 0) + 1);
      } else if (a.site) {
        soonBySite.set(a.site.name, (soonBySite.get(a.site.name) ?? 0) + 1);
      }
    }
  }
  const topList = (m: Map<string, number>): AgentSlot[] =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  // 3. Délai moyen/médian entre réalisation et échéance/création.
  const delays: number[] = [];
  for (const v of validations) {
    const ref =
      v.action.dueAt ??
      v.action.createdAt ??
      null;
    if (!ref) continue;
    const days = (v.realizedAt.getTime() - ref.getTime()) / 86400000;
    delays.push(days);
  }
  delays.sort((a, b) => a - b);
  const avgDays =
    delays.length > 0
      ? Math.round(
          (delays.reduce((s, d) => s + d, 0) / delays.length) * 10
        ) / 10
      : null;
  const medianDays =
    delays.length > 0
      ? Math.round(delays[Math.floor(delays.length / 2)] * 10) / 10
      : null;
  const validationDelay = {
    avgDays,
    medianDays,
    sampleCount: delays.length,
    earliest: delays.length ? Math.round(delays[0] * 10) / 10 : null,
    latest:
      delays.length ? Math.round(delays[delays.length - 1] * 10) / 10 : null,
  };

  // 4. Aging des actions actives (depuis createdAt).
  const ageBuckets = [
    { label: "< 7 j", max: 7 },
    { label: "7-30 j", max: 30 },
    { label: "30-90 j", max: 90 },
    { label: "90-180 j", max: 180 },
    { label: "> 180 j", max: Infinity },
  ];
  const actionsActiveAging = ageBuckets.map((b) => ({ label: b.label, count: 0 }));
  for (const a of activeActions) {
    const days = (today.getTime() - a.createdAt.getTime()) / 86400000;
    const idx = ageBuckets.findIndex((b) => days <= b.max);
    if (idx >= 0) actionsActiveAging[idx].count++;
  }

  // 5. Cumul mensuel des validations dans la plage.
  const byMonth = new Map<string, number>();
  for (const v of validations) {
    const k = format(v.realizedAt, "yyyy-MM");
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
  }
  const months = [...byMonth.keys()].sort();
  let acc = 0;
  const monthlyValidations = months.map((m) => {
    acc += byMonth.get(m) ?? 0;
    return { month: m, count: byMonth.get(m) ?? 0, cumulative: acc };
  });

  // 6. Statut sync photos (proxy qualité offline).
  let local = 0,
    synced = 0;
  for (const p of photos) {
    if (p.syncStatus === "LOCAL") local++;
    else synced++;
  }

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    overdue: {
      total: overdueTotal,
      byAgent: topList(overdueByAgent),
      bySite: topList(overdueBySite),
    },
    soon: {
      total: soonTotal,
      byAgent: topList(soonByAgent),
      bySite: topList(soonBySite),
    },
    validationDelay,
    actionsActiveAging,
    monthlyValidations,
    photoSync: { local, synced, total: local + synced },
  });
}
