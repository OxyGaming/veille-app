/**
 * Agrégateur de la page `/admin/actions` (Sprint 7 C3).
 *
 * Lecture seule sur `ImportedAction` avec filtres simples + pagination
 * cursor (cohérente avec `/admin/audit`). Scope STRICT par teamId via
 * `teamScope(user)` (aligné cloisonnement fiche agent).
 */

import { prisma } from "@/lib/prisma";
import { teamScope, type SessionUser } from "@/lib/auth";

export type AdminActionStatus =
  | "ACTIVE"
  | "OBSOLETE"
  | "VALIDATED_LOCAL"
  | "REPLACED"
  | "all";

export type AdminActionsFilters = {
  status: AdminActionStatus;
  teamId: string | null;
  agentId: string | null;
  siteId: string | null;
  late: boolean;
  q: string | null;
};

export type AdminActionRow = {
  id: string;
  externalId: string;
  localStatus: string;
  keyPoint: string | null;
  comment: string | null;
  dueAt: string | null;
  teamId: string;
  teamName: string;
  agentId: string | null;
  agentName: string | null;
  siteId: string | null;
  siteName: string | null;
  updatedAt: string;
};

export type AdminActionsPayload = {
  items: AdminActionRow[];
  nextCursor: string | null;
  total: number;
  filtersApplied: AdminActionsFilters;
  teamsAvailable: { id: string; name: string }[];
};

export const DEFAULT_ADMIN_ACTIONS_LIMIT = 50;
export const MAX_ADMIN_ACTIONS_LIMIT = 200;

export function parseAdminActionsStatus(
  raw: string | string[] | undefined,
): AdminActionStatus {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (
    v === "OBSOLETE" ||
    v === "VALIDATED_LOCAL" ||
    v === "REPLACED" ||
    v === "all"
  )
    return v;
  return "ACTIVE";
}

function buildWhere(
  user: SessionUser,
  filters: AdminActionsFilters,
  now: Date,
): Record<string, unknown> {
  // Scope STRICT par teamId (aligné sur le cloisonnement de la fiche agent) :
  // un admin restreint ne voit que les actions de SES équipes, même pour un
  // agent/site partagé. null = admin global (aucune restriction).
  const scope = teamScope(user);
  const scopeTeamIds =
    "teamId" in scope && typeof scope.teamId === "object" && scope.teamId
      ? (scope.teamId as { in: string[] }).in
      : null;

  const where: Record<string, unknown> = {};
  // Filtre équipe de l'UI borné au périmètre (ne peut pas l'élargir).
  if (filters.teamId) {
    where.teamId =
      scopeTeamIds && !scopeTeamIds.includes(filters.teamId)
        ? "__none__"
        : filters.teamId;
  } else if (scopeTeamIds) {
    where.teamId = { in: scopeTeamIds };
  }
  if (filters.status !== "all") where.localStatus = filters.status;
  if (filters.agentId) where.agentId = filters.agentId;
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.late) where.dueAt = { not: null, lt: now };
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { keyPoint: { contains: q } },
        { comment: { contains: q } },
        { externalId: { contains: q } },
      ];
    }
  }
  return where;
}

/**
 * Liste des équipes accessibles pour peupler le dropdown filtre.
 * En mode ADMIN MY_TEAMS / TEAM, seules les équipes du scope apparaissent
 * (cohérent avec le périmètre des données affichées).
 */
async function getTeamsAvailable(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  if (user.role === "ADMIN" && user.adminScopeMode === "GLOBAL")
    return prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  if (user.role === "ADMIN" && !user.adminScopeMode)
    return prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  if (!user.teamIds.length) return [];
  return prisma.team.findMany({
    where: { id: { in: user.teamIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function aggregateAdminActions(
  user: SessionUser,
  filters: AdminActionsFilters,
  options: {
    cursor?: string | null;
    limit?: number;
    now?: Date;
  } = {},
): Promise<AdminActionsPayload> {
  const now = options.now ?? new Date();
  const rawLimit = options.limit ?? DEFAULT_ADMIN_ACTIONS_LIMIT;
  const limit = Math.max(1, Math.min(MAX_ADMIN_ACTIONS_LIMIT, rawLimit));
  const where = buildWhere(user, filters, now);

  const [rows, total, teamsAvailable] = await Promise.all([
    prisma.importedAction.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        externalId: true,
        localStatus: true,
        keyPoint: true,
        comment: true,
        dueAt: true,
        teamId: true,
        agentId: true,
        siteId: true,
        updatedAt: true,
        team: { select: { name: true } },
        agent: { select: { firstName: true, lastName: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.importedAction.count({ where }),
    getTeamsAvailable(user),
  ]);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  const items: AdminActionRow[] = sliced.map((r) => ({
    id: r.id,
    externalId: r.externalId,
    localStatus: r.localStatus,
    keyPoint: r.keyPoint,
    comment: r.comment,
    dueAt: r.dueAt?.toISOString() ?? null,
    teamId: r.teamId,
    teamName: r.team.name,
    agentId: r.agentId,
    agentName: r.agent
      ? `${r.agent.firstName} ${r.agent.lastName}`.trim()
      : null,
    siteId: r.siteId,
    siteName: r.site?.name ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return {
    items,
    nextCursor,
    total,
    filtersApplied: filters,
    teamsAvailable,
  };
}
