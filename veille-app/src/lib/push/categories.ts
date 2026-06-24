/**
 * Mapping `NotificationType` → catégorie de préférence push (C6).
 *
 * Convention V1 — seules 2 catégories existent côté schéma Prisma :
 *  - `catEcheances` : ECHEANCE_CRITICAL_ON_MY_PERIMETER
 *  - `catEquipes`   : TEAM_MEMBERSHIP_ADDED (nouveau type, branché en C9)
 *
 * Tout type non mappé ici → AUCUN push V1. C'est volontaire :
 * `ACTION_*` et `VISIT_*` resteront in-app jusqu'à une décision produit
 * explicite. Aucun branchement implicite à `default`.
 */

import type { NotificationPreference } from "@prisma/client";

/**
 * Sous-ensemble de `NotificationPreference` correspondant aux catégories
 * V1. Aligné sur les booléens du schéma Prisma.
 */
export type PushCategoryKey = Extract<
  keyof NotificationPreference,
  "catEcheances" | "catEquipes"
>;

/** Liste exhaustive des catégories actives pour le push V1. */
export const PUSH_CATEGORY_KEYS: readonly PushCategoryKey[] = [
  "catEcheances",
  "catEquipes",
] as const;

/**
 * Mapping type → catégorie. Les `NotificationType` non listés ne sont
 * pas poussés en V1. Utiliser des string keys plutôt que le type union
 * `NotificationType` permet d'inclure des types pas encore déclarés
 * (cf. `TEAM_MEMBERSHIP_ADDED` ajouté en C9).
 *
 * TEAM_HISTORY_ADDED utilise catEquipes : volume élevé attendu (1
 * notif par membre et par event de recordActivity, parmi 9 types),
 * désactivable individuellement par chaque user dans
 * `/account/notifications` si trop bruyant.
 */
const CATEGORY_BY_TYPE: Readonly<Record<string, PushCategoryKey>> = {
  ECHEANCE_CRITICAL_ON_MY_PERIMETER: "catEcheances",
  TEAM_MEMBERSHIP_ADDED: "catEquipes",
  TEAM_HISTORY_ADDED: "catEquipes",
} as const;

/**
 * Renvoie la catégorie push associée à un type de notification, ou
 * `null` si le type n'est pas mappé (= pas de push V1).
 */
export function getCategoryForType(
  type: string,
): PushCategoryKey | null {
  return CATEGORY_BY_TYPE[type] ?? null;
}
