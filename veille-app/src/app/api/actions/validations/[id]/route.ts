import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

const patchSchema = z.object({
  comment: z.string().nullable().optional(),
  realizedAt: z.string().datetime().optional(),
});

/**
 * Édition d'une validation d'action — un admin peut corriger la date ou
 * le commentaire si l'utilisateur s'est trompé.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.actionValidation.findFirst({
    where: { id, ...teamScope(u) },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
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
  const updated = await prisma.actionValidation.update({
    where: { id },
    data: {
      comment:
        parsed.data.comment === undefined ? undefined : parsed.data.comment,
      realizedAt: parsed.data.realizedAt
        ? new Date(parsed.data.realizedAt)
        : undefined,
    },
  });
  return NextResponse.json(updated);
}

/**
 * Annulation d'une validation. Repasse l'action correspondante en ACTIVE si
 * c'était la seule validation, et la libère.
 *
 * Réservé ADMIN/EDITOR.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.actionValidation.findFirst({
    where: { id, ...teamScope(u) },
    select: { id: true, actionId: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.actionValidation.delete({ where: { id } });
    // Si l'action n'a plus de validation, on la repasse en ACTIVE.
    if (existing.actionId) {
      const remaining = await tx.actionValidation.count({
        where: { actionId: existing.actionId },
      });
      if (remaining === 0) {
        await tx.importedAction.update({
          where: { id: existing.actionId },
          data: { localStatus: "ACTIVE" },
        });
      }
    }
  });
  return NextResponse.json({ ok: true });
}
