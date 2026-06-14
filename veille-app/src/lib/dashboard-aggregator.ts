/**
 * Agrégateur du Dashboard Pilotage (Sprint 5 C7).
 *
 * Réutilise au maximum :
 *  - `aggregateEcheances` (Sprint 4 C4) pour la matière brute des items
 *    (visites, équipements, actions à échéance) + scopes via siteScope.
 *  - `siteScope` / `actionScope` (Sprint 1+) pour le périmètre EDITOR.
 *  - `getEditorWeekCounters` est laissé inchangé (Today reste autonome).
 *
 * Ajoute uniquement :
 *  - calcul des KPI dérivés des items (sites sans trim, sans plan,
 *    équipements expirés) — réduction in-memory plutôt que nouvelles
 *    requêtes Prisma.
 *  - tendances par jour sur N jours (30 ou 90) : TeamActivity,
 *    Notification, SiteVisit completed, ActionValidation.
 */

import {
  actionScope,
  siteScope,
  teamScope,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateEcheances } from "@/lib/echeances/aggregator";
import type { EcheanceItem } from "@/lib/echeances/types";

export type DashboardPeriod = 30 | 90;

export type DashboardFilters = {
  period: DashboardPeriod;
  /**
   * Sprint 6 C6 — DÉPRÉCIÉ : le scope ADMIN est désormais résolu via
   * le badge header (`resolveAdminScope`). Conservé pour rétro-compat
   * du payload mais ignoré dans `aggregateDashboard`. À retirer Sprint 7+.
   */
  teamId?: string | null;
};

export type DashboardKpis = {
  criticalCount: number;
  openActions: number;
  lateActions: number;
  sitesWithoutQuarterly: number;
  sitesWithoutPlanned: number;
  expiredEquipments: number;
};

export type DashboardTrend = {
  label: string;
  total: number;
  series: number[]; // 1 entrée par jour, longueur = period
};

export type DashboardPayload = {
  filters: DashboardFilters;
  kpis: DashboardKpis;
  trends: {
    activity: DashboardTrend;
    notifications: DashboardTrend;
    visits: DashboardTrend;
    validations: DashboardTrend;
  };
  teamsAvailable: { id: string; name: string }[];
};

const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Construit une série de length `period`, alignée jour par jour (date Paris/local). */
function bucketByDay(
  rows: { createdAt?: Date; finishedAt?: Date | null }[],
  field: "createdAt" | "finishedAt",
  period: number,
  now: Date,
): number[] {
  const buckets = new Array<number>(period).fill(0);
  const startMs = new Date(now.getTime() - (period - 1) * DAY_MS).setHours(
    0,
    0,
    0,
    0,
  );
  for (const r of rows) {
    const at = r[field];
    if (!at) continue;
    const dayIdx = Math.floor((at.getTime() - startMs) / DAY_MS);
    if (dayIdx >= 0 && dayIdx < period) buckets[dayIdx]++;
  }
  return buckets;
}

function countItems(items: EcheanceItem[], kind: EcheanceItem["kind"]) {
  return items.filter((i) => i.kind === kind).length;
}

function countLateKind(items: EcheanceItem[], kind: EcheanceItem["kind"]) {
  return items.filter(
    (i) =>
      i.kind === kind &&
      (i.daysToDue === null || (typeof i.daysToDue === "number" && i.daysToDue < 0)),
  ).length;
}

