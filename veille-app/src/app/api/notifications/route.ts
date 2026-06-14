/**
 * GET /api/notifications — Centre de notifications (Sprint 5 C4).
 *
 * Renvoie la liste paginée des notifications de l'utilisateur courant,
 * triée DESC par `createdAt`, avec compteur non-lues global pour le
 * badge header (C5).
 *
 * Query params :
 *  - `filter`  : `"all"` (défaut) | `"read"` | `"unread"`
 *  - `cursor`  : id de la dernière notif de la page précédente
 *  - `limit`   : 1..100 (défaut 25)
 *
 * Accès : USER + EDITOR + ADMIN (D2). Scope strict via `userId`.
 * Cache : `private, max-age=10` — court car le badge non-lues peut
 * varier rapidement.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { log } from "@/lib/logger";
import {
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_LIMIT,
  aggregateNotifications,
  type NotificationsFilter,
} from "@/lib/notifications-aggregator";

export const dynamic = "force-dynamic";

const ALLOWED_FILTERS: NotificationsFilter[] = ["all", "read", "unread"];

function parseFilter(raw: string | null): NotificationsFilter {
  if (raw && (ALLOWED_FILTERS as string[]).includes(raw)) {
    return raw as NotificationsFilter;
  }
  return "all";
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_NOTIFICATION_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_NOTIFICATION_LIMIT;
  return Math.min(MAX_NOTIFICATION_LIMIT, n);
}

export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const url = new URL(req.url);
  const filter = parseFilter(url.searchParams.get("filter"));
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor");

  try {
    const payload = await aggregateNotifications(user.id, {
      filter,
      cursor,
      limit,
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=10" },
    });
  } catch (err) {
    log.error("notifications.aggregate.failed", {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Aggregator failure" },
      { status: 500 },
    );
  }
}
