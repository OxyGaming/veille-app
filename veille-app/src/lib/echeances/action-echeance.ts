/**
 * Classification canonique de l'état d'échéance d'une action « À traiter ».
 *
 * Source de vérité unique des seuils et libellés — cf.
 * docs/NOMENCLATURE-ECHEANCES.md. Toute page (Today, Échéances, fiches, stats)
 * doit dériver ses libellés/couleurs d'ici, jamais recalculer un seuil ad hoc.
 *
 * Règle (vs « aujourd'hui 00:00 », fuseau Europe/Paris — le serveur tourne en
 * Europe/Paris, cf. today/planning.ts) :
 *  - NO_DUE_DATE       : dueAt absente.
 *  - OVERDUE_CRITICAL  : dueAt < aujourd'hui 00:00 − 7 j  (en retard de PLUS de 7 j).
 *  - OVERDUE           : dueAt < aujourd'hui 00:00         (inclut le critique).
 *  - DUE_SOON          : aujourd'hui 00:00 ≤ dueAt ≤ fin du 7ᵉ jour suivant.
 *  - SCHEDULED         : dueAt > fin du 7ᵉ jour suivant    (« Planifiée », sans alerte).
 *
 * Pur : aucune I/O. Les requêtes Prisma de comptage utilisent les bornes
 * exportées (`startOfEcheanceDay`, `criticalThreshold`).
 */
import { addDays, endOfDay, startOfDay, subDays } from "date-fns";

/** Fenêtre « À venir » : échéance dans les 7 prochains jours. */
export const DUE_SOON_DAYS = 7;
/** Seuil « En retard critique » : en retard de plus de 7 jours. */
export const OVERDUE_CRITICAL_DAYS = 7;

export type ActionEcheanceState =
  | "OVERDUE_CRITICAL"
  | "OVERDUE"
  | "DUE_SOON"
  | "SCHEDULED"
  | "NO_DUE_DATE";

/** Libellés FR canoniques (nomenclature figée). */
export const ACTION_ECHEANCE_LABEL: Record<ActionEcheanceState, string> = {
  OVERDUE_CRITICAL: "En retard critique",
  OVERDUE: "En retard",
  DUE_SOON: "À venir",
  SCHEDULED: "Planifiée",
  NO_DUE_DATE: "Sans échéance",
};

/** Début de la journée courante (00:00) — borne unique des calculs d'échéance. */
export function startOfEcheanceDay(now: Date): Date {
  return startOfDay(now);
}

/** Borne « en retard critique » : aujourd'hui 00:00 − 7 j. */
export function criticalThreshold(now: Date): Date {
  return subDays(startOfDay(now), OVERDUE_CRITICAL_DAYS);
}

/** Fin de la fenêtre « À venir » : fin du 7ᵉ jour suivant (23:59:59.999). */
export function dueSoonEnd(now: Date): Date {
  return endOfDay(addDays(startOfDay(now), DUE_SOON_DAYS));
}

/**
 * Bornes temporelles d'échéance résolues une seule fois (à partir d'un `now`).
 * Ce sont des INSTANTS absolus → réutilisables côté client sans dépendre de
 * l'horloge ni du fuseau du navigateur : le calcul du badge reste identique à
 * celui des compteurs serveur quand on partage ces mêmes bornes.
 */
export type EcheanceBounds = {
  /** Aujourd'hui 00:00. */
  today0: Date;
  /** Aujourd'hui 00:00 − 7 j (seuil « critique »). */
  critical0: Date;
  /** Fin du 7ᵉ jour suivant (borne haute « à venir »). */
  dueSoonEnd: Date;
};

/** Forme sérialisable (ISO) pour passer les bornes d'un RSC à un composant client. */
export type SerializedEcheanceBounds = {
  today0: string;
  critical0: string;
  dueSoonEnd: string;
};

export function echeanceBounds(now: Date): EcheanceBounds {
  return {
    today0: startOfEcheanceDay(now),
    critical0: criticalThreshold(now),
    dueSoonEnd: dueSoonEnd(now),
  };
}

export function serializeEcheanceBounds(b: EcheanceBounds): SerializedEcheanceBounds {
  return {
    today0: b.today0.toISOString(),
    critical0: b.critical0.toISOString(),
    dueSoonEnd: b.dueSoonEnd.toISOString(),
  };
}

export function deserializeEcheanceBounds(s: SerializedEcheanceBounds): EcheanceBounds {
  return {
    today0: new Date(s.today0),
    critical0: new Date(s.critical0),
    dueSoonEnd: new Date(s.dueSoonEnd),
  };
}

/**
 * État d'échéance d'une action À TRAITER à partir de bornes déjà résolues.
 * Variante pure et déterministe (aucun `now`/`startOfDay` interne) — c'est elle
 * qu'utilise le client, avec les bornes calculées par le serveur.
 */
export function actionEcheanceStateAt(
  dueAt: Date | null | undefined,
  bounds: EcheanceBounds,
): ActionEcheanceState {
  if (!dueAt) return "NO_DUE_DATE";
  const t = dueAt.getTime();
  if (t < bounds.critical0.getTime()) return "OVERDUE_CRITICAL";
  if (t < bounds.today0.getTime()) return "OVERDUE";
  if (t <= bounds.dueSoonEnd.getTime()) return "DUE_SOON";
  return "SCHEDULED";
}

/**
 * État d'échéance d'une action À TRAITER (localStatus = ACTIVE).
 * Ne pas appeler pour une action validée/obsolète/remplacée (pas d'échéance).
 */
export function actionEcheanceState(
  dueAt: Date | null | undefined,
  now: Date,
): ActionEcheanceState {
  return actionEcheanceStateAt(dueAt, echeanceBounds(now));
}

/** `true` si l'état est un retard (en retard ou en retard critique). */
export function isOverdue(state: ActionEcheanceState): boolean {
  return state === "OVERDUE" || state === "OVERDUE_CRITICAL";
}
