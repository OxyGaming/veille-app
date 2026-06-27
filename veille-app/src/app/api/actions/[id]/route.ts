import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import { obsoleteAction } from "@/lib/action-obsolete";

const patchSchema = z.object({
  localStatus: z
    .enum(["ACTIVE", "VALIDATED", "OBSOLETE", "ARCHIVED"])
    .optional(),
  comment: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

/** PATCH d'une action importée — utile pour corriger un statut ou une échéance. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    // Édition d'action ouverte à tout utilisateur authentifié (gestion des
    // actions back-office) ; cloisonnement strict via teamScope ci-dessous.
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  // Cloisonnement STRICT : seule l'équipe propriétaire de l'action peut la
  // modifier (teamScope, pas actionScope — pas de mutation via agent/site partagé).
  const a = await prisma.importedAction.findFirst({
    where: { id, ...teamScope(u) },
    select: { id: true },
  });
  if (!a) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const updated = await prisma.importedAction.update({
    where: { id },
    data: {
      localStatus: data.localStatus,
      comment: data.comment === undefined ? undefined : data.comment,
      dueAt:
        data.dueAt === undefined
          ? undefined
          : data.dueAt === null
          ? null
          : new Date(data.dueAt),
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
    },
  });
  return NextResponse.json(updated);
}

/**
 * Suppression d'une action importée.
 *  - ?mode=soft (défaut) : localStatus="OBSOLETE". L'action disparaît des
 *    listes "à faire" mais reste consultable via filtres.
 *  - ?mode=hard : suppression définitive si aucune ActionValidation rattachée.
 *    Sinon 409 — il faudra d'abord retirer les validations.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    // Suppression d'action ouverte à tout utilisateur authentifié ;
    // cloisonnement strict via teamScope sur le findFirst ci-dessous.
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  // Cloisonnement STRICT : suppression réservée à l'équipe propriétaire.
  const a = await prisma.importedAction.findFirst({
    where: { id, ...teamScope(u) },
    select: { id: true, keyPoint: true },
  });
  if (!a) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  if (mode === "soft") {
    // Sprint 7 C1 — délégation à la logique métier centrale pour
    // garantir l'AuditLog ACTION_OBSOLETE + statuts uniformes.
    const result = await obsoleteAction(u, id);
    if (result.kind === "validated") {
      return NextResponse.json(
        {
          ok: false,
          code: "ACTION_VALIDATED",
          error: "Annulez la validation avant de retirer cette action.",
          actionId: result.actionId,
          currentStatus: result.currentStatus,
        },
        { status: 409 },
      );
    }
    if (result.kind === "not_found") {
      return NextResponse.json(
        { ok: false, error: "Action introuvable" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      actionId: result.actionId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      ...(result.kind === "noop" ? { noop: true } : {}),
    });
  }

  const validations = await prisma.actionValidation.count({
    where: { actionId: id },
  });
  if (validations > 0) {
    return NextResponse.json(
      {
        error: `Action a ${validations} validation(s). Supprimez-les d'abord ou utilisez l'archivage.`,
        counts: { validations },
      },
      { status: 409 }
    );
  }
  await prisma.importedAction.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: a.keyPoint });
}
