/**
 * Déduplication des actions — BRIQUE MÉTIER CENTRALE (Lot 4B-1).
 *
 * Unique point d'entrée du regroupement logique des `ImportedAction`. Tous les
 * écrans (fiches, Hub Échéances, Stats, Dashboard, admin/actions) devront passer
 * par ici plutôt que de reconstruire `teamId` / `targetType` / `targetId` /
 * `dedupHash` à la main.
 *
 * Garanties (cf. docs/DEDUP-ACTIONS-AUDIT.md) :
 *  - PUR : aucune dépendance Prisma / Next.js, aucune requête, aucun accès DB,
 *    aucune lecture de session. Reçoit une liste, renvoie des groupes.
 *  - DÉTERMINISTE : même entrée (à l'ordre près) ⇒ même sortie (groupes triés,
 *    représentant stable).
 *
 * Clé de regroupement (règle validée) :
 *     targetType | targetId | teamId | (dedupHash ?? id)
 *  - on ne fusionne JAMAIS deux cibles différentes (agent/site/véhicule) ;
 *  - une action sans `dedupHash` reste seule (`dedupHash ?? id` ⇒ clé unique) ;
 *  - `teamId` sépare deux contenus identiques d'équipes propriétaires distinctes.
 */

/** Type de cible d'une action. `none` = aucune cible ⇒ jamais collapsée. */
export type TargetType = "agent" | "site" | "vehicle" | "none";

/** Statuts de cycle de vie canoniques (cf. docs/NOMENCLATURE-ECHEANCES.md). */
export type LocalStatus = "ACTIVE" | "VALIDATED_LOCAL" | "OBSOLETE" | "REPLACED";

/** Anomalies détectées dans un groupe (préparation des écrans futurs). */
export type DedupAnomaly = "MIXED_STATE" | "MIXED_DUE_DATE" | "MIXED_OWNER";

/**
 * Forme MINIMALE acceptée en entrée — structurelle, jamais couplée à Prisma.
 * Le helper est générique : il préserve le type concret du caller (`A`) pour
 * `representative` / `members`, afin que chaque écran récupère ses champs.
 */
export interface DedupActionInput {
  id: string;
  teamId: string;
  agentId?: string | null;
  siteId?: string | null;
  vehicleId?: string | null;
  dedupHash?: string | null;
  /** Statut courant — typé `string` pour ne pas présumer des valeurs en base. */
  localStatus: string;
  /** Échéance — accepte `Date` (serveur) ou ISO `string` (client) ou null. */
  dueAt?: Date | string | null;
}

/** Un groupe logique = UNE action métier, regroupant ses occurrences. */
export interface DedupGroup<A extends DedupActionInput = DedupActionInput> {
  /** Clé unique calculée une seule fois — à réutiliser partout. */
  groupKey: string;
  /** Occurrence représentante (échéance la plus proche, tie-break id croissant). */
  representative: A;
  /** Toutes les occurrences, triées de façon déterministe. */
  members: A[];
  /** Ids des occurrences (ordre = `members`). */
  memberIds: string[];
  /** Nombre d'occurrences physiques. */
  occurrenceCount: number;
  /** Toujours 1 : un groupe = une action logique. */
  logicalCount: 1;
  /** `true` si le groupe regroupe plus d'une occurrence. */
  isDuplicated: boolean;

  // ── Informations métier (constantes au sein du groupe, par construction) ──
  dedupHash: string | null;
  teamId: string;
  targetType: TargetType;
  targetId: string;
  /** Statut du groupe = statut du représentant (cf. `hasMixedState`). */
  state: string;

  // ── Détection d'anomalies (préparation des évolutions, pas encore consommée) ──
  /** Les occurrences n'ont pas toutes le même `localStatus`. */
  hasMixedState: boolean;
  /** Les occurrences n'ont pas toutes la même échéance (jour calendaire UTC). */
  hasMixedDueDate: boolean;
  /** Les occurrences n'ont pas toutes le même `teamId`. INVARIANT : doit rester
   *  `false` (teamId est dans la clé) ; une valeur `true` révèle un bug. */
  hasMixedOwner: boolean;
  /** Liste des anomalies détectées (vide = groupe sain). */
  anomalies: DedupAnomaly[];
}

// ─── Helpers purs exportés (réutilisables par l'expansion serveur du Lot 4B-3) ──

