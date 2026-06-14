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

// ─── Payloads de l'écran Aujourd'hui (consommés par l'UI C4-C10) ─────────────

/** Travail en cours (carte sticky « EN COURS » pour USER). */
export type CurrentWork = {
  kind: "session" | "visit";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  startedAt: Date;
  /** Brouillon dont la dernière modification dépasse `STALE_DRAFT_DAYS`. */
  isStale: boolean;
};

/** Variante USER (cf. TODAY-V1.md §4). */
export type UserPayload = {
  role: "USER";
  /** ISO 8601 — `now` côté serveur, utilisé par l'UI pour l'emoji et la date. */
  now: string;
  greeting: {
    name: string;
    teamName: string | null;
  };
  current: CurrentWork | null;
  todoList: ScoredItem[];
  /** Nombre total d'items éligibles (avant `slice(limit)`) pour « Voir tous ». */
  todoTotal: number;
  recent: RecentActivityItem[];
};

/** Bannière diagnostic EDITOR (cf. TODAY-V1.md §5.4 B). */
export type EditorDiagnostic = {
  state: "green" | "yellow" | "red";
  /** Actions ACTIVE dont la dueAt est dépassée de plus de 7 jours. */
  lateActions7d: number;
  /** Sites sans visite trimestrielle depuis > 90 j (heuristique V1). */
  lateVisits: number;
  /** Équipements dont expirationDate &lt; today (déjà périmés). */
  expiredEquipments: number;
  /** Équipements expirant dans les 30 prochains jours (à surveiller). */
  expiringEquipments: number;
};

/** Compteurs hebdo simples — pas de ratio/objectif en V1 (décision PO). */
export type EditorWeekCounters = {
  visits: number;
  sessions: number;
  closedActions: number;
};

/** Ligne d'une watchlist (agent ou site). */
export type WatchlistItem = {
  id: string;
  name: string;
  /** Jours depuis la dernière activité (null si jamais). */
  daysSince: number | null;
  /** Niveau visuel (rouge / orange / jaune) calculé côté serveur. */
  level: "red" | "orange" | "yellow";
  cta: TodoCta;
  /**
   * Compteurs contextuels — purement informatifs, n'entrent pas dans le
   * tri principal (qui reste basé sur daysSince).
   */
  badges?: {
    /** Actions ImportedAction encore ACTIVE liées à cet item. */
    openActions?: number;
    /** Équipements périmés OU expirant ≤ 30 j sur le site. */
    equipmentAlerts?: number;
  };
};

/** Variante EDITOR (cf. TODAY-V1.md §5). */
export type EditorPayload = {
  role: "EDITOR";
  now: string;
  tour: {
    perimeter: {
      teamsCount: number;
      sitesCount: number;
      agentsCount: number;
    };
  };
  diagnostic: EditorDiagnostic;
  weekCounters: EditorWeekCounters;
  agentsToReview: WatchlistItem[];
  agentsToReviewTotal: number;
  sitesWithoutVisit: WatchlistItem[];
  sitesWithoutVisitTotal: number;
};

/** Alerte système ADMIN. */
export type AdminAlert = {
  id: string;
  level: "ok" | "warn" | "error";
  label: string;
  href?: string;
};

/** Compteurs d'usage 7 derniers jours (ADMIN). */
export type AdminUsage = {
  sessions: number;
  visits: number;
  validatedActions: number;
  photos: number;
};

/** Variante ADMIN (cf. TODAY-V1.md §6). */
export type AdminPayload = {
  role: "ADMIN";
  now: string;
  systemStatus: {
    state: "ok" | "degraded" | "incident";
    usersCount: number;
    teamsCount: number;
    lastBackupAt: Date | null;
  };
  alerts: AdminAlert[];
  usage7d: AdminUsage;
  recentActivity: RecentActivityItem[];
};

/** Union — le payload renvoyé par `GET /api/today` selon `user.role`. */
export type TodayPayload = UserPayload | EditorPayload | AdminPayload;
