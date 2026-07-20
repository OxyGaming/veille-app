/**
 * Auth côté Node (API routes, Server Actions).
 * - Pour la vérification Edge (proxy / RSC), utiliser `auth-edge.ts`.
 * - Hash mot de passe via scrypt natif (pas de bcrypt natif pour rester portable).
 */
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, decodeToken, encodeToken, type Role } from "@/lib/auth-edge";
import { resolveAdminScope } from "@/lib/admin-scope";

export { COOKIE_NAME, ROLES, type Role } from "@/lib/auth-edge";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, hashed: string): boolean {
  if (!hashed?.startsWith("scrypt$")) return false;
  const [, salt, hex] = hashed.split("$");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const derived = scryptSync(plain, salt, expected.length, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Équipe principale (legacy, pour affichage par défaut). */
  teamId: string | null;
  /** Toutes les équipes auxquelles l'utilisateur appartient (via UserTeam). */
  teamIds: string[];
  viewAllTeams: boolean;
  /** Sprint 6 C2 — préférence ADMIN de périmètre (null pour les autres rôles). */
  adminScopeMode: string | null;
  /** Sprint 6 C2 — équipe choisie quand adminScopeMode = "TEAM". */
  adminTeamId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const userId = await decodeToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
      viewAllTeams: true,
      isActive: true,
      adminScopeMode: true,
      adminTeamId: true,
      memberships: { select: { teamId: true } },
    },
  });
  if (!user || !user.isActive) return null;
  const teamIds = user.memberships.map((m) => m.teamId);
  // Fallback : si la table de jointure est vide mais qu'on a un teamId
  // principal, on l'utilise (le script de migration aurait dû le synchro,
  // mais ce filet évite tout cas régressif).
  if (!teamIds.length && user.teamId) teamIds.push(user.teamId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    teamId: user.teamId,
    teamIds,
    viewAllTeams: user.viewAllTeams,
    adminScopeMode: user.adminScopeMode,
    adminTeamId: user.adminTeamId,
  };
}

export async function setAuthCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, await encodeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Helpers HTTP — à utiliser dans les route handlers. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) {
    throw new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return u;
}

export async function requireRole(roles: Role | Role[]): Promise<SessionUser> {
  const u = await requireUser();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(u.role)) {
    throw new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return u;
}

/**
 * Sprint 6 C5 — Si un ADMIN a choisi un scope restreint (MY_TEAMS / TEAM),
 * renvoie les `teamIds` à appliquer. Sinon `null` (passthrough : USER /
 * EDITOR / ADMIN GLOBAL conservent leur comportement existant).
 *
 * Utilise `resolveAdminScope` (C3) comme source unique. Les fallbacks
 * (ADMIN sans équipe → GLOBAL, etc.) sont déjà traités par le resolver.
 */
function adminScopedTeamIds(u: SessionUser): string[] | null {
  if (u.role !== "ADMIN") return null;
  if (
    u.adminScopeMode !== "MY_TEAMS" &&
    u.adminScopeMode !== "TEAM"
  )
    return null;
  const scope = resolveAdminScope({
    role: u.role,
    teamIds: u.teamIds,
    adminScopeMode: u.adminScopeMode,
    adminTeamId: u.adminTeamId,
  });
  // Fallback GLOBAL résolu côté C3 → on n'applique pas de restriction.
  if (scope.isGlobal) return null;
  return scope.teamIds;
}

/**
 * Liste effective des équipes « agissables » par l'utilisateur, ou `null` s'il
 * est GLOBAL (ADMIN non scopé / viewAllTeams → aucune restriction). Même logique
 * que teamScope/agentScope, mais renvoie le tableau brut pour les cas où on doit
 * raisonner dessus (ex. déterminer l'équipe propriétaire d'une action à créer
 * pour un utilisateur multi-équipes).
 */
export function effectiveTeamIds(u: SessionUser): string[] | null {
  const adminIds = adminScopedTeamIds(u);
  if (adminIds) return adminIds;
  if (u.role === "ADMIN" || u.viewAllTeams) return null;
  return u.teamIds;
}

/**
 * Filtre Prisma sur le champ scalaire `teamId` (legacy — sessions, imports,
 * actions où teamId est une colonne directe).
 * ADMIN GLOBAL ou viewAllTeams → pas de filtre.
 * ADMIN avec scope restreint (Sprint 6 C5) → `teamId IN (scope.teamIds)`.
 * Sinon (USER / EDITOR) → `teamId IN (équipes de l'utilisateur)`.
 */
