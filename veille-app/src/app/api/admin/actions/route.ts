/**
 * GET /api/admin/actions (Sprint 7 C3).
 *
 * Pagination cursor pour le tableau /admin/actions. ADMIN-only.
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  aggregateAdminActions,
  parseAdminActionsStatus,
  type AdminActionsFilters,
} from "@/lib/admin-actions-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user;
  try {
    user = await requireRole(["ADMIN"]);
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const sp = url.searchParams;
  const filters: AdminActionsFilters = {
    status: parseAdminActionsStatus(sp.get("status") ?? undefined),
    teamId: sp.get("teamId"),
    agentId: sp.get("agentId"),
    siteId: sp.get("siteId"),
    late: sp.get("late") === "1" || sp.get("late") === "true",
    q: sp.get("q"),
  };
  const cursor = sp.get("cursor");
  const payload = await aggregateAdminActions(user, filters, { cursor });
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
