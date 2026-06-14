/**
 * GET /api/today — payload de l'écran Aujourd'hui pour l'utilisateur courant.
 *
 * Cache HTTP private 30 s : on évite de re-fetch à chaque interaction sans
 * exposer la donnée à un proxy partagé. Le contenu varie strictement par
 * utilisateur (et donc par cookie d'auth) — `private` empêche tout cache
 * intermédiaire.
 */

import { NextResponse } from "next/server";
import { aggregateToday } from "@/lib/today/aggregator";
import { requireUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isTodayEnabled()) {
    return NextResponse.json({ error: "Disabled" }, { status: 404 });
  }
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  try {
    const payload = await aggregateToday(user);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    log.error("today.aggregate.failed", {
      userId: user.id,
      role: user.role,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Aggregator failure", role: user.role },
      { status: 500 },
    );
  }
}
