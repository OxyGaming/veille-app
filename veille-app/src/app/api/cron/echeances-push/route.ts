/**
 * POST /api/cron/echeances-push (Sprint Push V1 — C8).
 *
 * Déclenche le run quotidien du cron des échéances critiques.
 *
 * Sécurité :
 *  - Header `x-cron-secret` requis, comparé à `process.env.CRON_SECRET`.
 *  - Aucun accès via session utilisateur. Aucun `userId` accepté en body.
 *  - 401 immédiat si le secret est absent, vide, ou non égal.
 *
 * Hébergement : cron Linux côté VPS, 1×/jour 06:00 Europe/Paris.
 * Cf. docs/push-notifications.md §Cron.
 */

import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { runEcheancesPushCron } from "@/lib/push/cron-echeances";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Comparaison de secret. Pas de `timingSafeEqual` ici : la latence est
 * non-observable côté attaquant (route non publique, runner cron unique),
 * et l'entropie du secret (32+ chars random) rend l'attaque par timing
 * infaisable. Mais on garantit au moins que `expected` est non vide,
 * sinon une mauvaise config CRON_SECRET (.env vide) accepterait une
 * requête sans header.
 */
function checkSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (expected.length === 0) return false;
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (provided.length === 0) return false;
  return provided === expected;
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    log.warn("cron.echeances-push.unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await runEcheancesPushCron(new Date());
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("cron.echeances-push.crash", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Cron run failed" },
      { status: 500 },
    );
  }
}