export function teamScope(u: SessionUser): {
  teamId?: { in: string[] } | string;
} | Record<string, never> {
  const adminIds = adminScopedTeamIds(u);
  if (adminIds) return { teamId: { in: adminIds } };
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { teamId: "__none__" };
  return { teamId: { in: u.teamIds } };
}

/**
 * Filtre Prisma pour Agent/SiteSighting (décision cloisonnement §5) :
 * « Vu » (SIGHT) TRANSVERSAL, « Note » (NOTE) CLOISONNÉE par équipe.
 *
 * ⚠️ Ne PAS écrire `OR: [{ kind: "SIGHT" }, { ...teamScope(u) }]` : quand
 * teamScope renvoie `{}` (ADMIN global / viewAllTeams), Prisma élimine la
 * branche vide de l'OR au lieu de la traiter comme « toujours vrai », et la
 * condition se réduit à `kind = 'SIGHT'` — les NOTE disparaissent pour
 * exactement les utilisateurs qui devraient toutes les voir.
 */
export function sightingScope(u: SessionUser): {
  OR?: Array<{ kind?: string; teamId?: { in: string[] } | string }>;
} | Record<string, never> {
  const scope = teamScope(u);
  // Périmètre global : aucun filtre, SIGHT et NOTE sont tous visibles.
  if (!("teamId" in scope)) return {};
  return { OR: [{ kind: "SIGHT" }, scope] };
}

/**
 * Vérifie qu'un utilisateur a accès à une donnée scopée par teamId.
 *
 * À utiliser dans les route handlers APRÈS un `findUnique`, pour
 * autoriser ou refuser l'accès à une entité dont on connaît le teamId :
 *
 *   const row = await prisma.foo.findUnique({ where: { id }});
 *   if (!row) return 404;
 *   if (!assertTeamAccess(u, row.teamId)) return 403;
 *
 * Règles :
 *  - ADMIN ou viewAllTeams : accès global (true)
 *  - sinon : accès si teamId ∈ u.teamIds
 *
 * Remplace le pattern buggé `teamScope` + comparaison stricte :
 *   const scope = teamScope(u);
 *   if ("teamId" in scope && scope.teamId !== row.teamId) → 403
 * qui renvoyait systématiquement 403 pour les utilisateurs multi-équipes
 * (scope.teamId est alors `{ in: string[] }`, jamais égal à un string).
 *
 * Cf. AUDIT.md §C2 / BACKLOG-V2.md US-1.3.
 */
export function assertTeamAccess(u: SessionUser, teamId: string): boolean {
  if (u.role === "ADMIN" || u.viewAllTeams) return true;
  return u.teamIds.includes(teamId);
}

/**
 * Autorisation d'AGIR (créer / modifier / supprimer) sur une donnée rattachée
 * à une équipe précise, dans le back-office.
 *
 * Contrairement à `requireRole`, ce helper honore le périmètre effectif :
 *  - ADMIN GLOBAL / `viewAllTeams` → `true` (aucune restriction).
 *  - ADMIN scopé (MY_TEAMS / TEAM) → uniquement ses équipes.
 *  - EDITOR / USER → uniquement leurs équipes.
 *  - `teamId` null/undefined (donnée sans équipe) → refus pour les non-globaux.
 *
 * À appeler APRÈS `requireRole`, sur le `teamId` de l'entité chargée, pour
 * empêcher un acteur scopé d'agir hors de son périmètre.
 * Cf. memory/admin-scope-cosmetic-warning.md.
 */
export function canActOnTeam(
  u: SessionUser,
  teamId: string | null | undefined,
): boolean {
  const ids = effectiveTeamIds(u);
  if (ids === null) return true; // global
  if (!teamId) return false;
  return ids.includes(teamId);
}

/**
 * Variante « au moins une équipe » de `canActOnTeam`, pour les entités
 * rattachées à plusieurs équipes (Agent / Site / User via leurs join tables).
 * L'acteur peut agir s'il partage AU MOINS une équipe avec l'entité.
 *  - ADMIN GLOBAL / `viewAllTeams` → `true`.
 *  - sinon → intersection non vide entre son périmètre et `teamIds`.
 *  - liste vide / sans équipe commune → refus (les non-globaux ne touchent
 *    pas une entité sans équipe ou hors de leurs équipes).
 */
export function canActOnAnyTeam(
  u: SessionUser,
  teamIds: (string | null | undefined)[],
): boolean {
  const ids = effectiveTeamIds(u);
  if (ids === null) return true; // global
  return teamIds.some((t) => !!t && ids.includes(t));
}

