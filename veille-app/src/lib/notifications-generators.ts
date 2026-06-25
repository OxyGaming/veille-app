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
  /** Cible agent : requise si l'action est rattachée à un agent. */
  agentId?: string;
  agentName?: string;
  /** Cible site : requise si l'action est rattachée à un site. */
  siteId?: string;
  siteName?: string;
  teamIds: string[];
  authorId: string;
  actionLabel: string;
};

/**
 * Notifie les EDITOR + ADMIN des équipes liées à l'action (équipe
 * principale + memberships agent/site), sauf l'auteur.
 *
 * Dédup : `ACTION_ASSIGNED_TO_ME:{actionId}` — 1 notif par destinataire
 * à vie de l'action.
 *
 * `targetUrl` = fiche agent si agentId présent, sinon fiche site.
 */
export async function notifyActionAssigned(
  input: NotifyActionAssignedInput,
): Promise<number> {
  const recipients = await getNotificationRecipients(
    input.teamIds,
    input.authorId,
  );
  const dedupKey = `ACTION_ASSIGNED_TO_ME:${input.actionId}`;
  const targetUrl = input.agentId
    ? `/agents/${input.agentId}?actionId=${input.actionId}`
    : input.siteId
      ? `/sites/${input.siteId}`
      : "/today";
  const targetName = input.agentName ?? input.siteName ?? "?";
  let created = 0;
  for (const userId of recipients) {
    const row = await createNotification({
      userId,
      type: "ACTION_ASSIGNED_TO_ME",
      title: "Nouvelle action",
      message: `Une action a été ajoutée sur ${targetName} : ${input.actionLabel}`,
      targetUrl,
      dedupKey,
      metadata: {
        actionId: input.actionId,
        ...(input.agentId ? { agentId: input.agentId } : {}),
        ...(input.siteId ? { siteId: input.siteId } : {}),
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
    case "VEHICLE_ROUND":
      return "Tournée VS critique";
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

// ─── Type 5 — TEAM_MEMBERSHIP_ADDED (Sprint Push V1 C9) ──────────────────────

export type NotifyTeamMembershipAddedInput = {
  /** Destinataire — l'utilisateur ajouté à l'équipe. */
  userId: string;
  teamId: string;
  teamName: string;
  /** ADMIN qui a effectué l'ajout (peut être le destinataire lui-même). */
  actorId?: string | null;
};

/**
 * Notifie l'utilisateur ajouté à une équipe. USER + EDITOR + ADMIN
 * peuvent recevoir.
 *
 * Décision actor self-add (admin qui s'ajoute lui-même) : on notifie
 * quand même. Raison : trace dans le centre de notifications,
 * cohérent avec la règle « le destinataire = l'utilisateur ajouté ».
 *
 * Dédup : `TEAM_MEMBERSHIP_ADDED:{teamId}:{userId}`. Conséquence
 * acceptée V1 : retirer puis réajouter ne re-notifie pas (la notif
 * précédente est toujours en base).
 *
 * `targetUrl` = `/today` — pas de page équipe accessible aux non-ADMIN.
 */
export async function notifyTeamMembershipAdded(
  input: NotifyTeamMembershipAddedInput,
): Promise<number> {
  const dedupKey = `TEAM_MEMBERSHIP_ADDED:${input.teamId}:${input.userId}`;
  const row = await createNotification({
    userId: input.userId,
    type: "TEAM_MEMBERSHIP_ADDED",
    title: "Nouvelle équipe",
    message: `Vous avez été ajouté à l'équipe ${input.teamName}.`,
    targetUrl: "/today",
    dedupKey,
    metadata: {
      teamId: input.teamId,
      actorId: input.actorId ?? null,
    },
  });
  return row ? 1 : 0;
}

/**
 * Variante non-bloquante (catch + log). À utiliser dans les routes
 * mutantes pour ne jamais casser l'opération principale d'ajout.
 */
export async function notifyTeamMembershipAddedSafe(
  input: NotifyTeamMembershipAddedInput,
): Promise<number> {
  try {
    return await notifyTeamMembershipAdded(input);
  } catch (e) {
    log.error("notifications.team-membership.failed", {
      userId: input.userId,
      teamId: input.teamId,
      err: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

// ─── Type 6 — TEAM_HISTORY_ADDED (Sprint Push V1 C9) ─────────────────────────

export type NotifyTeamHistoryAddedInput = {
  /** Équipes concernées par l'événement (union à notifier). */
  teamIds: string[];
  /** Type d'entité d'origine (visit, session, action, agent, equipment, site). */
  entityType: string;
  entityId: string;
  /** Auteur de l'event — exclu des destinataires. Null si système. */
  actorId?: string | null;
  /** URL cible déjà calculée par `recordActivity`. Fallback `/history`. */
  targetUrl?: string | null;
  /**
   * Sprint Push V1 C9.1 — message métier déjà formaté (acteur + action +
   * entité), tel que stocké dans `TeamActivity.message`. Si fourni,
   * remplace le message générique « Un nouvel élément a été ajouté… »
   * pour donner immédiatement le contexte au destinataire.
   *
   * Exemples :
   *  - « Marie a terminé une visite — POS-LYON. »
   *  - « Jessy a validé une action — Affichage poste 7. »
   *
   * Le `title` reste « Équipe {teamName} » quand un detailMessage est
   * fourni, sinon « Nouvel élément d'historique ».
   */
  detailMessage?: string | null;
};

/**
 * Notifie les membres actifs des équipes concernées qu'un nouvel
 * élément a été ajouté à leur historique.
 *
 * Règles cloisonnement :
 *  - SELECT users WHERE membership.teamId IN (input.teamIds) AND
 *    user.isActive = true. → JAMAIS un user hors équipe.
 *  - Dédup côté résultat (un user dans N équipes du périmètre →
 *    1 seule notification, garantie par la clé Unique sur
 *    (userId, dedupKey) avec userId dans dedupKey).
 *  - Acteur exclu.
 *
 * Dédup : `TEAM_HISTORY_ADDED:{entityType}:{entityId}:{userId}` —
 * un même event ne crée jamais N notifs au même user.
 *
 * Le push suit en cascade via `createNotification → sendPushNotification`
 * (C6). `catEquipes=false` côté préférence → push skip, notif in-app
 * conservée. Conforme spec.
 */
export async function notifyTeamHistoryAdded(
  input: NotifyTeamHistoryAddedInput,
): Promise<number> {
  const teamIds = [
    ...new Set(input.teamIds.filter((t): t is string => typeof t === "string" && t.length > 0)),
  ];
  if (teamIds.length === 0) return 0;

  try {
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    // Memberships : on récupère une row par (user, team) du périmètre,
    // active, hors acteur. La dédup user est appliquée côté JS pour
    // garder la 1ère teamName rencontrée (suffisant pour le message
    // générique demandé en spec).
    const memberships = await prisma.userTeam.findMany({
      where: {
        teamId: { in: teamIds },
        user: { isActive: true },
        ...(input.actorId ? { userId: { not: input.actorId } } : {}),
      },
      select: { userId: true, teamId: true },
    });

    const userToTeamName = new Map<string, string>();
    for (const m of memberships) {
      if (userToTeamName.has(m.userId)) continue;
      userToTeamName.set(m.userId, teamNameById.get(m.teamId) ?? "—");
    }

    let created = 0;
    const targetUrl = input.targetUrl ?? "/history";
    const detail = input.detailMessage?.trim() || null;
    for (const [userId, teamName] of userToTeamName) {
      const dedupKey = `TEAM_HISTORY_ADDED:${input.entityType}:${input.entityId}:${userId}`;
      // Avec detailMessage : title = équipe (cloisonnement visible),
      // message = détail métier (acteur + action + entité).
      // Sans : on garde le couple générique (compat C9 initial).
      const title = detail
        ? `Équipe ${teamName}`
        : "Nouvel élément d'historique";
      const message = detail
        ? detail
        : `Un nouvel élément a été ajouté dans l'historique de l'équipe ${teamName}.`;
      const row = await createNotification({
        userId,
        type: "TEAM_HISTORY_ADDED",
        title,
        message,
        targetUrl,
        dedupKey,
        metadata: {
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.actorId ?? null,
          teamName,
        },
      });
      if (row) created++;
    }
    return created;
  } catch (e) {
    log.error("notifications.team-history.failed", {
      teamIds,
      entityType: input.entityType,
      entityId: input.entityId,
      err: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}
