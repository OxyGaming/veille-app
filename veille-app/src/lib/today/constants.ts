/**
 * Constantes métier partagées par l'écran Aujourd'hui (Sprint 2) et le futur
 * Hub Échéances (Sprint 4).
 *
 * Source : décisions PO Sprint 2 (cf. TODAY-V1.md §7, SPRINT2-PLAN.md §0).
 */

/** Visite trimestrielle réglementaire — toutes les 13 semaines. */
export const QUARTERLY_VISIT_DAYS = 90;

/** Visite planifiée d'un site occupé — 2 fois par an. */
export const OCCUPIED_SITE_VISIT_DAYS = 180;

/** Visite planifiée d'un site inoccupé — 1 fois par an. */
export const UNOCCUPIED_SITE_VISIT_DAYS = 365;

/**
 * Fréquence par défaut quand on ne dispose pas du template lié au site
 * ni de l'attribut occupé/inoccupé (champ non encore modélisé). On reste
 * conservateur en utilisant la cadence trimestrielle.
 */
export const DEFAULT_VISIT_FREQUENCY_DAYS = QUARTERLY_VISIT_DAYS;

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
