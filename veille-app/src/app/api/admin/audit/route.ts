/**
 * GET /api/admin/audit — pagination cursor pour le Centre Audit (C6).
 *
 * ADMIN-only. Consommé par AuditTable pour « Afficher 50 de plus ».
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  aggregateAuditLogs,
  getAuditUserScopeIds,
  type AuditFilters,
} from "@/lib/audit-aggregator";

export const dynamic = "force-dynamic";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  let user;
  try {
    user = await requireRole(["ADMIN"]);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const url = new URL(req.url);
  const filters: AuditFilters = {
    from: parseDate(url.searchParams.get("from")),
    to: parseDate(url.searchParams.get("to")),
    userId: url.searchParams.get("userId"),
    action: url.searchParams.get("action"),
  };
  const cursor = url.searchParams.get("cursor");
  const userScope = await getAuditUserScopeIds(user);
  const payload = await aggregateAuditLogs({ filters, cursor, userScope });
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
