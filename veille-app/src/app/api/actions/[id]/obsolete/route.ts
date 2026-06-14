/**
 * POST /api/actions/[id]/obsolete (Sprint 7 C1).
 *
 * Marque une action comme `localStatus = "OBSOLETE"`. Logique métier
 * centralisée dans `obsoleteAction()` (cf. `@/lib/action-obsolete`).
 *
 * Sécurité :
 *  - USER → 403 (requireRole)
 *  - EDITOR/ADMIN hors scope → 404 (pas de fuite d'existence)
 *  - EDITOR/ADMIN scope OK → 200 (ou 409 si déjà validée)
 *
 * Réponses :
 *  - 200 `{ok:true, actionId, previousStatus, newStatus:"OBSOLETE"}`
 *  - 200 `{ok:true, actionId, previousStatus:"OBSOLETE",
 *           newStatus:"OBSOLETE", noop:true}` (idempotent)
 *  - 409 `{ok:false, code:"ACTION_VALIDATED", error, actionId,
 *           currentStatus:"VALIDATED_LOCAL"}`
 *  - 404 `{ok:false, error:"Action introuvable"}`
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { obsoleteAction } from "@/lib/action-obsolete";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const result = await obsoleteAction(user, id);

  switch (result.kind) {
    case "ok":
    case "noop":
      return NextResponse.json({
        ok: true,
        actionId: result.actionId,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        ...(result.kind === "noop" ? { noop: true } : {}),
      });
    case "validated":
      return NextResponse.json(
        {
          ok: false,
          code: "ACTION_VALIDATED",
          error:
            "Annulez la validation avant de retirer cette action.",
          actionId: result.actionId,
          currentStatus: result.currentStatus,
        },
        { status: 409 },
      );
    case "not_found":
      return NextResponse.json(
        { ok: false, error: "Action introuvable" },
        { status: 404 },
      );
  }
}
