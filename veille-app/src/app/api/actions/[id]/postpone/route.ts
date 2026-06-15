import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { actionScope, requireRole } from "@/lib/auth";

const schema = z.object({
  dueAt: z.string().datetime(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Reporte l'échéance d'une action importée (Hub Échéances — bouton « Reporter »).
 *
 * - Refuse les actions OBSOLETE ou VALIDATED_LOCAL (non actionnables).
 * - Transaction : update dueAt + AuditLog ACTION_POSTPONED contenant
 *   l'ancienne et la nouvelle date, plus la raison saisie par l'utilisateur.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const action = await prisma.importedAction.findFirst({
    where: { id, ...actionScope(u) },
    select: {
      id: true,
      localStatus: true,
      dueAt: true,
      agentId: true,
      siteId: true,
      teamId: true,
      keyPoint: true,
      comment: true,
      externalId: true,
    },
  });
  if (!action) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }
  if (action.localStatus === "OBSOLETE" || action.localStatus === "VALIDATED_LOCAL") {
    return NextResponse.json(
      {
        error: "Action non actionnable",
        code: action.localStatus,
      },
      { status: 409 }
    );
  }

  const newDueAt = new Date(parsed.data.dueAt);
  const label =
    action.keyPoint?.trim() ||
    action.comment?.trim() ||
    `Action ${action.externalId}`;

  await prisma.$transaction([
    prisma.importedAction.update({
      where: { id: action.id },
      data: { dueAt: newDueAt },
    }),
    prisma.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "ACTION_POSTPONED",
        entity: "ImportedAction",
        entityId: action.id,
        details: JSON.stringify({
          previousDueAt: action.dueAt?.toISOString() ?? null,
          newDueAt: newDueAt.toISOString(),
          reason: parsed.data.reason,
          agentId: action.agentId,
          siteId: action.siteId,
          teamId: action.teamId,
          label,
        }),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    id: action.id,
    dueAt: newDueAt.toISOString(),
  });
}
