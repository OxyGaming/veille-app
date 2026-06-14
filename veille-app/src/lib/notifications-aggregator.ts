/**
 * Agrégateur du Centre de notifications (Sprint 5 C4).
 *
 * Fournit la liste paginée des notifications scopée à l'utilisateur
 * courant + le compteur global de non-lues (pour le badge header C5).
 *
 * Pagination par **cursor** sur `id` (cuid) en complément du tri
 * `(createdAt desc, id desc)` — stable même si plusieurs notifs ont
 * le même `createdAt` (création en parallèle).
 */

import { prisma } from "@/lib/prisma";

export type NotificationsFilter = "all" | "read" | "unread";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  createdAt: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type NotificationsPayload = {
  unreadCount: number;
  items: NotificationItem[];
  nextCursor: string | null;
  filtersApplied: { filter: NotificationsFilter };
};

export const DEFAULT_NOTIFICATION_LIMIT = 25;
export const MAX_NOTIFICATION_LIMIT = 100;

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function whereForFilter(
  userId: string,
  filter: NotificationsFilter,
): Record<string, unknown> {
  const base: Record<string, unknown> = { userId };
  if (filter === "unread") base.readAt = null;
  else if (filter === "read") base.readAt = { not: null };
  return base;
}

/**
 * Construit le payload du Centre de notifications.
 *
 * `cursor` (optionnel) = `id` de la dernière notification de la page
 * précédente. Prisma `cursor` + `skip: 1` saute exactement cette row.
 *
 * `limit` est clampé à `[1, MAX_NOTIFICATION_LIMIT]` (défaut 25).
 *
 * `unreadCount` reflète le **total** non lues du user (pas la fenêtre
 * paginée) — utilisé par le badge header C5.
 */
export async function aggregateNotifications(
  userId: string,
  options: {
    filter?: NotificationsFilter;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<NotificationsPayload> {
  const filter: NotificationsFilter = options.filter ?? "all";
  const rawLimit = options.limit ?? DEFAULT_NOTIFICATION_LIMIT;
  const limit = Math.max(1, Math.min(MAX_NOTIFICATION_LIMIT, rawLimit));

  // Fetch +1 pour détecter le `hasMore`.
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereForFilter(userId, filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  const items: NotificationItem[] = sliced.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    targetUrl: r.targetUrl,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
    metadata: parseMetadata(r.metadata),
  }));

  return {
    unreadCount,
    items,
    nextCursor,
    filtersApplied: { filter },
  };
}
