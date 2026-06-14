/**
 * Scope Engine ADMIN (Sprint 6 C3).
 *
 * Source unique consommée par les agrégateurs Today / Échéances /
 * Dashboard / Notifications critiques / Audit en C5-C8. Aucun module
 * ne doit dupliquer cette logique.
 *
 * Pure : aucun accès Prisma, aucun side-effect. Permet :
 *  - tests unitaires déterministes,
 *  - usage côté Server Components sans `await`,
 *  - composabilité avec les helpers existants `siteScope` / `teamScope`
 *    via `adminScopeToTeamFilter` (C5+).
 *
 * Sémantique :
 *  - USER / EDITOR  : passthrough MY_TEAMS basé sur leurs memberships.
 *  - ADMIN GLOBAL   : `isGlobal=true`, `teamIds=[]` — pas de filtre.
 *  - ADMIN MY_TEAMS : `teamIds = user.teamIds`. Fallback GLOBAL si vide.
 *  - ADMIN TEAM     : `teamIds = [adminTeamId]`. Fallback GLOBAL si
 *                     teamId null/inconnu (vs `options.teamsMap`).
 */

import {
  getAdminScopePreference,
  type AdminScopeMode,
} from "./admin-scope-preference";

/** Forme renvoyée par `resolveAdminScope`. */
export type ResolvedAdminScope = {
  mode: AdminScopeMode;
  /** [] pour GLOBAL — filtre Prisma vide. */
  teamIds: string[];
  /** `true` si aucun filtre n'est appliqué (mode GLOBAL ou fallback). */
  isGlobal: boolean;
  /** Libellé humain prêt à afficher ("Global" / "Mes équipes" / "Équipe X"). */
  label: string;
  /** `null` sauf en mode TEAM avec teamId valide. */
  selectedTeamId: string | null;
};

/**
 * Forme minimaliste acceptée en entrée — accepte aussi bien `SessionUser`
 * que la row Prisma `User` directe. Aucune dépendance circulaire.
 */
export type ScopeUserInput = {
  role: string;
  teamIds: string[];
  adminScopeMode?: string | null;
  adminTeamId?: string | null;
};

export type ResolveAdminScopeOptions = {
  /**
   * Map `teamId → name`, optionnelle. Permet de :
   *  - résoudre le label `"Équipe RDN"` avec le nom réel en mode TEAM,
   *  - **valider** l'existence du teamId (fallback GLOBAL si absent du map).
   * Sans `teamsMap`, le label TEAM reste générique `"Équipe"` et aucune
   * validation d'existence n'est faite.
   */
  teamsMap?: Record<string, string>;
};

const GLOBAL_SCOPE: Omit<ResolvedAdminScope, "label"> & { label: "Global" } = {
  mode: "GLOBAL",
  teamIds: [],
  isGlobal: true,
  label: "Global",
  selectedTeamId: null,
};

/**
 * Résout le périmètre effectif d'un utilisateur.
 *
 * Aucune erreur n'est levée : tous les cas pathologiques (préférence
 * corrompue, équipe absente, ADMIN sans memberships) basculent en
 * `GLOBAL` plutôt que de produire un scope vide qui rendrait l'écran
 * vide.
 */
export function resolveAdminScope(
  user: ScopeUserInput,
  options: ResolveAdminScopeOptions = {},
): ResolvedAdminScope {
  // ── USER / EDITOR : passthrough MY_TEAMS basé sur leurs memberships ──
  // Aucun ADMIN scope mode n'est interprété pour ces rôles : ils
  // restent strictement sur leurs équipes.
  if (user.role !== "ADMIN") {
    return {
      mode: "MY_TEAMS",
      teamIds: user.teamIds,
      isGlobal: false,
      label: "Mes équipes",
      selectedTeamId: null,
    };
  }

  // ── ADMIN : lecture normalisée de la préférence (cf. C2) ─────────────
  const pref = getAdminScopePreference(user);

  if (pref.mode === "GLOBAL") return GLOBAL_SCOPE;

  if (pref.mode === "MY_TEAMS") {
    // Fallback GLOBAL si ADMIN sans memberships — un scope vide
    // produirait une UI inutile.
    if (user.teamIds.length === 0) return GLOBAL_SCOPE;
    return {
      mode: "MY_TEAMS",
      teamIds: user.teamIds,
      isGlobal: false,
      label: "Mes équipes",
      selectedTeamId: null,
    };
  }

  // ── ADMIN + TEAM : validation du teamId persisté ──────────────────────
  const teamId = pref.teamId;
  if (!teamId) return GLOBAL_SCOPE;

  // Si la table des équipes est fournie, on valide l'existence.
  // Sans teamsMap : on accepte tout teamId non vide (le caller assume
  // la validité — utilisé par les routes API qui ne récupèrent pas
  // toujours la liste des équipes).
  if (options.teamsMap && !(teamId in options.teamsMap)) {
    return GLOBAL_SCOPE;
  }

  const teamName = options.teamsMap?.[teamId];
  const label = teamName ? `Équipe ${teamName}` : "Équipe";

  return {
    mode: "TEAM",
    teamIds: [teamId],
    isGlobal: false,
    label,
    selectedTeamId: teamId,
  };
}

/**
 * Transforme un `ResolvedAdminScope` en filtre Prisma sur `teamId`.
 *
 * Usage typique :
 * ```ts
 * const scope = resolveAdminScope(user);
 * await prisma.veilleSession.findMany({
 *   where: { teamId: adminScopeToTeamFilter(scope), status: "completed" },
 * });
 * ```
 *
 * - GLOBAL                → `{}` (pas de contrainte)
 * - MY_TEAMS / TEAM       → `{ in: scope.teamIds }`
 */
export function adminScopeToTeamFilter(
  scope: ResolvedAdminScope,
): { in: string[] } | Record<string, never> {
  if (scope.isGlobal) return {};
  return { in: scope.teamIds };
}

/**
 * Renvoie `true` si l'équipe `teamId` est admise par ce scope.
 *
 * - GLOBAL          → true (aucune restriction)
 * - MY_TEAMS / TEAM → `scope.teamIds.includes(teamId)`
 */
export function adminScopeAllowsTeam(
  scope: ResolvedAdminScope,
  teamId: string,
): boolean {
  return scope.isGlobal || scope.teamIds.includes(teamId);
}
