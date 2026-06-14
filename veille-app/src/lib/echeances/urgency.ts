/**
 * Helpers d'urgence pour les échéances (Sprint 4 C2).
 *
 * Réutilise `URGENCY_THRESHOLDS` (today/constants) pour rester aligné
 * avec les libellés "aujourd'hui / bientôt / plus tard" déjà connus de
 * l'écran Today.
 */

import { URGENCY_THRESHOLDS } from "@/lib/today/constants";
import type { EcheanceItem, EcheanceUrgency } from "./types";

/**
 * Mappe un nombre de jours jusqu'à l'échéance vers une classe d'urgence.
 *
 * - `null` → `"late"` (cas « jamais visité » : on remonte d'office ce
 *   site comme en retard, conformément à `memory/business-rules.md`).
 * - `< 0`  → `"late"`
 * - `≤ todayMaxDays` (2) → `"today"`
 * - `≤ soonMaxDays`  (7) → `"soon"`
 * - `≤ laterMaxDays` (30) → `"later"`
 * - sinon → `"future"` (D3 — nouveau groupe Sprint 4)
 */
export function classifyEcheanceUrgency(
  daysToDue: number | null,
): EcheanceUrgency {
  if (daysToDue === null) return "late";
  if (daysToDue < 0) return "late";
  if (daysToDue <= URGENCY_THRESHOLDS.todayMaxDays) return "today";
  if (daysToDue <= URGENCY_THRESHOLDS.soonMaxDays) return "soon";
  if (daysToDue <= URGENCY_THRESHOLDS.laterMaxDays) return "later";
  return "future";
}

/**
 * Construit un objet à 5 clés (ordre des urgences) regroupant les items.
 * Les clés sont toujours présentes (tableau vide si aucun item).
 */
export function groupByUrgency(
  items: EcheanceItem[],
): Record<EcheanceUrgency, EcheanceItem[]> {
  const out: Record<EcheanceUrgency, EcheanceItem[]> = {
    late: [],
    today: [],
    soon: [],
    later: [],
    future: [],
  };
  for (const item of items) out[item.urgency].push(item);
  return out;
}

/**
 * Tri stable ASC par `dueAt`. Les items à `dueAt = null` (cas « jamais »)
 * passent en tête — pratique pour les visites jamais effectuées qu'on
 * veut voir en premier dans le groupe `late`.
 */
export function sortByDueAt(items: EcheanceItem[]): EcheanceItem[] {
  return [...items].sort((a, b) => {
    if (a.dueAt === null && b.dueAt === null) return 0;
    if (a.dueAt === null) return -1;
    if (b.dueAt === null) return 1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}
