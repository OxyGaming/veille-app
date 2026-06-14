/**
 * POST /api/notifications/[id]/read — marquage individuel (Sprint 5 C5).
 *
 * Marque la notification comme lue **si** elle appartient au user
 * courant. Renvoie `{ ok, updated }` où `updated` = `true` si une row
 * a été modifiée (idempotent : déjà lue → `false`, pas une erreur).
 *
 * Accès : USER + EDITOR + ADMIN (D2).
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const { id } = await ctx.params;
  const updated = await markNotificationRead(user.id, id);
  return NextResponse.json({ ok: true, updated });
}
