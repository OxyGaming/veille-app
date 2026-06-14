/**
 * POST /api/notifications/read-all — marquage en lot (Sprint 5 C5).
 *
 * Marque toutes les notifications non-lues du user courant comme lues.
 * Renvoie `{ ok, count }` où `count` = nombre de rows mises à jour.
 *
 * Accès : USER + EDITOR + ADMIN (D2). Scope strict par userId.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const count = await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true, count });
}
