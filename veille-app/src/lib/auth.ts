/**
 * Auth côté Node (API routes, Server Actions).
 * - Pour la vérification Edge (proxy / RSC), utiliser `auth-edge.ts`.
 * - Hash mot de passe via scrypt natif (pas de bcrypt natif pour rester portable).
 */
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, decodeToken, encodeToken, type Role } from "@/lib/auth-edge";

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
  const userId = decodeToken(token);
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
  jar.set(COOKIE_NAME, encodeToken(userId), {
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
 * Filtre Prisma sur le champ scalaire `teamId` (legacy — sessions, imports,
 * actions où teamId est une colonne directe).
 * ADMIN ou viewAllTeams → pas de filtre.
 * Sinon → `teamId IN (équipes de l'utilisateur)`.
 */
export function teamScope(u: SessionUser): {
  teamId?: { in: string[] } | string;
} | Record<string, never> {
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { teamId: "__none__" };
  return { teamId: { in: u.teamIds } };
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
 * Filtre Prisma pour les requêtes sur `Agent` (et tout modèle qui s'y rattache).
 * Un agent est visible si au moins une de ses équipes est dans le scope de
 * l'utilisateur.
 *
 * Exemple :
 *   prisma.agent.findMany({ where: { ...agentScope(u), isVisible: true } });
 */
export function agentScope(u: SessionUser): Record<string, unknown> {
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { id: "__none__" };
  return { memberships: { some: { teamId: { in: u.teamIds } } } };
}

/**
 * Filtre sur les actions importées. Une action est visible si :
 *  - sa team est dans le scope OU
 *  - son agent (s'il existe) appartient à au moins une équipe du scope OU
 *  - son site (s'il existe) appartient à au moins une équipe du scope.
 */
export function actionScope(u: SessionUser): Record<string, unknown> {
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { id: "__none__" };
  return {
    OR: [
      { teamId: { in: u.teamIds } },
      { agent: { memberships: { some: { teamId: { in: u.teamIds } } } } },
      { site: { memberships: { some: { teamId: { in: u.teamIds } } } } },
    ],
  };
}

/**
 * Filtre Prisma pour les requêtes sur `Site` (analogue à `agentScope`).
 * Un site est visible si au moins une de ses équipes est dans le scope.
 */
export function siteScope(u: SessionUser): Record<string, unknown> {
  if (u.role === "ADMIN" || u.viewAllTeams) return {};
  if (!u.teamIds.length) return { id: "__none__" };
  return { memberships: { some: { teamId: { in: u.teamIds } } } };
}
