/**
 * Notion transverse de « critique » (D13 — Sprint 4 C2).
 *
 * Définition validée par le PO (cf. SPRINT4-PLAN.md §0.2) :
 *
 *   | Type                 | Critique                              |
 *   | -------------------- | ------------------------------------- |
 *   | Action               | retard > 7 jours                      |
 *   | Visite trimestrielle | retard > 30 jours OU jamais effectuée |
 *   | Visite planifiée     | retard > 30 jours OU jamais effectuée |
 *   | Équipement           | déjà expiré                           |
 *
 * Ce helper est SÉPARÉ de `classifyEcheanceUrgency` : un item peut être
 * `late` sans être critique (action 5 j de retard), et il ne peut jamais
 * être critique sans être au moins `late`.
 *
 * Réutilisé par :
 *  - le Hub Échéances (KPI dédié + filtre `?urgency=critical`),
 *  - l'indicateur « X échéances critiques » du Today EDITOR (C7),
 *  - futurs dashboards V2+.
 */

import type { EcheanceItem, EcheanceKind } from "./types";

/** Seuil critique en jours pour les actions ouvertes (D13). */
export const ACTION_CRITICAL_THRESHOLD_DAYS = 7;

/** Seuil critique en jours pour les visites (trim et plan). */
export const VISIT_CRITICAL_THRESHOLD_DAYS = 30;

/**
 * Renvoie `true` si l'échéance est critique au sens D13.
 *
 * N'utilise QUE `kind` et `daysToDue` — peut être appelé sur un item
 * incomplet (ex. depuis Today EDITOR avant l'enrichissement complet).
 */
export function isCriticalEcheance(
  item: Pick<EcheanceItem, "kind" | "daysToDue">,
): boolean {
  const { kind, daysToDue } = item;

  switch (kind) {
    case "ACTION_OVERDUE":
      // Pas d'échéance → pas critique (action sans dueAt = non échéance).
      if (daysToDue === null) return false;
      return daysToDue < -ACTION_CRITICAL_THRESHOLD_DAYS;

    case "VISIT_QUARTERLY":
    case "VISIT_PLANNED":
      // « Jamais visité » est critique par convention (cf. memory).
      if (daysToDue === null) return true;
      return daysToDue < -VISIT_CRITICAL_THRESHOLD_DAYS;

    case "EQUIPMENT_EXPIRING":
      // « Pas d'expiration » (équipement non périssable) = non critique.
      if (daysToDue === null) return false;
      return daysToDue < 0;

    default: {
      // Garde-fou exhaustivité TypeScript.
      const _exhaustive: never = kind;
      void _exhaustive;
      return false;
    }
  }
}

/** Compte les items critiques dans une liste. */
export function countCriticalEcheances(items: EcheanceItem[]): number {
  let n = 0;
  for (const item of items) if (item.isCritical) n++;
  return n;
}

/** Filtre les items critiques (sous-ensemble pour `?urgency=critical`). */
export function filterCriticalEcheances(items: EcheanceItem[]): EcheanceItem[] {
  return items.filter((i) => i.isCritical);
}

/**
 * Garde-fou typé : `kind` doit appartenir aux 4 valeurs gérées.
 * Utile dans l'agrégateur quand on lit des données externes.
 */
export function isKnownEcheanceKind(value: string): value is EcheanceKind {
  return (
    value === "VISIT_QUARTERLY" ||
    value === "VISIT_PLANNED" ||
    value === "EQUIPMENT_EXPIRING" ||
    value === "ACTION_OVERDUE"
  );
}
