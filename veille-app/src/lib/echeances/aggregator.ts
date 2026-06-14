/**
 * Agrégateur du Hub Échéances (Sprint 4 C4).
 *
 * Fan-out parallèle des 3 sources C3 + filtres en mémoire + calcul des
 * KPI et des groupes d'urgence (5 valeurs — D3). Renvoie un payload
 * `EcheancesPayload` consommé par la route `/api/echeances` et,
 * indirectement, par Today EDITOR (compteur D13).
 */

import { siteScope, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countCriticalEcheances, filterCriticalEcheances } from "./criticality";
import {
  getActionEcheances,
  getEquipmentEcheances,
  getVisitEcheances,
} from "./sources";
import type {
  EcheanceFilters,
  EcheanceItem,
  EcheanceKpis,
  EcheanceUrgency,
  EcheancesPayload,
} from "./types";
import { groupByUrgency, sortByDueAt } from "./urgency";

/**
 * Renvoie les items critiques (D13) sur le périmètre de l'utilisateur.
 * Utilisé par le compteur Today + le générateur de notifications (S5-C3).
 */
export async function getCriticalEcheancesItems(
  user: SessionUser,
  now: Date,
): Promise<EcheanceItem[]> {
  const [visits, equipments, actions] = await Promise.all([
    getVisitEcheances(user, now),
    getEquipmentEcheances(user, now),
    getActionEcheances(user, now),
  ]);
  return [...visits, ...equipments, ...actions].filter((i) => i.isCritical);
}

/** Liste les équipes accessibles à l'utilisateur — peuple le filtre D5. */
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

/** Liste les sites accessibles à l'utilisateur — peuple le dropdown filtre site. */
async function getSitesAvailable(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  return prisma.site.findMany({
    where: { isActive: true, ...siteScope(user) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}

/**
 * Applique les filtres in-memory à la liste d'items unifiée.
 *
 * - `type` : intersection avec `item.kind`.
 * - `siteId` : `item.context.siteId === siteId`.
 * - `teamId` : au moins un teamId de `item.context.teamIds` doit matcher.
 * - `urgency` : `item.urgency ∈ urgency`. Valeur spéciale `"critical"`
 *    (D13) → garde tous les items avec `isCritical === true`. Si à la
 *    fois `critical` ET d'autres valeurs sont passées, on garde l'union.
 */
function applyFilters(
  items: EcheanceItem[],
  filters: EcheanceFilters,
): EcheanceItem[] {
  let out = items;

  if (filters.type && filters.type.length > 0) {
    const set = new Set(filters.type);
    out = out.filter((i) => set.has(i.kind));
  }

  if (filters.siteId) {
    out = out.filter((i) => i.context.siteId === filters.siteId);
  }

  if (filters.teamId) {
    out = out.filter((i) => i.context.teamIds.includes(filters.teamId!));
  }

  if (filters.urgency && filters.urgency.length > 0) {
    const wantsCritical = filters.urgency.includes("critical");
    const urgencySet = new Set(
      filters.urgency.filter((u) => u !== "critical"),
    );
    out = out.filter(
      (i) =>
        (wantsCritical && i.isCritical) ||
        (urgencySet.size > 0 && urgencySet.has(i.urgency)),
    );
  }

  return out;
}

/**
 * Dédup défensive par `id` composé (`${kind}:${sourceId}`).
 *
 * En pratique, les sources C3 produisent déjà des ids uniques. Ce filet
 * de sécurité couvre les cas futurs où un même item pourrait remonter
 * deux fois via deux relations (ex. action visible via agent ET via
 * site dans `actionScope`).
 */
function dedupById(items: EcheanceItem[]): EcheanceItem[] {
  const seen = new Set<string>();
  const out: EcheanceItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function computeKpis(items: EcheanceItem[]): EcheanceKpis {
  const kpis: EcheanceKpis = {
    late: 0,
    today: 0,
    soon: 0,
    later: 0,
    future: 0,
    critical: 0,
  };
  for (const item of items) {
    kpis[item.urgency]++;
    if (item.isCritical) kpis.critical++;
  }
  return kpis;
}

/**
 * Construit le payload du Hub Échéances pour le user courant.
 *
 * Les KPI et les `groups` sont calculés APRÈS l'application des filtres
 * (le KPI affiché reflète ce que l'utilisateur voit dans la liste).
 * `criticalItems` est exposé séparément pour permettre l'UI « critiques
 * uniquement » sans recalcul côté client.
 */
export async function aggregateEcheances(
  user: SessionUser,
  now: Date,
  filters: EcheanceFilters = {},
): Promise<EcheancesPayload> {
  const [visits, equipments, actions, teamsAvailable, sitesAvailable] =
    await Promise.all([
      getVisitEcheances(user, now, filters.siteId),
      getEquipmentEcheances(user, now, filters.siteId),
      getActionEcheances(user, now, filters.siteId),
      getTeamsAvailable(user),
      getSitesAvailable(user),
    ]);

  const allItems = dedupById([...visits, ...equipments, ...actions]);
  const filtered = applyFilters(allItems, filters);

  const groupsRaw = groupByUrgency(filtered);
  const groups: Record<EcheanceUrgency, EcheanceItem[]> = {
    late: sortByDueAt(groupsRaw.late),
    today: sortByDueAt(groupsRaw.today),
    soon: sortByDueAt(groupsRaw.soon),
    later: sortByDueAt(groupsRaw.later),
    future: sortByDueAt(groupsRaw.future),
  };

  return {
    now: now.toISOString(),
    kpis: computeKpis(filtered),
    groups,
    criticalItems: sortByDueAt(filterCriticalEcheances(filtered)),
    total: filtered.length,
    filtersApplied: filters,
    teamsAvailable,
    sitesAvailable,
  };
}

/**
 * Compteur synthétique « X échéances critiques » utilisé par Today
 * EDITOR (C7). Pas de filtre — uniquement le périmètre total user.
 * Une seule passe sur les 3 sources, sans `teamsAvailable`.
 */
export async function getCriticalEcheancesCount(
  user: SessionUser,
  now: Date,
): Promise<number> {
  const items = await getCriticalEcheancesItems(user, now);
  return countCriticalEcheances(items);
}
