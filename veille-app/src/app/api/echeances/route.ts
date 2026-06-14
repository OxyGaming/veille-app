/**
 * GET /api/echeances — payload du Hub Échéances (Sprint 4 C4).
 *
 * Réservé EDITOR + ADMIN (D2). USER → 403. Désactivable via
 * `ENABLE_ECHEANCES=false`. Cache HTTP private 30 s.
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { aggregateEcheances } from "@/lib/echeances/aggregator";
import { isKnownEcheanceKind } from "@/lib/echeances/criticality";
import type {
  EcheanceFilters,
  EcheanceKind,
  EcheanceUrgency,
} from "@/lib/echeances/types";
import { isEcheancesEnabled } from "@/lib/featureFlags";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_URGENCIES = new Set<EcheanceUrgency | "critical">([
  "late",
  "today",
  "soon",
  "later",
  "future",
  "critical",
]);

/** Parse `?type=VISIT_QUARTERLY,ACTION_OVERDUE&urgency=late,critical&...` */
function parseFilters(url: URL): EcheanceFilters {
  const filters: EcheanceFilters = {};
  const type = url.searchParams.get("type");
  if (type) {
    const items = type
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is EcheanceKind => isKnownEcheanceKind(s));
    if (items.length) filters.type = items;
  }
  const siteId = url.searchParams.get("siteId");
  if (siteId) filters.siteId = siteId;
  const teamId = url.searchParams.get("teamId");
  if (teamId) filters.teamId = teamId;
  const urgency = url.searchParams.get("urgency");
  if (urgency) {
    const items = urgency
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is EcheanceUrgency | "critical" =>
        ALLOWED_URGENCIES.has(s as EcheanceUrgency | "critical"),
      );
    if (items.length) filters.urgency = items;
  }
  return filters;
}

export async function GET(req: Request) {
  if (!isEcheancesEnabled()) {
    return NextResponse.json({ error: "Disabled" }, { status: 404 });
  }
  let user;
  try {
    user = await requireRole(["EDITOR", "ADMIN"]);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const filters = parseFilters(new URL(req.url));
  try {
    const payload = await aggregateEcheances(user, new Date(), filters);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    log.error("echeances.aggregate.failed", {
      userId: user.id,
      role: user.role,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Aggregator failure" },
      { status: 500 },
    );
  }
}
