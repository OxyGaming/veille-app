/**
 * Types pivot du Hub Échéances (Sprint 4 C2).
 *
 * Une **échéance** est un point dans le temps où une action est due :
 *  - une visite trimestrielle ou planifiée (sur la base de `Site.isOccupied`
 *    et des cadences `memory/business-rules.md`),
 *  - un équipement qui expire,
 *  - une action ouverte avec date d'échéance.
 *
 * Distinct de `TodoItem` (today) : l'`EcheanceItem` couvre les échéances
 * passées comme futures, alors que `TodoItem` est centré sur l'opérationnel
 * du jour.
 */

/** Catégorie de l'échéance. */
export type EcheanceKind =
  | "VISIT_QUARTERLY"
  | "VISIT_PLANNED"
  | "VEHICLE_ROUND"
  | "EQUIPMENT_EXPIRING"
  | "ACTION_OVERDUE";

/**
 * Groupes d'urgence (D3 — 5 valeurs).
 * L'ordre de la déclaration matérialise aussi l'ordre d'affichage du Hub.
 */
export type EcheanceUrgency =
  | "late" // < 0 jours (en retard) OU dueAt = null pour les visites
  | "today" // ≤ 2 jours
  | "soon" // ≤ 7 jours
  | "later" // ≤ 30 jours
  | "future"; // > 30 jours

/** Contexte d'affichage et de filtre. */
export type EcheanceContext = {
  siteId?: string;
  siteName?: string;
  siteIsOccupied?: boolean;
  agentId?: string;
  agentName?: string;
  /** Véhicule cible — pour les échéances de tournée VS. */
  vehicleId?: string;
  vehicleImmat?: string;
  /** Équipe(s) propriétaires — utilisé par filtre D5 et scope check. */
  teamIds: string[];
};

/** Call-to-action — lecture seule (D11). */
export type EcheanceCta = {
  label: string;
  href: string;
};

/**
 * Item pivot du Hub Échéances. Consommé par l'agrégateur, l'UI, le
 * drilldown site et le compteur Today.
 */
export type EcheanceItem = {
  /** Identifiant composite stable : `${kind}:${sourceId}`. */
  id: string;
  kind: EcheanceKind;
  /** Libellé court (« Trimestrielle » / « Extincteur EXT-12 »). */
  title: string;
  /** Contexte secondaire optionnel (site, agent…). */
  subtitle?: string;
  /** Date d'échéance — `null` pour les visites jamais effectuées. */
  dueAt: Date | null;
  /**
   * Jours jusqu'à l'échéance. `< 0` = en retard. `null` mappe sur `late`
   * via `classifyEcheanceUrgency`.
   */
  daysToDue: number | null;
  urgency: EcheanceUrgency;
  /** D13 — précalculé à l'agrégation (cf. `isCriticalEcheance`). */
  isCritical: boolean;
  /**
   * Lot 4B-2 — nombre d'occurrences physiques regroupées sous cet item
   * (actions dédupliquées via `dedupActions`). 1 pour les items non
   * dédupliqués (visites, équipements, tournées). Sert au badge « ×N ».
   */
  occurrenceCount?: number;
  /** Ids des occurrences regroupées (préparation expansion serveur Lot 4B-3). */
  memberIds?: string[];
  context: EcheanceContext;
  cta: EcheanceCta;
};

/**
 * Compteurs de tête du Hub (et compteur synthétique « critiques » pour
 * Today EDITOR). Le critique est transverse à urgency (cf. D13).
 */
export type EcheanceKpis = {
  late: number;
  today: number;
  soon: number;
  later: number;
  future: number;
  critical: number;
};

/** Filtres acceptés par l'agrégateur (cf. C4). */
export type EcheanceFilters = {
  type?: EcheanceKind[];
  siteId?: string;
  teamId?: string;
  /** `"critical"` est une valeur transverse (D13). */
  urgency?: (EcheanceUrgency | "critical")[];
};

/** Payload renvoyé par `/api/echeances` (cf. C4). */
export type EcheancesPayload = {
  now: string;
  kpis: EcheanceKpis;
  /** Items regroupés par urgence — 5 clés présentes même si vides. */
  groups: Record<EcheanceUrgency, EcheanceItem[]>;
  /** Sous-ensemble transverse pour `?urgency=critical`. */
  criticalItems: EcheanceItem[];
  total: number;
  filtersApplied: EcheanceFilters;
  /** Équipes du périmètre — pour peupler le dropdown filtre équipe. */
  teamsAvailable: { id: string; name: string }[];
  /** Sites du périmètre — pour peupler le dropdown filtre site. */
  sitesAvailable: { id: string; name: string }[];
};
