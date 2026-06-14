import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertTeamAccess } from "@/lib/auth";
import {
  defaultMessageFor,
  recordActivitySafe,
} from "@/lib/activityFeed";
import { notifyActionValidated } from "@/lib/notifications-generators";

const schema = z.object({
  comment: z.string().nullable().optional(),
  realizedAt: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const action = await prisma.importedAction.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberships: { select: { teamId: true } },
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          memberships: { select: { teamId: true } },
        },
      },
    },
  });
  if (!action) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, action.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const realizedAt = parsed.data.realizedAt ? new Date(parsed.data.realizedAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const validation = await tx.actionValidation.create({
      data: {
        actionId: action.id,
        agentId: action.agentId,
        validatedById: u.id,
        teamId: action.teamId,
        realizedAt,
        comment: parsed.data.comment ?? null,
      },
    });
    await tx.importedAction.update({
      where: { id: action.id },
      data: { localStatus: "VALIDATED_LOCAL", realizedAt },
    });
    return validation;
  });

  // Flux d'activité — la stratégie multi-team dépend de la cible de l'action :
  //  - agent : duplique sur toutes les équipes de l'agent ;
  //  - site  : duplique sur toutes les équipes du site ;
  //  - sinon : fallback sur l'équipe legacy de l'action.
  // targetUrl pointe vers la fiche agent si possible, sinon fiche site.
  const label =
    action.keyPoint?.trim() ||
    action.comment?.trim() ||
    `Action ${action.externalId}`;
  const teamIdSet = new Set<string>([action.teamId]);
  if (action.agent) {
    for (const m of action.agent.memberships) teamIdSet.add(m.teamId);
  }
  if (action.site) {
    for (const m of action.site.memberships) teamIdSet.add(m.teamId);
  }
  const targetUrl = action.agent
    ? `/agents/${action.agent.id}`
    : action.site
      ? `/sites/${action.site.id}`
      : null;
  await recordActivitySafe({
    teamIds: [...teamIdSet],
    actorId: u.id,
    actorName: u.name,
    type: "ACTION_VALIDATED",
    entityType: "action",
    entityId: action.id,
    entityLabel: label,
    message: defaultMessageFor({
      type: "ACTION_VALIDATED",
      actorName: u.name,
      entityLabel: label,
    }),
    targetUrl,
    metadata: {
      actionId: action.id,
      agentId: action.agentId,
      siteId: action.siteId,
      validationId: result.id,
      realizedAt: realizedAt.toISOString(),
    },
  });

  // Notification personnelle (Sprint 5 C3) — non-bloquante.
  await notifyActionValidated({
    actionId: action.id,
    agentId: action.agentId,
    siteId: action.siteId,
    teamIds: [...teamIdSet],
    validatorId: u.id,
    validatorName: u.name,
    actionLabel: label,
  });

  return NextResponse.json(result);
}