/** Résout le type + l'identifiant de cible d'une action (priorité agent>site>véhicule). */
export function targetOf(a: DedupActionInput): { type: TargetType; id: string } {
  if (a.agentId) return { type: "agent", id: a.agentId };
  if (a.siteId) return { type: "site", id: a.siteId };
  if (a.vehicleId) return { type: "vehicle", id: a.vehicleId };
  return { type: "none", id: a.id };
}

/**
 * Clé de groupe canonique d'une action : `targetType|targetId|teamId|(dedupHash??id)`.
 * Calculée une seule fois ; c'est l'unique source de vérité du regroupement.
 */
export function groupKeyOf(a: DedupActionInput): string {
  const { type, id } = targetOf(a);
  return [type, id, a.teamId, a.dedupHash ?? a.id].join("|");
}

/** Normalise une échéance (Date | string | null) en epoch ms, ou `null`. */
function dueTime(dueAt: Date | string | null | undefined): number | null {
  if (dueAt == null) return null;
  if (dueAt instanceof Date) {
    const t = dueAt.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(dueAt);
  return Number.isNaN(t) ? null : t;
}

/** Clé « jour calendaire UTC » d'une échéance (aligné sur la granularité du dedupHash). */
function dueDayKey(dueAt: Date | string | null | undefined): string {
  const t = dueTime(dueAt);
  if (t === null) return "none";
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Comparateur déterministe du représentant et de l'ordre des membres / groupes :
 *  1. échéance la plus proche d'abord (`dueAt` croissant ; `null` en dernier) —
 *     le représentant porte l'échéance la plus urgente, ce qui correspond au
 *     comportement existant de la fiche agent (aucun changement induit) ;
 *  2. en cas d'égalité, `id` croissant (déterminisme total ; les ids sont uniques).
 */
function compareActions(a: DedupActionInput, b: DedupActionInput): number {
  const ta = dueTime(a.dueAt) ?? Number.POSITIVE_INFINITY;
  const tb = dueTime(b.dueAt) ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Regroupe une liste d'actions en groupes logiques dédupliqués.
 *
 * Le helper ne filtre RIEN (ni statut, ni périmètre) : il regroupe ce qu'on lui
 * passe. Le caller décide du périmètre (typiquement la vue ACTIVE, cf. décision
 * Lot 4A). Préserve le type concret `A` du caller.
 */
export function dedupActions<A extends DedupActionInput>(
  actions: A[],
): DedupGroup<A>[] {
  const byKey = new Map<string, A[]>();
  for (const a of actions) {
    const key = groupKeyOf(a);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(a);
    else byKey.set(key, [a]);
  }

  const groups: DedupGroup<A>[] = [];
  for (const [groupKey, bucket] of byKey) {
    const members = [...bucket].sort(compareActions);
    const representative = members[0];
    const { type: targetType, id: targetId } = targetOf(representative);

    const states = new Set(members.map((m) => m.localStatus));
    const dueDays = new Set(members.map((m) => dueDayKey(m.dueAt)));
    const owners = new Set(members.map((m) => m.teamId));

    const hasMixedState = states.size > 1;
    const hasMixedDueDate = dueDays.size > 1;
    const hasMixedOwner = owners.size > 1;

    const anomalies: DedupAnomaly[] = [];
    if (hasMixedState) anomalies.push("MIXED_STATE");
    if (hasMixedDueDate) anomalies.push("MIXED_DUE_DATE");
    if (hasMixedOwner) anomalies.push("MIXED_OWNER");

    groups.push({
      groupKey,
      representative,
      members,
      memberIds: members.map((m) => m.id),
      occurrenceCount: members.length,
      logicalCount: 1,
      isDuplicated: members.length > 1,
      dedupHash: representative.dedupHash ?? null,
      teamId: representative.teamId,
      targetType,
      targetId,
      state: representative.localStatus,
      hasMixedState,
      hasMixedDueDate,
      hasMixedOwner,
      anomalies,
    });
  }

  // Ordre des groupes déterministe (indépendant de l'ordre d'entrée) : même règle
  // que le tri des membres, tie-break par groupKey pour une stabilité totale.
  groups.sort((g1, g2) => {
    const c = compareActions(g1.representative, g2.representative);
    if (c !== 0) return c;
    return g1.groupKey < g2.groupKey ? -1 : g1.groupKey > g2.groupKey ? 1 : 0;
  });

  return groups;
}

/** Nombre d'actions LOGIQUES dans une liste (= nombre de groupes). Pratique pour les compteurs. */
export function countLogicalActions(actions: DedupActionInput[]): number {
  const keys = new Set<string>();
  for (const a of actions) keys.add(groupKeyOf(a));
  return keys.size;
}
