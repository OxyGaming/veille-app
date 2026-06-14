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

/** Types de notification V1 (cf. D3 Sprint 5). */
export const NOTIFICATION_TYPES = [
  "ACTION_ASSIGNED_TO_ME",
  "ACTION_VALIDATED_ON_MY_ACTION",
  "VISIT_FINISHED_ON_MY_SITE",
  "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
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
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  try {
    return await prisma.notification.create({
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
