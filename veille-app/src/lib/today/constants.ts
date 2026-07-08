/**
 * Constantes métier partagées par l'écran Aujourd'hui (Sprint 2) et le futur
 * Hub Échéances (Sprint 4).
 *
 * Source : règles métier officielles validées par le PO le 2026-06-14.
 *
 * ─── Cadences de visite ────────────────────────────────────────────────────
 *
 * Deux mécanismes INDÉPENDANTS coexistent :
 *
 *   1. Visite trimestrielle réglementaire — 90 jours pour TOUS les sites.
 *      S'applique quel que soit le site, indépendamment de son occupation.
 *
 *   2. Visite planifiée — fréquence variable selon le statut du site :
 *      - Site occupé   → 180 jours (2 visites/an).
 *      - Site inoccupé → 365 jours (1 visite/an).
 *
 * Le statut occupé/inoccupé n'impacte PAS la cadence trimestrielle.
 * Le statut occupé/inoccupé n'impacte QUE les visites planifiées.
 *
 * Ces deux types de visites sont SUIVIS SÉPARÉMENT : un site peut être en
 * retard de visite trimestrielle ET à jour de visite planifiée (ou inverse).
 *
 * ─── Implémentation V1 (Sprint 2) ──────────────────────────────────────────
 *
 * Tant que le champ `Site.isOccupied` n'existe pas dans le schéma Prisma
 * (modélisation prévue avant le Hub Échéances Sprint 4) :
 *   - L'agrégateur utilise `QUARTERLY_VISIT_DAYS` comme heuristique unique
 *     pour la watchlist EDITOR « Sites sans visite ».
 *   - Cela reflète la cadence la plus contraignante (trimestrielle), donc
 *     un site sans visite trimestrielle > 90 j est forcément remonté.
 *   - Les sites occupés qui sont à jour côté trimestrielle mais en retard
 *     planifié ne seront détectés qu'après modélisation du champ.
 */

/** Visite trimestrielle réglementaire — fixe, indépendante du statut occupé/inoccupé. */
export const QUARTERLY_VISIT_DAYS = 90;

/** Visite planifiée d'un site occupé — 2 visites par an. */
export const OCCUPIED_PLANNED_VISIT_DAYS = 180;

/** Visite planifiée d'un site inoccupé — 1 visite par an. */
export const UNOCCUPIED_PLANNED_VISIT_DAYS = 365;

/** Visite S6A7 — cadence annuelle (1 visite par an). */
export const S6A7_VISIT_DAYS = 365;

/**
 * Tolérance de la visite S6A7 : ± 2 mois autour de l'échéance annuelle.
 * Tant que le retard reste dans cette tolérance, la visite n'est pas comptée
 * « en retard » — juste « à réaliser ». Au-delà, retard réel (puis critique).
 */
export const S6A7_TOLERANCE_DAYS = 60;

/**
 * Fréquence par défaut utilisée par l'agrégateur V1 pour détecter « sites
 * sans visite récente ». Calque la cadence trimestrielle (plus contraignante)
 * car le champ `Site.isOccupied` n'est pas encore modélisé. À remplacer par
 * une logique double (trimestrielle ET planifiée) dans le Hub Échéances.
 */
export const DEFAULT_VISIT_FREQUENCY_DAYS = QUARTERLY_VISIT_DAYS;

/**
 * Alias conservé temporairement pour compatibilité ascendante avec les
 * sources C3 déjà écrites. À retirer une fois la double cadence (trimestrielle
 * + planifiée) implémentée.
 * @deprecated Utiliser `OCCUPIED_PLANNED_VISIT_DAYS`.
 */
export const OCCUPIED_SITE_VISIT_DAYS = OCCUPIED_PLANNED_VISIT_DAYS;

/**
 * Alias conservé temporairement pour compatibilité ascendante.
 * @deprecated Utiliser `UNOCCUPIED_PLANNED_VISIT_DAYS`.
 */
export const UNOCCUPIED_SITE_VISIT_DAYS = UNOCCUPIED_PLANNED_VISIT_DAYS;

/**
 * Fenêtre de remontée d'une péremption d'équipement dans Today.
 * Au-delà, l'item n'est pas affiché (l'utilisateur a le temps).
 */
export const EQUIPMENT_EXPIRATION_WINDOW_DAYS = 30;

/** Ancienneté à partir de laquelle un brouillon est rappelé doucement. */
export const STALE_DRAFT_DAYS = 3;

/**
 * Limites d'urgence (en jours par rapport à `now`). Un item est :
 *  - `late`  si dueAt &lt; now ;
 *  - `today` si dueAt entre now et +N(today) jours ;
 *  - `soon`  si dueAt entre +N(today)+1 et +N(soon) jours ;
 *  - `later` si dueAt entre +N(soon)+1 et +N(later) jours ;
 *  - `info`  sinon (ou si pas de dueAt et type informatif).
 */
export const URGENCY_THRESHOLDS = {
  todayMaxDays: 2,
  soonMaxDays: 7,
  laterMaxDays: 30,
} as const;

/**
 * Cadence métier d'une visite — utilisée pour distinguer les retards
 * dans Today et le futur Hub Échéances.
 *  - `quarterly` : 90 j pour TOUS les sites (cadence trimestrielle).
 *  - `planned`   : 180 j si occupé, 365 j si inoccupé.
 *  - `s6a7`      : 365 j (annuel), tolérance ± 2 mois.
 *  - `other`     : autres modèles (INVENTORY, etc.) — non suivis ici.
 */
export type VisitCadenceType = "quarterly" | "planned" | "s6a7" | "other";

/**
 * Convention de nommage actuelle des templates seedés :
 *  - `trimestrielle-*`  → cadence trimestrielle (90 j).
 *  - `planifiee-*`      → cadence planifiée (180/365 j selon Site.isOccupied).
 *  - tout autre slug    → "other" (INVENTORY, templates custom non typés).
 *
 * Pourra évoluer le jour où `SiteVisitTemplate` aura un champ `cadenceType`
 * explicite ; conserver la signature de cette fonction pour faciliter la
 * migration.
 */
export function classifyVisitTemplateSlug(slug: string): VisitCadenceType {
  const s = slug.toLowerCase();
  if (s.startsWith("trimestrielle")) return "quarterly";
  if (s.startsWith("planifiee") || s.startsWith("planifi")) return "planned";
  if (s.startsWith("s6a7")) return "s6a7";
  return "other";
}

/**
 * Cadence applicable à un site pour le type donné, en jours.
 * Trimestrielle = 90 j toujours.
 * Planifiée = 180 j si occupé, 365 j si inoccupé.
 */
export function visitFrequencyDays(
  cadence: VisitCadenceType,
  isOccupied: boolean,
): number {
  if (cadence === "quarterly") return QUARTERLY_VISIT_DAYS;
  if (cadence === "planned") {
    return isOccupied
      ? OCCUPIED_PLANNED_VISIT_DAYS
      : UNOCCUPIED_PLANNED_VISIT_DAYS;
  }
  if (cadence === "s6a7") return S6A7_VISIT_DAYS;
  return DEFAULT_VISIT_FREQUENCY_DAYS;
}
