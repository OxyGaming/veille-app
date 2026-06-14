/**
 * Agrégateur du Centre d'audit ADMIN (Sprint 5 C6).
 *
 * Lecture seule sur `AuditLog`. ADMIN-only (filtré par la route).
 * Pagination cursor par `id` cohérente avec C4 (notifications).
 *
 * Sprint 6 C8 — scope ADMIN :
 * `AuditLog` n'a pas de champ `teamId`. Le scope est appliqué via
 * `userId IN (auteurs appartenant aux équipes du scope)`. Les entrées
 * sans `userId` (purement système) ne sont visibles qu'en mode GLOBAL.
 */

import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/admin-scope";
import type { SessionUser } from "@/lib/auth";

export type AuditFilters = {
  from?: Date | null;
  to?: Date | null;
  userId?: string | null;
  action?: string | null;
};

/**
 * Type retourné par `getAuditUserScopeIds`.
 *  - `null` → mode GLOBAL : aucun filtre `userId` appliqué (entrées
 *     système incluses).
 *  - `string[]` → liste fermée d'auteurs autorisés.
 */
export type AuditUserScope = string[] | null;

export type AuditItem = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | string | null;
  createdAt: string;
};

export type AuditPayload = {
  items: AuditItem[];
  nextCursor: string | null;
  filtersApplied: AuditFilters;
};

export const DEFAULT_AUDIT_LIMIT = 50;
export const MAX_AUDIT_LIMIT = 200;
export const MAX_AUDIT_EXPORT = 10_000;

function parseDetails(raw: string): Record<string, unknown> | string | null {
  if (!raw || raw === "{}") return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
    // Tableau ou primitive : on garde la string brute pour ne rien perdre.
    return raw;
  } catch {
    return raw; // non-JSON → on renvoie tel quel
  }
}

function buildWhere(
  filters: AuditFilters,
  userScope: AuditUserScope = null,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  const dateRange: Record<string, unknown> = {};
  if (filters.from) dateRange.gte = filters.from;
  if (filters.to) dateRange.lte = filters.to;
  if (Object.keys(dateRange).length > 0) where.createdAt = dateRange;

  // Sprint 6 C8 — restriction au périmètre ADMIN (auteurs scopés).
  // Si un filtre `userId` explicite est fourni ET qu'il n'est pas dans
  // le scope, on force un résultat vide en intersectant.
  if (userScope !== null) {
    if (filters.userId) {
      if (!userScope.includes(filters.userId)) {
        // Filtre userId hors scope : vide attendu.
        where.userId = "__none__";
      }
      // sinon le where.userId existant suffit (subset de userScope).
    } else {
      where.userId = { in: userScope };
    }
  }
  return where;
}

/**
 * Calcule la liste fermée d'`userId` autorisés pour un ADMIN selon son
 * scope. Renvoie `null` en mode GLOBAL (aucun filtre).
 *
 * - ADMIN GLOBAL → `null` (audit complet, entrées système incluses).
 * - ADMIN MY_TEAMS / TEAM → `userId` des users ayant au moins un
 *   membership dans le scope (ou un `teamId` principal dans le scope).
 *   Les entrées AuditLog avec `userId = null` (système) sont alors
 *   masquées — accepté par décision PO (C8).
 * - USER / EDITOR → ne devraient pas atteindre cette fonction
 *   (route protégée par `requireRole(['ADMIN'])`). Fallback : `null`.
 */
export async function getAuditUserScopeIds(
  user: SessionUser,
): Promise<AuditUserScope> {
  if (user.role !== "ADMIN") return null;
  const scope = resolveAdminScope({
    role: user.role,
    teamIds: user.teamIds,
    adminScopeMode: user.adminScopeMode,
    adminTeamId: user.adminTeamId,
  });
  if (scope.isGlobal) return null;
  if (scope.teamIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { teamId: { in: scope.teamIds } },
        { memberships: { some: { teamId: { in: scope.teamIds } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Renvoie la page courante des logs d'audit, triée DESC par `createdAt`
 * puis `id`, avec cursor de pagination.
 *
 * Sprint 6 C8 — `userScope` optionnel : passer `null` pour ADMIN GLOBAL,
 * une liste fermée d'`userId` pour ADMIN MY_TEAMS / TEAM.
 */
export async function aggregateAuditLogs(
  options: {
    filters?: AuditFilters;
    cursor?: string | null;
    limit?: number;
    userScope?: AuditUserScope;
  } = {},
): Promise<AuditPayload> {
  const filters: AuditFilters = options.filters ?? {};
  const rawLimit = options.limit ?? DEFAULT_AUDIT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_AUDIT_LIMIT, rawLimit));

  const where = buildWhere(filters, options.userScope ?? null);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  const items: AuditItem[] = sliced.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.userEmail,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    details: parseDetails(r.details),
    createdAt: r.createdAt.toISOString(),
  }));

  return { items, nextCursor, filtersApplied: filters };
}

/**
 * Énumère les actions distinctes de l'audit pour peupler le dropdown
 * filtre. Sprint 6 C8 : limite au scope ADMIN si fourni — un ADMIN en
 * MY_TEAMS ne doit pas voir des actions qui n'existent que sur des
 * équipes hors scope.
 */
export async function getDistinctAuditActions(
  userScope: AuditUserScope = null,
): Promise<string[]> {
  const where: Record<string, unknown> = {};
  if (userScope !== null) {
    where.userId = userScope.length === 0 ? "__none__" : { in: userScope };
  }
  const rows = await prisma.auditLog.findMany({
    where,
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 100,
  });
  return rows.map((r) => r.action);
}

/**
 * Liste des users pour peupler le dropdown filtre.
 * Sprint 6 C8 : restreint au périmètre ADMIN si fourni.
 */
export async function getAuditUsersOptions(
  userScope: AuditUserScope = null,
): Promise<{ id: string; label: string }[]> {
  const where: Record<string, unknown> = {};
  if (userScope !== null) {
    if (userScope.length === 0) return [];
    where.id = { in: userScope };
  }
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return users.map((u) => ({ id: u.id, label: `${u.name} <${u.email}>` }));
}

/**
 * Mode export — pas de cursor, limite haute fixe (cf. `MAX_AUDIT_EXPORT`).
 * Sprint 6 C8 : `userScope` propagé pour cohérence GET ⇔ CSV.
 */
export async function exportAuditLogs(
  filters: AuditFilters,
  userScope: AuditUserScope = null,
) {
  return prisma.auditLog.findMany({
    where: buildWhere(filters, userScope),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_AUDIT_EXPORT,
  });
}
