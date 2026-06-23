/**
 * Préférences de notification de l'utilisateur courant (Sprint Push V1 — C3).
 *
 *  - GET   /api/me/notification-preferences — lit (crée lazy si absent)
 *  - PATCH /api/me/notification-preferences — patch partiel
 *
 * Accès : tous les rôles authentifiés (USER + EDITOR + ADMIN).
 * Le `userId` est TOUJOURS lu depuis la session — jamais accepté en body.
 *
 * Toujours retourné, même si `ENABLE_PUSH=false` : l'écran de préférences
 * doit pouvoir s'afficher pour permettre une réactivation manuelle.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { log } from "@/lib/logger";
import { PreferencesPatchSchema } from "@/lib/push/schemas";
import {
  getOrCreatePreference,
  updatePreference,
} from "@/lib/push/preferences";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  try {
    const pref = await getOrCreatePreference(user.id);
    return NextResponse.json(pref, { headers: PRIVATE_HEADERS });
  } catch (err) {
    log.error("push.prefs.get.failed", {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Preferences read failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
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
  const parsed = PreferencesPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const pref = await updatePreference(user.id, parsed.data);
    return NextResponse.json(pref, { headers: PRIVATE_HEADERS });
  } catch (err) {
    log.error("push.prefs.patch.failed", {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Preferences update failed" },
      { status: 500 },
    );
  }
}
