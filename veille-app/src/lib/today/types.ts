/**
 * Types partagés par l'écran Aujourd'hui (Sprint 2) et le futur Hub Échéances.
 *
 * Conçus pour être consommés par :
 *  - l'agrégateur serveur (C3) qui assemble les items depuis Prisma ;
 *  - l'algorithme de priorisation (C2) qui scorre/ trie ;
 *  - les composants UI (C4-C10) qui rendent les cartes.
 */

/** Catégories d'urgence affichées (couleur + label). */
export type Urgency = "late" | "today" | "soon" | "later" | "info";

/**
 * Type d'item agrégé dans la section « À traiter aujourd'hui ».
 * Étendre cette union au fil des nouvelles sources (Hub Échéances Sprint 4).
 */
export type TodoItemType =
  | "ACTION"
  | "VISIT_OVERDUE"
  | "VISIT_DUE_SOON"
  | "EQUIPMENT_EXPIRING"
  | "DRAFT_REMINDER";

/** Rôle utilisateur (réplique de l'enum Prisma, sans dépendance directe). */
export type Role = "USER" | "EDITOR" | "ADMIN";

/** Action contextuelle exposée sur la carte. */
export type TodoCta = {
  label: string;
  href: string;
};

/** Contexte métier optionnel utilisé pour le tri et l'affichage. */
export type TodoContext = {
  siteId?: string;
  siteName?: string;
  agentId?: string;
  agentName?: string;
  teamId?: string;
};

/**
 * Item brut produit par l'agrégateur, avant scoring.
 * Identifiant composé du type et de l'id source pour éviter les collisions
 * entre sources différentes : `action:abc`, `visit:xyz`, `equipment:pq`.
 */
export type TodoItem = {
  id: string;
  sourceType: TodoItemType;
  sourceId: string;
  title: string;
  subtitle?: string;
  /** Échéance métier (null si l'item n'a pas de date — ex. brouillon). */
  dueAt: Date | null;
  context?: TodoContext;
  /** Utilisateur explicitement assigné (V2+) — null en V1. */
  assignedToUserId?: string | null;
  cta: TodoCta;
};

/** Item enrichi du score et de la classification d'urgence. */
export type ScoredItem = TodoItem & {
  score: number;
  urgency: Urgency;
};

/** Ligne d'activité récente (3-5 lignes informationnelles non cliquables). */
export type RecentActivityItem = {
  id: string;
  at: Date;
  label: string;
};

/**
 * Contexte de scoring transmis à l'algorithme.
 * `now` est injecté pour permettre des tests déterministes.
 */
export type ScoreContext = {
  user: { id: string; teamIds: string[] };
  now: Date;
};
