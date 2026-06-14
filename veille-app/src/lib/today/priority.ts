/**
 * Algorithme de priorisation V1 — fonction pure, sans dépendance Prisma.
 *
 * Conçu pour être réutilisé tel quel par le futur Hub Échéances (Sprint 4).
 * L'agrégateur lui passe une liste d'items et un contexte (user + now), il
 * renvoie la même liste enrichie d'un `score` et triée.
 *
 * Formule (cf. TODAY-V1.md §7.2) :
 *   score = (typeWeight + urgencyWeight + boostRetard) * ownershipMultiplier
 *
 * Tie-break stable :
 *   1. score DESC
 *   2. dueAt ASC (items datés en premier)
 *   3. id alphabétique
 */

import {
  URGENCY_THRESHOLDS,
} from "./constants";
import type {
  ScoreContext,
  ScoredItem,
  TodoItem,
  TodoItemType,
  Urgency,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Poids par catégorie d'urgence (cf. TODAY-V1.md §7.2). */
const URGENCY_WEIGHTS: Record<Urgency, number> = {
  late: 100,
  today: 70,
  soon: 30,
  later: 10,
  info: 0,
};

/**
 * Poids par type d'item. Reflète la priorité métier : les actions
 * réglementaires passent avant les brouillons.
 */
const TYPE_WEIGHTS: Record<TodoItemType, number> = {
  ACTION: 100,
  VISIT_OVERDUE: 90,
  EQUIPMENT_EXPIRING: 70,
  VISIT_DUE_SOON: 60,
  DRAFT_REMINDER: 20,
};

/** Multiplicateurs d'appartenance — réglés pour donner du poids à l'assigné. */
const OWNERSHIP_MULTIPLIER = {
  ASSIGNED_TO_ME: 1.5,
  ON_MY_TEAM: 1.0,
  CROSS_TEAM: 0.7,
} as const;

/** Bonus appliqué quand le retard se prolonge — rend la dette visible. */
const LATE_BOOSTS = {
  moreThanWeek: 30,
  withinWeek: 20,
} as const;

/**
 * Différence en jours pleins (entiers) entre `to` et `from`.
 * Tronque vers le bas — `floor` est intentionnel pour que l'élément
 * « dû à 23h59 hier » soit classé `late` même si la diff est de -0.04 j.
 */
export function diffInDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Classifie l'urgence d'un item. Le `type` sert uniquement à choisir entre
 * `info` et `later` quand `dueAt` est null.
 */
export function classifyUrgency(
  dueAt: Date | null,
  now: Date,
  type: TodoItemType,
): Urgency {
  if (!dueAt) {
    return type === "DRAFT_REMINDER" ? "info" : "later";
  }
  const days = diffInDays(now, dueAt);
  if (days < 0) return "late";
  if (days <= URGENCY_THRESHOLDS.todayMaxDays) return "today";
  if (days <= URGENCY_THRESHOLDS.soonMaxDays) return "soon";
  if (days <= URGENCY_THRESHOLDS.laterMaxDays) return "later";
  return "info";
}

/** Bonus de score pour retard prolongé. */
export function lateBoost(dueAt: Date | null, now: Date): number {
  if (!dueAt) return 0;
  const days = diffInDays(now, dueAt);
  if (days <= -7) return LATE_BOOSTS.moreThanWeek;
  if (days < 0) return LATE_BOOSTS.withinWeek;
  return 0;
}

/**
 * Multiplicateur d'appartenance — l'item m'est attribué &gt; mon équipe
 * &gt; une autre équipe que je peux voir (cross-team via viewAllTeams).
 */
export function ownershipMultiplier(
  item: TodoItem,
  user: { id: string; teamIds: string[] },
): number {
  if (item.assignedToUserId && item.assignedToUserId === user.id) {
    return OWNERSHIP_MULTIPLIER.ASSIGNED_TO_ME;
  }
  const teamId = item.context?.teamId;
  if (teamId && user.teamIds.includes(teamId)) {
    return OWNERSHIP_MULTIPLIER.ON_MY_TEAM;
  }
  return OWNERSHIP_MULTIPLIER.CROSS_TEAM;
}

/** Calcule le score d'un item et l'annote de sa classe d'urgence. */
export function scoreItem(item: TodoItem, ctx: ScoreContext): ScoredItem {
  const urgency = classifyUrgency(item.dueAt, ctx.now, item.sourceType);
  const base = TYPE_WEIGHTS[item.sourceType] + URGENCY_WEIGHTS[urgency];
  const boost = lateBoost(item.dueAt, ctx.now);
  const multiplier = ownershipMultiplier(item, ctx.user);
  const score = Math.round((base + boost) * multiplier);
  return { ...item, score, urgency };
}

/**
 * Trie une liste d'items par priorité décroissante. Stable et déterministe
 * (tie-break id alphabétique) pour faciliter les tests et l'UX.
 */
export function sortItems(items: TodoItem[], ctx: ScoreContext): ScoredItem[] {
  return items
    .map((item) => scoreItem(item, ctx))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.dueAt && b.dueAt) {
        const delta = a.dueAt.getTime() - b.dueAt.getTime();
        if (delta !== 0) return delta;
      } else if (a.dueAt) {
        return -1;
      } else if (b.dueAt) {
        return 1;
      }
      return a.id.localeCompare(b.id);
    });
}

/** Sucre syntaxique — top N items triés. */
export function topItems(
  items: TodoItem[],
  ctx: ScoreContext,
  limit: number,
): ScoredItem[] {
  return sortItems(items, ctx).slice(0, limit);
}
