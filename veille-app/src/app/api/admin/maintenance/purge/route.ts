/**
 * POST /api/admin/maintenance/purge — rétention automatique (Sprint 5 C8).
 *
 * ADMIN-only. **Dry-run par défaut** : seul `?dryRun=false` (ou body
 * `{dryRun:false}`) déclenche la suppression effective. Une entrée
 * `AuditLog` est créée uniquement en mode apply.
 *
 * Pas de cron interne — à déclencher via un cron externe (cf. docs).
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { log } from "@/lib/logger";
import { runRetention } from "@/lib/retention";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function readDryRun(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const qs = url.searchParams.get("dryRun");
  if (qs === "false") return false;
  if (qs === "true") return true;
  // Fallback body JSON si présent (cron flexibles).
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { dryRun?: boolean };
      if (typeof body?.dryRun === "boolean") return body.dryRun;
    }
  } catch {
    /* silencieux */
  }
  return true; // défaut sécuritaire (D7)
}

export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN"]);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const dryRun = await readDryRun(req);
  const now = new Date();
  const report = await runRetention(now, { dryRun });

  // En mode apply : tracer dans AuditLog.
  if (!dryRun) {
    await prisma.auditLog
      .create({
        data: {
          userId: actor.id,
          userEmail: actor.email,
          action: "RETENTION_PURGE",
          entity: "Maintenance",
          entityId: null,
          details: JSON.stringify({
            thresholds: report.thresholds,
            cutoffs: report.cutoffs,
            detected: report.detected,
            deleted: report.deleted,
            executedAt: report.executedAt,
          }),
        },
      })
      .catch((e) => {
        log.error("retention.audit.failed", {
          err: e instanceof Error ? e.message : String(e),
        });
      });
    log.info("retention.purge.applied", {
      userId: actor.id,
      deleted: report.deleted,
    });
  }

  return NextResponse.json(report, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