async function getTeamsAvailable(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  if (user.role === "ADMIN" || user.viewAllTeams) {
    return prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  if (!user.teamIds.length) return [];
  return prisma.team.findMany({
    where: { id: { in: user.teamIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Compteurs Notification — sémantique par rôle/scope (Sprint 6 C6) :
 *  - ADMIN GLOBAL : count global (toutes notifs) — vue système
 *  - ADMIN MY_TEAMS ou TEAM : count personnel — vue cohérente avec le
 *    périmètre choisi (notifs ECHEANCE_CRITICAL_ON_MY_PERIMETER de
 *    l'ADMIN sont déjà filtrées par son scope via S6 C5)
 *  - EDITOR / USER : count personnel (inchangé)
 *
 * Sans modèle team-scoped sur Notification, on garde la convention
 * « ADMIN MY_TEAMS/TEAM ≈ vue EDITOR personnelle » qui reste cohérente
 * avec ses autres KPI. Cf. memory/decisions.md.
 */
async function getNotificationCounts(
  user: SessionUser,
  windowStart: Date,
): Promise<{ createdAt: Date }[]> {
  const isAdminGlobal =
    user.role === "ADMIN" &&
    (user.adminScopeMode === null ||
      user.adminScopeMode === undefined ||
      user.adminScopeMode === "GLOBAL");
  const where: Record<string, unknown> = isAdminGlobal
    ? { createdAt: { gte: windowStart } }
    : { userId: user.id, createdAt: { gte: windowStart } };
  return prisma.notification.findMany({
    where,
    select: { createdAt: true },
    take: 10_000,
  });
}

/** Construit le payload complet du dashboard. */
export async function aggregateDashboard(
  user: SessionUser,
  now: Date,
  filters: DashboardFilters,
): Promise<DashboardPayload> {
  const period = filters.period === 90 ? 90 : 30;
  const windowStart = new Date(
    now.getTime() - (period - 1) * DAY_MS,
  );
  windowStart.setHours(0, 0, 0, 0);

  // 1. Échéances (matière brute) — réutilise l'agrégateur Sprint 4.
  //    Sprint 6 C6 : le filtre teamId local est désormais supplanté par
  //    le scope ADMIN persisté (badge header). Les helpers Prisma
  //    (siteScope / actionScope) appliquent déjà la restriction via
  //    C5. On n'a plus rien à passer ici.
  const [
    echeances,
    openActionsCount,
    lateActionsCount,
    activityRows,
    notifRows,
    visitsRows,
    validationsRows,
    teamsAvailable,
  ] = await Promise.all([
    aggregateEcheances(user, now),
    prisma.importedAction.count({
      where: { ...actionScope(user), localStatus: "ACTIVE" },
    }),
    prisma.importedAction.count({
      where: {
        ...actionScope(user),
        localStatus: "ACTIVE",
        dueAt: { not: null, lt: now },
      },
    }),
    prisma.teamActivity.findMany({
      where: { ...teamScope(user), createdAt: { gte: windowStart } },
      select: { createdAt: true },
      take: 10_000,
    }),
    getNotificationCounts(user, windowStart),
    prisma.siteVisit.findMany({
      where: {
        ...teamScope(user),
        status: "completed",
        finishedAt: { gte: windowStart, lte: now },
      },
      select: { finishedAt: true },
      take: 10_000,
    }),
    prisma.actionValidation.findMany({
      where: {
        action: actionScope(user),
        createdAt: { gte: windowStart },
      },
      select: { createdAt: true },
      take: 10_000,
    }),
    getTeamsAvailable(user),
  ]);

  // Items « late » dans le payload Sprint 4 = (urgency=late) — couvre
  // déjà « jamais visité » + « retard ». On les exploite directement.
  const lateItems = echeances.groups.late;

  const kpis: DashboardKpis = {
    criticalCount: echeances.kpis.critical,
    openActions: openActionsCount,
    lateActions: lateActionsCount,
    sitesWithoutQuarterly: countItems(lateItems, "VISIT_QUARTERLY"),
    sitesWithoutPlanned: countItems(lateItems, "VISIT_PLANNED"),
    expiredEquipments: countLateKind(lateItems, "EQUIPMENT_EXPIRING"),
  };

  const series = {
    activity: bucketByDay(activityRows, "createdAt", period, now),
    notifications: bucketByDay(notifRows, "createdAt", period, now),
    visits: bucketByDay(
      visitsRows.map((v) => ({ finishedAt: v.finishedAt })),
      "finishedAt",
      period,
      now,
    ),
    validations: bucketByDay(validationsRows, "createdAt", period, now),
  };

  return {
    // Sprint 6 C6 : teamId neutralisé (le scope ADMIN supplante).
    filters: { period, teamId: null },
    kpis,
    trends: {
      activity: {
        label: "Activité",
        total: series.activity.reduce((a, b) => a + b, 0),
        series: series.activity,
      },
      notifications: {
        label: "Notifications créées",
        total: series.notifications.reduce((a, b) => a + b, 0),
        series: series.notifications,
      },
      visits: {
        label: "Visites réalisées",
        total: series.visits.reduce((a, b) => a + b, 0),
        series: series.visits,
      },
      validations: {
        label: "Actions validées",
        total: series.validations.reduce((a, b) => a + b, 0),
        series: series.validations,
      },
    },
    teamsAvailable,
  };
}

// Helpers exportés pour tests unitaires.
export const __test = { bucketByDay, countItems, countLateKind, ymd };
