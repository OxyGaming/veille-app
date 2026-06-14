/**
 * GET /api/admin/audit/export.csv — export CSV (Sprint 5 C6).
 *
 * ADMIN-only. Renvoie un text/csv (RFC 4180) avec les filtres appliqués.
 * Plafonné à `MAX_AUDIT_EXPORT` lignes (cf. lib).
 */

import { requireRole } from "@/lib/auth";
import {
  exportAuditLogs,
  MAX_AUDIT_EXPORT,
  type AuditFilters,
} from "@/lib/audit-aggregator";

export const dynamic = "force-dynamic";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Échappe un champ CSV selon RFC 4180. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  try {
    await requireRole(["ADMIN"]);
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
  const rows = await exportAuditLogs(filters);

  const header = [
    "createdAt",
    "userId",
    "userEmail",
    "action",
    "entity",
    "entityId",
    "details",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.userId,
      r.userEmail,
      r.action,
      r.entity,
      r.entityId,
      r.details,
    ]
      .map(csvField)
      .join(","),
  );
  const body = [header, ...lines, ""].join("\n");
  // UTF-8 BOM pour qu'Excel ouvre proprement les caractères accentués.
  const csv = "﻿" + body;
  const stamp = new Date().toISOString().slice(0, 10);
  const truncated = rows.length === MAX_AUDIT_EXPORT;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Audit-Truncated": truncated ? "1" : "0",
    },
  });
}