/**
 * Détermine l'équipe propriétaire d'un objet créé sur une entité partagée
 * (action/sighting/visite sur agent ou site multi-équipes, tournée sur véhicule).
 *
 * Règles (cf. memory/cloisonnement-decisions.md) :
 *  - candidats = équipes de l'entité ∩ périmètre de l'utilisateur
 *    (ADMIN GLOBAL : toutes les équipes de l'entité) ;
 *  - aucun candidat → `NO_TEAM` (l'entité n'a pas d'équipe commune au scope) ;
 *  - `requested` fourni → doit être un candidat (sinon `TEAM_FORBIDDEN`) ;
 *  - un seul candidat → choisi automatiquement ;
 *  - plusieurs candidats sans `requested` → `TEAM_REQUIRED` (le front doit
 *    proposer un sélecteur).
 */
export function resolveOwningTeam(
  u: SessionUser,
  entityTeamIds: (string | null | undefined)[],
  requested?: string | null,
):
  | { ok: true; teamId: string }
  | { ok: false; code: "TEAM_REQUIRED" | "TEAM_FORBIDDEN" | "NO_TEAM" } {
  const entityTeams = Array.from(
    new Set(entityTeamIds.filter((t): t is string => !!t)),
  );
  const eff = effectiveTeamIds(u); // null = global
  const candidates =
    eff === null ? entityTeams : entityTeams.filter((t) => eff.includes(t));
  if (candidates.length === 0) return { ok: false, code: "NO_TEAM" };
  if (requested) {
    if (!candidates.includes(requested)) {
      return { ok: false, code: "TEAM_FORBIDDEN" };
    }
    return { ok: true, teamId: requested };
  }
  if (candidates.length === 1) return { ok: true, teamId: candidates[0] };
  return { ok: false, code: "TEAM_REQUIRED" };
}

/**
 * Filtre Prisma pour lister les `User` visibles par l'acteur — un user est
 * visible s'il partage au moins une équipe (via `UserTeam` ou le `teamId`
 * legacy). ADMIN GLOBAL / viewAllTeams → aucun filtre. Aucune équipe → filtre
 * impossible (`id: "__none__"`).
 */
export function userScope(u: SessionUser): Record<string, unknown> {
  const ids = effectiveTeamIds(u);
  if (ids === null) return {};
  if (!ids.length) return { id: "__none__" };
  return {
    OR: [
      { memberships: { some: { teamId: { in: ids } } } },
      { teamId: { in: ids } },
    ],
  };
}

/**
 * Filtre Prisma pour les requêtes sur `Agent` (et tout modèle qui s'y rattache).
 * Un agent est visible si au moins une de ses équipes est dans le scope de
 * l'utilisateur.
 *
 * Exemple :
 *   prisma.agent.findMany({ where: { ...agentScope(u), isVisible: true } });
 */
export function agentScope(u: SessionUser): Record<string, unknown> {
  const adminIds = adminScopedTeamIds(u);
  if (adminIds)
    return { memberships: { some: { teamId: { in: adminIds } } } };
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { id: "__none__" };
  return { memberships: { some: { teamId: { in: u.teamIds } } } };
}

/**
 * Filtre sur les actions importées — **STRICT par `teamId`** (décision de
 * cloisonnement 2026-06, cf. memory/cloisonnement-decisions.md).
 *
 * Une action n'appartient qu'à son équipe propriétaire (`ImportedAction.teamId`)
 * et n'est visible / modifiable que par cette équipe. L'ancien comportement
 * « OU via agent/site partagé » a été retiré : il exposait et rendait mutables
 * les actions d'une équipe à une autre dès qu'un agent ou un site était partagé,
 * sans aucun bénéfice fonctionnel (la validation était déjà stricte).
 *
 * Conservé comme alias de `teamScope` pour limiter le churn de ses ~13
 * appelants et garder l'intention « scope des actions » lisible aux call-sites.
 */
export function actionScope(u: SessionUser): Record<string, unknown> {
  return teamScope(u);
}

/**
 * Filtre Prisma pour les requêtes sur `Site` (analogue à `agentScope`).
 * Un site est visible si au moins une de ses équipes est dans le scope.
 */
export function siteScope(u: SessionUser): Record<string, unknown> {
  const adminIds = adminScopedTeamIds(u);
  if (adminIds)
    return { memberships: { some: { teamId: { in: adminIds } } } };
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { id: "__none__" };
  return { memberships: { some: { teamId: { in: u.teamIds } } } };
}
