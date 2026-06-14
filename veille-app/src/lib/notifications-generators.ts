/**
 * Générateurs de notifications (Sprint 5 C3).
 *
 * Chaque générateur :
 *  - Calcule la liste des destinataires via `getNotificationRecipients`
 *    (scope multi-équipes strict, exclusion de l'acteur).
 *  - Appelle `createNotification` une fois par destinataire.
 *  - La dédup `@@unique([userId, dedupKey])` garantit qu'un même
 *    événement ne crée pas N notifs sur un même user.
 *  - Non-bloquant : aucun throw propagé, les routes métier appellent
 *    `await` sans `try` supplémentaire.
 */

import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { createNotification } from "./notifications";
import type { EcheanceItem } from "@/lib/echeances/types";

/**
 * Renvoie les userIds destinataires (EDITOR + ADMIN par défaut) qui
 * appartiennent à au moins une des équipes fournies, sauf l'utilisateur
 * exclu (typiquement l'acteur de l'événement).
 */
export async function getNotificationRecipients(
  teamIds: string[],
  excludeUserId: string | null,
  options: { rolesIn?: ("USER" | "EDITOR" | "ADMIN")[] } = {},
): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const rolesIn = options.rolesIn ?? ["EDITOR", "ADMIN"];
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: rolesIn },
        OR: [
          { teamId: { in: teamIds } },
          { memberships: { some: { teamId: { in: teamIds } } } },
        ],
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch (e) {
    log.error("notifications.recipients.failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

// ─── Type 1 — ACTION_ASSIGNED_TO_ME ──────────────────────────────────────────

export type NotifyActionAssignedInput = {
  actionId: string;
  agentId: string;
  agentName: string;
  teamIds: string[];
  authorId: string;
  actionLabel: string;
};

/**
 * Notifie les EDITOR + ADMIN des équipes liées à l'action (équipe
 * principale + memberships agent), sauf l'auteur.
 *
 * Dédup : `ACTION_ASSIGNED_TO_ME:{actionId}` — 1 notif par destinataire
 * à vie de l'action.
 *
 * `targetUrl` = fiche agent avec ancre actionId.
 */
export async function notifyActionAssigned(
  input: NotifyActionAssignedInput,
): Promise<number> {
  const recipients = await getNotificationRecipients(
    input.teamIds,
    input.authorId,
  );
  const dedupKey = `ACTION_ASSIGNED_TO_ME:${input.actionId}`;
  const targetUrl = `/agents/${input.agentId}?actionId=${input.actionId}`;
  let created = 0;
  for (const userId of recipients) {
    const row = await createNotification({
      userId,
      type: "ACTION_ASSIGNED_TO_ME",
      title: "Nouvelle action",
      message: `Une action a été ajoutée sur ${input.agentName} : ${input.actionLabel}`,
      targetUrl,
      dedupKey,
      metadata: {
        actionId: input.actionId,
        agentId: input.agentId,
      },
    });
    if (row) created++;
  }
  return created;
}

// ─── Type 2 — ACTION_VALIDATED_ON_MY_ACTION ─────────────────────────────────

export type NotifyActionValidatedInput = {
  actionId: string;
  agentId: string | null;
  siteId: string | null;
  teamIds: string[];
  validatorId: string;
  validatorName: string;
  actionLabel: string;
};

/**
 * Notifie les EDITOR + ADMIN du périmètre de l'action (équipes liées
 * + memberships agent/site), sauf le validateur.
 *
 * Dédup : `ACTION_VALIDATED_ON_MY_ACTION:{actionId}` — 1 notif par
 * destinataire à vie de l'action.
 *
 * `targetUrl` = fiche agent si présent, sinon fiche site, sinon /today.
 */
export async function notifyActionValidated(
  input: NotifyActionValidatedInput,
): Promise<number> {
  const recipients = await getNotificationRecipients(
    input.teamIds,
    input.validatorId,
  );
  const dedupKey = `ACTION_VALIDATED_ON_MY_ACTION:${input.actionId}`;
  const targetUrl = input.agentId
    ? `/agents/${input.agentId}?actionId=${input.actionId}`
    : input.siteId
      ? `/sites/${input.siteId}`
      : "/today";
  let created = 0;
  for (const userId of recipients) {
    const row = await createNotification({
      userId,
      type: "ACTION_VALIDATED_ON_MY_ACTION",
      title: "Action validée",
      message: `${input.validatorName} a validé : ${input.actionLabel}`,
      targetUrl,
      dedupKey,
      metadata: {
        actionId: input.actionId,
        agentId: input.agentId,
        siteId: input.siteId,
      },
    });
    if (row) created++;
  }
  return created;
}

// ─── Type 3 — VISIT_FINISHED_ON_MY_SITE ──────────────────────────────────────

export type NotifyVisitFinishedInput = {
  visitId: string;
  siteId: string;
  siteName: string;
  teamIds: string[];
  observerId: string;
  observerName: string;
};

/**
 * Notifie les EDITOR + ADMIN des équipes du site, sauf l'observateur.
 *
 * Dédup : `VISIT_FINISHED_ON_MY_SITE:{visitId}` — 1 notif par
 * destinataire à vie de la visite.
 *
 * `targetUrl` = rapport de visite.
 */
export async function notifyVisitFinished(
  input: NotifyVisitFinishedInput,
): Promise<number> {
  const recipients = await getNotificationRecipients(
    input.teamIds,
    input.observerId,
  );
  const dedupKey = `VISIT_FINISHED_ON_MY_SITE:${input.visitId}`;
  const targetUrl = `/visits/${input.visitId}/report`;
  let created = 0;
  for (const userId of recipients) {
    const row = await createNotification({
      userId,
      type: "VISIT_FINISHED_ON_MY_SITE",
      title: "Visite terminée",
      message: `${input.observerName} a terminé une visite sur ${input.siteName}`,
      targetUrl,
      dedupKey,
      metadata: {
        visitId: input.visitId,
        siteId: input.siteId,
      },
    });
    if (row) created++;
  }
  return created;
}

// ─── Type 4 — ECHEANCE_CRITICAL_ON_MY_PERIMETER ──────────────────────────────

/**
 * Crée une notification par item critique de l'utilisateur, avec dédup
 * stricte par `(userId, kind, sourceId)`.
 *
 * Appelée depuis `aggregateEditor` après calcul des échéances. La
 * dédup `@@unique` empêche le spam : si l'item reste critique entre
 * deux refresh, aucune nouvelle notif n'est créée.
 *
 * `targetUrl` = `item.cta.href` (déjà calculé par C9 Sprint 4).
 */
export async function notifyEcheancesCriticalForUser(
  userId: string,
  items: EcheanceItem[],
): Promise<number> {
  const criticalItems = items.filter((i) => i.isCritical);
  if (criticalItems.length === 0) return 0;
  let created = 0;
  for (const item of criticalItems) {
    // sourceId = la part après ':' dans l'id composite
    const sourceId = item.id.includes(":")
      ? item.id.slice(item.id.indexOf(":") + 1)
      : item.id;
    const dedupKey = `ECHEANCE_CRITICAL_ON_MY_PERIMETER:${item.kind}:${sourceId}`;
    const row = await createNotification({
      userId,
      type: "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
      title: shortTitleFor(item.kind),
      message: composeEcheanceMessage(item),
      targetUrl: item.cta.href,
      dedupKey,
      metadata: {
        kind: item.kind,
        sourceId,
        siteId: item.context.siteId,
        agentId: item.context.agentId,
      },
    });
    if (row) created++;
  }
  return created;
}

function shortTitleFor(kind: EcheanceItem["kind"]): string {
  switch (kind) {
    case "VISIT_QUARTERLY":
      return "Visite trimestrielle critique";
    case "VISIT_PLANNED":
      return "Visite planifiée critique";
    case "EQUIPMENT_EXPIRING":
      return "Équipement périmé";
    case "ACTION_OVERDUE":
      return "Action critique";
  }
}

function composeEcheanceMessage(item: EcheanceItem): string {
  const parts: string[] = [item.title];
  if (item.subtitle) parts.push(item.subtitle);
  if (item.daysToDue === null) {
    parts.push("jamais effectué");
  } else if (item.daysToDue < 0) {
    parts.push(`en retard de ${-item.daysToDue} j`);
  }
  return parts.join(" — ");
}
