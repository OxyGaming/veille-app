/**
 * Routes d'abonnement push (Sprint Push V1 — C3).
 *
 *  - POST /api/push/subscribe   — crée ou met à jour un abonnement
 *  - DELETE /api/push/subscribe — supprime un abonnement de l'utilisateur
 *
 * Accès : tous les rôles authentifiés (USER + EDITOR + ADMIN). Le `userId`
 * est TOUJOURS lu depuis la session — jamais accepté dans le body.
 *
 * Désactivable via `ENABLE_PUSH=false` → 503 immédiat.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { log } from "@/lib/logger";
import { isPushEnabled } from "@/lib/featureFlags";
import {
  SubscribeBodySchema,
  UnsubscribeBodySchema,
} from "@/lib/push/schemas";
import {
  hashEndpoint,
  removeSubscriptionForUser,
  upsertSubscription,
} from "@/lib/push/subscriptions";
import { getOrCreatePreference } from "@/lib/push/preferences";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function POST(req: Request) {
  if (!isPushEnabled()) {
    return NextResponse.json({ error: "Push disabled" }, { status: 503 });
  }
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalide" },
      { status: 400 },
    );
  }
  const parsed = SubscribeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    await upsertSubscription({
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      platform: body.platform ?? null,
      userAgent: body.userAgent ?? null,
    });
    // Création lazy de la row de préférences si absente — évite un
    // 404 côté écran "Mon compte → Notifications" juste après activation.
    await getOrCreatePreference(user.id);
    log.info("push.subscribe.ok", {
      userId: user.id,
      endpointHash: hashEndpoint(body.endpoint),
      platform: body.platform ?? null,
    });
    return NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    log.error("push.subscribe.failed", {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Subscribe failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!isPushEnabled()) {
    return NextResponse.json({ error: "Push disabled" }, { status: 503 });
  }
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalide" },
      { status: 400 },
    );
  }
  const parsed = UnsubscribeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const removed = await removeSubscriptionForUser(
      user.id,
      parsed.data.endpoint,
    );
    log.info("push.unsubscribe.ok", {
      userId: user.id,
      endpointHash: hashEndpoint(parsed.data.endpoint),
      removed,
    });
    return NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    log.error("push.unsubscribe.failed", {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unsubscribe failed" },
      { status: 500 },
    );
  }
}
