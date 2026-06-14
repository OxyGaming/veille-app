/**
 * Agrégateur du Centre d'audit ADMIN (Sprint 5 C6).
 *
 * Lecture seule sur `AuditLog`. ADMIN-only (filtré par la route).
 * Pagination cursor par `id` cohérente avec C4 (notifications).
 */

import { prisma } from "@/lib/prisma";

export type AuditFilters = {
  from?: Date | null;
  to?: Date | null;
  userId?: string | null;
  action?: string | null;
};

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

function buildWhere(filters: AuditFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  const dateRange: Record<string, unknown> = {};
  if (filters.from) dateRange.gte = filters.from;
  if (filters.to) dateRange.lte = filters.to;
  if (Object.keys(dateRange).length > 0) where.createdAt = dateRange;
  return where;
}

/**
 * Renvoie la page courante des logs d'audit, triée DESC par `createdAt`
 * puis `id`, avec cursor de pagination.
 */
export async function aggregateAuditLogs(
  options: {
    filters?: AuditFilters;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<AuditPayload> {
  const filters: AuditFilters = options.filters ?? {};
  const rawLimit = options.limit ?? DEFAULT_AUDIT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_AUDIT_LIMIT, rawLimit));

  const where = buildWhere(filters);
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

/** Énumère les actions distinctes de l'audit pour peupler le dropdown filtre. */
export async function getDistinctAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 100,
  });
  return rows.map((r) => r.action);
}

/** Liste des users (actifs ou non) pour peupler le dropdown filtre. */
export async function getAuditUsersOptions(): Promise<
  { id: string; label: string }[]
> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return users.map((u) => ({ id: u.id, label: `${u.name} <${u.email}>` }));
}

/**
 * Mode export — pas de cursor, limite haute fixe (cf. `MAX_AUDIT_EXPORT`).
 * Renvoie les rows brutes (Date objet, pas ISO) — la conversion CSV
 * est faite par la route.
 */
export async function exportAuditLogs(filters: AuditFilters) {
  return prisma.auditLog.findMany({
    where: buildWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_AUDIT_EXPORT,
  });
}
