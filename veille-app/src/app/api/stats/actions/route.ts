import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { actionScope, requireUser, teamScope } from "@/lib/auth";
import {
  actionEcheanceStateAt,
  echeanceBounds,
} from "@/lib/echeances/action-echeance";
import { dedupActions } from "@/lib/actions/dedup";

/**
 * Stats actions — DEUX natures d'indicateurs à ne pas mélanger :
 *
 *  • INSTANTANÉ (état courant, indépendant de la période sélectionnée) :
 *      - overdue            : actions « En retard » (dueAt < aujourd'hui 00:00),
 *                             dont « En retard critique » (> 7 j) ;
 *      - soon               : actions « À venir » (aujourd'hui → J+7) ;
 *      - actionsActiveAging  : ancienneté des actions à traiter.
 *  • SUR LA PÉRIODE (from/to) :
 *      - validationDelay     : délai entre échéance/création et validation ;
 *      - monthlyValidations  : cumul mensuel des validations ;
 *      - photoSync           : LOCAL vs SYNCED des photos créées sur la période.
 *
 * Le champ `nature` du payload qualifie chaque bloc pour l'affichage (sous-titres).
 * Nomenclature alignée sur lib/echeances/action-echeance.ts.
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

  // Bornes canoniques (aujourd'hui 00:00 / +7 j / −7 j) — instantané « état courant ».
  const now = new Date();
  const bounds = echeanceBounds(now);

  const [activeActions, validations, photos] = await Promise.all([
    prisma.importedAction.findMany({
      where: { ...aScope, localStatus: "ACTIVE" },
      select: {
        id: true,
        teamId: true,
        agentId: true,
        siteId: true,
        vehicleId: true,
        dedupHash: true,
        localStatus: true,
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
    // Cloisonnement : ne compter que les photos dont le parent (session,
    // observation, sighting agent/site, RCI) est dans le périmètre. Sans ce
    // filtre, le KPI photoSync agrégeait toutes les équipes.
    prisma.photo.findMany({
      where:
        "teamId" in scope
          ? {
              createdAt: { gte: from, lte: to },
              OR: [
                { session: scope },
                {
                  observation: {
                    procedureObservation: { session: scope },
                  },
                },
                { agentSighting: scope },
                { siteSighting: scope },
                { rci: scope },
              ],
            }
          : { createdAt: { gte: from, lte: to } },
      select: { syncStatus: true },
    }),
  ]);

  // INSTANTANÉ — état courant compté en ACTIONS LOGIQUES (doublons regroupés
  // via le helper central). Les indicateurs de période (validations/photos)
  // restent en occurrences (cf. §6 du return).
  const actionGroups = dedupActions(activeActions);

  // 1 & 2. En retard / À venir (classification canonique, sur le représentant).
  type AgentSlot = { name: string; count: number };
  const overdueByAgent = new Map<string, number>();
  const overdueBySite = new Map<string, number>();
  const soonByAgent = new Map<string, number>();
  const soonBySite = new Map<string, number>();
  let overdueTotal = 0;
  let overdueCriticalTotal = 0;
  let soonTotal = 0;
  for (const g of actionGroups) {
    const a = g.representative;
    const state = actionEcheanceStateAt(a.dueAt, bounds);
    if (state === "OVERDUE" || state === "OVERDUE_CRITICAL") {
      overdueTotal++;
      if (state === "OVERDUE_CRITICAL") overdueCriticalTotal++;
      if (a.agent) {
        const n = `${a.agent.lastName} ${a.agent.firstName}`;
        overdueByAgent.set(n, (overdueByAgent.get(n) ?? 0) + 1);
      } else if (a.site) {
        overdueBySite.set(a.site.name, (overdueBySite.get(a.site.name) ?? 0) + 1);
      }
    } else if (state === "DUE_SOON") {
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
  for (const g of actionGroups) {
    const days = (now.getTime() - g.representative.createdAt.getTime()) / 86400000;
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
    // Qualifie chaque bloc :
    //  - "instant"  = état courant (ignore la période), compté en ACTIONS
    //    LOGIQUES (doublons regroupés) ;
    //  - "period"   = calculé sur from/to, en OCCURRENCES (validations/photos
    //    sont des événements unitaires, pas des actions à dédupliquer).
    counting: { instant: "logical", period: "occurrences" },
    nature: {
      overdue: "instant",
      soon: "instant",
      actionsActiveAging: "instant",
      validationDelay: "period",
      monthlyValidations: "period",
      photoSync: "period",
    },
    overdue: {
      total: overdueTotal,
      critical: overdueCriticalTotal,
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
