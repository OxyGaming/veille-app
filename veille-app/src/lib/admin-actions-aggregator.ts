/**
 * Agrégateur de la page `/admin/actions` (Sprint 7 C3).
 *
 * Lecture seule sur `ImportedAction` avec filtres simples + pagination
 * cursor (cohérente avec `/admin/audit`). Scope STRICT par teamId via
 * `teamScope(user)` (aligné cloisonnement fiche agent).
 */

import { prisma } from "@/lib/prisma";
import { teamScope, type SessionUser } from "@/lib/auth";
import { parseTags } from "@/lib/tags";
import { dedupActions, groupKeyOf } from "@/lib/actions/dedup";

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
  tags: string[];
  updatedAt: string;
  /**
   * Lot 4B-4 — nombre d'occurrences du groupe LOGIQUE de cette ligne, calculé
   * sur le périmètre filtré courant (pas seulement la page). `1` = action seule.
   * `> 1` ⇒ la ligne appartient à un groupe de plusieurs occurrences (badge ×N).
   * Purement informatif : la ligne reste affichée brute, jamais fusionnée.
   */
  occurrenceCount: number;
};

export type AdminActionsPayload = {
  items: AdminActionRow[];
  nextCursor: string | null;
  /** Total BRUT d'occurrences sur le périmètre filtré (inchangé). */
  total: number;
  /**
   * Lot 4B-4 — total d'actions LOGIQUES (groupes dédupliqués) sur le périmètre
   * filtré courant. Compteur secondaire : `total` reste la référence primaire.
   */
  logicalTotal: number;
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

  const [rows, total, teamsAvailable, keyRows] = await Promise.all([
    // (1) Liste PAGINÉE en occurrences BRUTES — inchangée (pagination cursor).
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
        // Lot 4B-4 — nécessaires au calcul de la clé logique (groupKeyOf).
        vehicleId: true,
        dedupHash: true,
        tags: true,
        updatedAt: true,
        team: { select: { name: true } },
        agent: { select: { firstName: true, lastName: true } },
        site: { select: { name: true } },
      },
    }),
    // (2) Total BRUT d'occurrences sur le périmètre filtré — inchangé.
    prisma.importedAction.count({ where }),
    getTeamsAvailable(user),
    // (3) Lot 4B-4 — projection clé minimale sur TOUT le périmètre filtré (pas
    // seulement la page) pour calculer les groupes logiques. Lecture seule, sans
    // pagination : alimente le compteur secondaire + le badge ×N par ligne.
    prisma.importedAction.findMany({
      where,
      select: {
        id: true,
        teamId: true,
        agentId: true,
        siteId: true,
        vehicleId: true,
        dedupHash: true,
        localStatus: true,
      },
    }),
  ]);

  // Groupes logiques du périmètre filtré (helper central Lot 4B-1). On en tire :
  //  - `logicalTotal` = nombre de groupes (compteur secondaire) ;
  //  - `occByKey` = nombre d'occurrences par clé (badge ×N par ligne).
  const groups = dedupActions(keyRows);
  const logicalTotal = groups.length;
  const occByKey = new Map<string, number>();
  for (const g of groups) occByKey.set(g.groupKey, g.occurrenceCount);

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
    tags: parseTags(r.tags),
    updatedAt: r.updatedAt.toISOString(),
    // Taille du groupe logique de la ligne dans le périmètre filtré (≥ 1).
    occurrenceCount: occByKey.get(groupKeyOf(r)) ?? 1,
  }));

  return {
    items,
    nextCursor,
    total,
    logicalTotal,
    filtersApplied: filters,
    teamsAvailable,
  };
}
