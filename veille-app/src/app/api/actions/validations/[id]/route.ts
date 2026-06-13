import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope, assertTeamAccess } from "@/lib/auth";

/**
 * Fenêtre d'annulation libre d'une validation depuis l'UI (US-1.12).
 * Au-delà, l'icône poubelle disparaît côté agent/[id], et le DELETE
 * renvoie 410 — sauf si ADMIN, qui garde la possibilité de corriger
 * en cas d'erreur opérationnelle.
 */
const CANCEL_WINDOW_MS = 5 * 60 * 1000;

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
 * Règles d'autorisation (US-1.12) :
 *  - USER     : peut annuler sa propre validation pendant 5 min.
 *  - EDITOR   : peut annuler toute validation de son périmètre pendant 5 min.
 *  - ADMIN    : peut annuler à tout moment (filet de sécurité opérationnel).
 *
 * Toute annulation est tracée dans `AuditLog` (action = "ACTION_VALIDATION_CANCELLED").
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
  const { id } = await ctx.params;
  const existing = await prisma.actionValidation.findUnique({
    where: { id },
    select: {
      id: true,
      actionId: true,
      teamId: true,
      validatedById: true,
      createdAt: true,
    },
  });
  if (!existing)
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Périmètre équipe — refus systématique si la validation n'est pas dans
  // les équipes de l'utilisateur (sauf ADMIN ou viewAllTeams).
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // USER : doit être l'auteur de sa propre validation. EDITOR/ADMIN peuvent
  // corriger l'erreur d'autrui dans leur périmètre.
  if (u.role === "USER" && existing.validatedById !== u.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Fenêtre de 5 min pour USER + EDITOR. ADMIN bypass pour filet opérationnel.
  const ageMs = Date.now() - existing.createdAt.getTime();
  if (u.role !== "ADMIN" && ageMs > CANCEL_WINDOW_MS) {
    return NextResponse.json(
      { error: "Délai d'annulation dépassé (5 minutes)" },
      { status: 410 }
    );
  }

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
    await tx.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "ACTION_VALIDATION_CANCELLED",
        entity: "ActionValidation",
        entityId: id,
        details: JSON.stringify({
          actionId: existing.actionId,
          ageMs,
          byAuthor: existing.validatedById === u.id,
        }),
      },
    });
  });
  return NextResponse.json({ ok: true });
}
