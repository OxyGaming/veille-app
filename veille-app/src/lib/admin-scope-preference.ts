/**
 * Préférences ADMIN de périmètre de pilotage (Sprint 6 C2).
 *
 * Persiste sur User le mode de scope choisi par un ADMIN :
 *  - GLOBAL    : vue toutes équipes (défaut)
 *  - MY_TEAMS  : restreint aux memberships de l'ADMIN
 *  - TEAM      : restreint à une équipe précise (`adminTeamId`)
 *
 * Aucun helper de résolution de scope ici : C2 fournit uniquement la
 * persistance + validation. Le `resolveAdminScope()` qui consomme ces
 * champs viendra en C3.
 */

import { prisma } from "@/lib/prisma";

/** 3 modes V1 (D1 Sprint 6). */
export const ADMIN_SCOPE_MODES = ["GLOBAL", "MY_TEAMS", "TEAM"] as const;

export type AdminScopeMode = (typeof ADMIN_SCOPE_MODES)[number];

/** Guard runtime — utile pour parser des inputs (route POST V1.5). */
export function isAdminScopeMode(value: string): value is AdminScopeMode {
  return (ADMIN_SCOPE_MODES as readonly string[]).includes(value);
}

/** Forme renvoyée par `getAdminScopePreference`. */
export type AdminScopePreference = {
  mode: AdminScopeMode;
  teamId: string | null;
  updatedAt: Date | null;
};

/** Type utilisateur minimaliste accepté en entrée — aucune dépendance vers SessionUser. */
type AdminScopeUserFields = {
  adminScopeMode?: string | null;
  adminTeamId?: string | null;
  adminScopeUpdatedAt?: Date | null;
};

/**
 * Renvoie la préférence d'un utilisateur sous une forme normalisée.
 *
 * Garanties :
 *  - `mode` est toujours une valeur valide. Un champ DB null ou
 *    inconnu (donnée corrompue, rétro-compat) → fallback `GLOBAL`.
 *  - `teamId` est forcé à `null` en `GLOBAL` et `MY_TEAMS` même si
 *    la DB en contient un résidu — sanity côté lecture.
 *  - `updatedAt` est `null` si jamais défini (donnée pré-Sprint 6).
 */
export function getAdminScopePreference(
  user: AdminScopeUserFields,
): AdminScopePreference {
  const raw = user.adminScopeMode ?? null;
  const mode: AdminScopeMode =
    raw && isAdminScopeMode(raw) ? raw : "GLOBAL";
  const teamId: string | null =
    mode === "TEAM" ? (user.adminTeamId ?? null) : null;
  return {
    mode,
    teamId,
    updatedAt: user.adminScopeUpdatedAt ?? null,
  };
}

/**
 * Met à jour la préférence en DB. Validation stricte :
 *  - `mode` doit être l'un des `ADMIN_SCOPE_MODES`.
 *  - Mode `TEAM` impose un `teamId` non vide.
 *  - Mode `GLOBAL` et `MY_TEAMS` forcent `teamId = null` (idempotent
 *    même si l'appelant fournit un teamId par erreur).
 *
 * `adminScopeUpdatedAt` est mis à jour à `new Date()` à chaque appel
 * (même si la valeur du mode reste identique — permet à C3+ de tracer).
 *
 * Renvoie la préférence finale (cohérente avec ce qui a été persisté).
 */
export async function updateAdminScopePreference(
  userId: string,
  mode: AdminScopeMode,
  teamId: string | null = null,
): Promise<AdminScopePreference> {
  if (!isAdminScopeMode(mode)) {
    throw new Error(`Invalid AdminScopeMode: ${String(mode)}`);
  }
  if (mode === "TEAM" && (!teamId || typeof teamId !== "string")) {
    throw new Error("Mode TEAM requires a non-empty teamId");
  }
  const finalTeamId = mode === "TEAM" ? teamId : null;
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      adminScopeMode: mode,
      adminTeamId: finalTeamId,
      adminScopeUpdatedAt: now,
    },
  });
  return { mode, teamId: finalTeamId, updatedAt: now };
}

/**
 * Helper de confort : renvoie `true` si la préférence courante restreint
 * le périmètre (modes `MY_TEAMS` et `TEAM`), `false` sinon (`GLOBAL` ou
 * champ absent).
 *
 * Le Scope Engine (C3) utilisera ce flag pour choisir entre la voie
 * « passthrough » et la voie « filtrée ».
 */
export function isAdminScoped(user: AdminScopeUserFields): boolean {
  const mode = getAdminScopePreference(user).mode;
  return mode === "MY_TEAMS" || mode === "TEAM";
}
