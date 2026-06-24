/**
 * GET /api/actions/[id]/equipment-link (C12).
 *
 * Renvoie les infos d'équipement liées à une action générée par une NC
 * de visite INVENTORY, ou 200+`{ linked: false }` si l'action n'est pas
 * liée à un équipement (action manuelle, action héritée, etc.).
 *
 * Utilisé par le client AVANT POST validate :
 *  - si `linked=true` et `isPerishable=true` → ouvre ResolveEquipmentModal
 *    pour saisir la nouvelle date de péremption avant de valider.
 *  - sinon → validation classique sans modal.
 *
 * Accès : tous rôles authentifiés. Le `teamScope` est appliqué côté
 * action pour éviter une fuite d'info hors équipe.
 */

import { NextResponse } from "next/server";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEquipmentLinkForAction } from "@/lib/equipment-action-link";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;

  // Cloisonnement : on charge l'action pour vérifier la team du user.
  const action = await prisma.importedAction.findUnique({
    where: { id },
    select: { teamId: true },
  });
  if (!action) {
    return NextResponse.json({ error: "Action inconnue" }, { status: 404 });
  }
  if (!assertTeamAccess(u, action.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const link = await getEquipmentLinkForAction(id);
  if (!link) {
    return NextResponse.json(
      { linked: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    { linked: true, ...link },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
