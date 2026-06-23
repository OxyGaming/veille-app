/**
 * Helpers Notification (Sprint 5 C2).
 *
 * `createNotification` est non-bloquant : il try/catch toute erreur
 * Prisma et renvoie `null` en cas d'échec (dédup `P2002` y compris).
 * Les routes métier doivent l'appeler après leur mutation pour éviter
 * qu'un échec notification ne propage à l'utilisateur.
 *
 * Voir [memory/business-rules.md] §Notifications pour les types
 * acceptés (V1 — 4 types) et la convention de `dedupKey`.
 */

import type { Notification } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { sendPushNotification } from "@/lib/push/sender";

/** Types de notification V1 (cf. D3 Sprint 5 + Sprint Push V1 C9). */
export const NOTIFICATION_TYPES = [
  "ACTION_ASSIGNED_TO_ME",
  "ACTION_VALIDATED_ON_MY_ACTION",
  "VISIT_FINISHED_ON_MY_SITE",
  "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
  /** Sprint Push V1 C9 — ajout du destinataire dans une équipe. */
  "TEAM_MEMBERSHIP_ADDED",
  /** Sprint Push V1 C9 — nouvel élément dans l'historique de l'équipe. */
  "TEAM_HISTORY_ADDED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isKnownNotificationType(v: string): v is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(v);
}

/**
 * Entrée pour `createNotification`. `dedupKey` est conseillé pour
 * éviter qu'un même événement déclenche plusieurs lignes au même
 * destinataire (cas multi-équipes, double appel, etc.).
 *
 * Convention de `dedupKey` :
 *  - `{TYPE}:{sourceId}` pour les événements one-shot
 *    (ex. `ACTION_ASSIGNED_TO_ME:cmqxxx`)
 *  - `{TYPE}:{sourceId}:{YYYY-MM-DD}` pour les types récurrents
 *    (ex. `ECHEANCE_CRITICAL_ON_MY_PERIMETER:siteId:2026-06-14`)
 */
export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetUrl?: string | null;
  dedupKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Crée une notification. Non-bloquant : renvoie `null` si :
 *  - dédup `P2002` sur `(userId, dedupKey)` — comportement souhaité
 *  - autre erreur Prisma — loggée puis `null`
 *
 * Aucun throw n'est jamais propagé : les routes métier peuvent
 * l'appeler en `await` sans `try` supplémentaire.
 *
 * **Side-effect push (Sprint Push V1 — C6).** En cas de succès, déclenche
 * `sendPushNotification` en fire-and-forget. La fonction sender est
 * garantie « never throws » (catch interne + retour discriminant), et
 * l'appel est non-await pour ne JAMAIS retarder la création de la
 * Notification in-app. Une protection `.catch()` finale absorbe tout
 * unhandledRejection en environnement Node strict.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  let row: Notification;
  try {
    row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        targetUrl: input.targetUrl ?? null,
        dedupKey: input.dedupKey ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // Dédup attendue — silencieux mais traçable en debug.
      log.debug("notification.dedup.skip", {
        userId: input.userId,
        type: input.type,
        dedupKey: input.dedupKey,
      });
      return null;
    }
    log.error("notification.create.failed", {
      userId: input.userId,
      type: input.type,
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }

  // Fire-and-forget — n'affecte jamais le caller métier.
  sendPushNotification({
    userId: row.userId,
    notification: {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      targetUrl: row.targetUrl,
      dedupKey: row.dedupKey,
    },
  }).catch((e) => {
    log.error("notification.push.fire-and-forget.failed", {
      userId: row.userId,
      type: row.type,
      err: e instanceof Error ? e.message : String(e),
    });
  });

  return row;
}

/**
 * Marque une notification comme lue **si** elle appartient à `userId`.
 * Renvoie `true` si une row a été mise à jour (exactement 1).
 * Idempotent : marquer une notif déjà lue renvoie `false` (pas de
 * row affectée par `where: { readAt: null }`).
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Marque toutes les notifications non lues d'un utilisateur comme
 * lues. Renvoie le nombre de rows mises à jour.
 */
export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Compteur léger non-lues — utilisé par le badge du header (C5). */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
