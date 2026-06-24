import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertTeamAccess } from "@/lib/auth";
import {
  defaultMessageFor,
  formatQuotedSnippet,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";
import { notifyActionValidated } from "@/lib/notifications-generators";
import { getEquipmentLinkForAction } from "@/lib/equipment-action-link";
import { log } from "@/lib/logger";

const schema = z.object({
  comment: z.string().nullable().optional(),
  realizedAt: z.string().datetime().optional(),
  /**
   * C12 — Mise à jour optionnelle de l'équipement remplacé.
   * Présent uniquement si l'action provient d'une NC d'équipement
   * périssable (vérifié côté serveur via getEquipmentLinkForAction).
   * Accepte "YYYY-MM-DD" ou ISO datetime.
   */
  equipmentUpdate: z
    .object({
      expirationDate: z.string().min(8).max(40),
    })
    .optional()
    .nullable(),
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

  // C12 — Si l'action est liée à un équipement de visite INVENTORY,
  // on récupère les infos pour potentiellement remettre à neuf la date
  // de péremption au catalogue. Tolérant : null si pas lié, le flow
  // continue avec la validation classique.
  const equipmentLink = await getEquipmentLinkForAction(action.id);
  const equipmentUpdate = parsed.data.equipmentUpdate ?? null;

  // Validation cohérence — un equipmentUpdate ne peut être appliqué que
  // si l'action est effectivement liée à un équipement périssable.
  // On accepte le payload mais on n'update QUE dans ce cas (idempotent
  // en cascade de doublons).
  let parsedExpiration: Date | null = null;
  const shouldUpdateEquipment = !!(
    equipmentUpdate &&
    equipmentLink &&
    equipmentLink.isPerishable
  );
  if (shouldUpdateEquipment && equipmentUpdate) {
    const raw = equipmentUpdate.expirationDate;
    // Accepte "YYYY-MM-DD" (input HTML date) et ISO complet.
    const normalized = raw.length === 10 ? `${raw}T00:00:00.000Z` : raw;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Date de péremption invalide" },
        { status: 400 },
      );
    }
    parsedExpiration = d;
  }

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
    if (shouldUpdateEquipment && parsedExpiration && equipmentLink) {
      await tx.siteEquipment.update({
        where: { id: equipmentLink.equipmentId },
        data: { expirationDate: parsedExpiration },
      });
    }
    return validation;
  });

  // C12 — Flux d'activité EQUIPMENT_REPLACED quand on a réellement
  // remis à neuf le catalogue. Push aux membres équipe via C9 + C10.
  // Hors transaction : la trace n'a pas à bloquer la validation.
  if (shouldUpdateEquipment && parsedExpiration && equipmentLink) {
    const eqLabel = `${equipmentLink.equipmentCategory} — ${equipmentLink.equipmentLabel}`;
    const detailBits: string[] = [];
    detailBits.push(
      `Péremption ${parsedExpiration.toISOString().slice(0, 10)}.`,
    );
    await recordActivitySafe({
      teamIds: equipmentLink.teamIds,
      actorId: u.id,
      actorName: u.name,
      type: "EQUIPMENT_REPLACED",
      entityType: "equipment",
      entityId: equipmentLink.equipmentId,
      entityLabel: eqLabel,
      message: joinActivityParts([
        defaultMessageFor({
          type: "EQUIPMENT_REPLACED",
          actorName: u.name,
          entityLabel: eqLabel,
        }),
        detailBits.join(" ") || null,
      ]),
      targetUrl: `/sites/${equipmentLink.siteId}`,
      metadata: {
        equipmentId: equipmentLink.equipmentId,
        siteId: equipmentLink.siteId,
        actionId: action.id,
        previousDiscrepancyType: equipmentLink.discrepancyType,
        newExpirationDate: parsedExpiration.toISOString(),
      },
    });
    log.info("action.validate.equipment-replaced", {
      actionId: action.id,
      equipmentId: equipmentLink.equipmentId,
      userId: u.id,
    });
  }

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
    // Enrichi C10 — commentaire de validation s'il est fourni.
    message: joinActivityParts([
      defaultMessageFor({
        type: "ACTION_VALIDATED",
        actorName: u.name,
        entityLabel: label,
      }),
      formatQuotedSnippet(parsed.data.comment),
    ]),
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
