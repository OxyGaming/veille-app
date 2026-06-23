/**
 * Service serveur d'envoi push (Sprint Push V1 — C6).
 *
 * Principe NON NÉGOCIABLE :
 *  - Le push ne décide JAMAIS du périmètre.
 *  - Il part toujours d'une `Notification` déjà créée pour un `userId`.
 *  - Aucune logique équipe ici : `getNotificationRecipients` reste la
 *    seule source de vérité du scope.
 *
 * Chaîne :
 *   createNotification(...) ─→ Notification row ─→ sendPushNotification(
 *     { userId: row.userId, notification: row, category })
 *
 * Le service est tolérant : il ne throw jamais en cas d'erreur métier
 * (config, préférences, push service). Le résultat est un discriminant
 * `{ status }` utilisable par le caller ou les logs.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { isPushEnabled } from "@/lib/featureFlags";
import { getCategoryForType } from "@/lib/push/categories";
import { getOrCreatePreference } from "@/lib/push/preferences";
import { hashEndpoint } from "@/lib/push/subscriptions";

export type PushNotificationInput = {
  /** PK Notification — sera transmise en `data.notificationId` côté SW. */
  id: string;
  /** Type métier (sert au mapping catégorie). */
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  /** Sera utilisé comme `tag` côté OS pour la déduplication. */
  dedupKey: string | null;
};

export type SendPushInput = {
  userId: string;
  notification: PushNotificationInput;
};

export type SendPushOutcome =
  | {
      status: "skipped";
      reason:
        | "disabled"
        | "no-vapid"
        | "no-category"
        | "push-pref-off"
        | "category-off"
        | "no-subscription"
        | "internal";
    }
  | { status: "sent"; sent: number; failed: number; removed: number };

// ─── Configuration VAPID (lazy + memoizée) ──────────────────────────────────

let vapidConfigured: boolean | null = null;

/**
 * Configure `web-push` avec les clés VAPID. Memoizé : la même config
 * survit toute la durée du process. Reset implicite à chaque redémarrage.
 *
 * Renvoie `false` si une variable est absente — le caller skip alors
 * l'envoi sans throw.
 */
function configureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  // On lit la clé publique côté serveur via la même variable que le
  // client (NEXT_PUBLIC_VAPID_PUBLIC_KEY). Permet de garder UNE seule
  // source de vérité pour le couple (public, private).
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  const subj = process.env.VAPID_SUBJECT ?? "";
  if (!pub || !priv || !subj) {
    vapidConfigured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subj, pub, priv);
    vapidConfigured = true;
    return true;
  } catch (e) {
    log.error("push.vapid.config-failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    vapidConfigured = false;
    return false;
  }
}

/** Reset le cache de config — exclusivement pour les tests. */
export function _resetVapidConfigCacheForTests(): void {
  vapidConfigured = null;
}

// ─── Service d'envoi ────────────────────────────────────────────────────────

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Compose le payload JSON envoyé au SW (cf. C5 — parsePushPayload).
 *
 * Minimal : aucune PII, aucun champ libre. Le SW utilise `notificationId`
 * pour relier au Centre de notifications et `tag` pour dédupliquer côté OS.
 */
function buildWebPushPayload(n: PushNotificationInput): string {
  return JSON.stringify({
    notificationId: n.id,
    title: n.title,
    body: n.message,
    targetUrl: n.targetUrl ?? null,
    tag: n.dedupKey ?? null,
  });
}

/**
 * Envoi vers une subscription. Retourne `void` ; les erreurs sont
 * propagées via la promise (le caller utilise `Promise.allSettled`).
 *
 * Extrait pour faciliter le mock unitaire dans les tests.
 */
async function sendToSubscription(
  sub: SubscriptionRow,
  payload: string,
): Promise<void> {
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    payload,
  );
}

/**
 * Renvoie le code HTTP d'une erreur `web-push`. Best-effort — la lib
 * expose `statusCode` mais on garde un fallback.
 */
function extractStatusCode(err: unknown): number {
  if (
    err &&
    typeof err === "object" &&
    "statusCode" in err &&
    typeof (err as { statusCode: unknown }).statusCode === "number"
  ) {
    return (err as { statusCode: number }).statusCode;
  }
  return 0;
}

/**
 * Envoie une notification push à tous les terminaux d'un user.
 *
 * Garanties :
 *  - Ne throw JAMAIS — toute erreur est consignée et retournée sous
 *    forme de `skipped:internal`.
 *  - Respecte ENABLE_PUSH, VAPID config, préférences (push + catégorie),
 *    présence de subscriptions.
 *  - Sur 404/410 → supprime la row (endpoint mort).
 *  - Sur autre erreur → met à jour `lastErrorAt`/`lastErrorCode`.
 *  - Sur succès → met à jour `lastSuccessAt` et reset les error fields.
 *  - Concurrence : `Promise.allSettled` sur l'ensemble. En V1, un user
 *    a ~1-5 devices ; pas de batch nécessaire.
 *
 * Aucun log d'endpoint en clair (uniquement `hashEndpoint`).
 */
export async function sendPushNotification(
  input: SendPushInput,
): Promise<SendPushOutcome> {
  try {
    if (!isPushEnabled()) {
      return { status: "skipped", reason: "disabled" };
    }
    if (!configureVapid()) {
      log.error("push.send.skip.no-vapid", {
        userId: input.userId,
        type: input.notification.type,
      });
      return { status: "skipped", reason: "no-vapid" };
    }
    const category = getCategoryForType(input.notification.type);
    if (!category) {
      // Type pas branché push en V1 — comportement attendu et silencieux.
      return { status: "skipped", reason: "no-category" };
    }

    const pref = await getOrCreatePreference(input.userId);
    if (!pref.pushEnabled) {
      return { status: "skipped", reason: "push-pref-off" };
    }
    if (!pref[category]) {
      return { status: "skipped", reason: "category-off" };
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: input.userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) {
      return { status: "skipped", reason: "no-subscription" };
    }

    const payload = buildWebPushPayload(input.notification);
    const results = await Promise.allSettled(
      subs.map((s) => sendToSubscription(s, payload)),
    );

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sub = subs[i];
      if (r.status === "fulfilled") {
        sent++;
        await prisma.pushSubscription
          .updateMany({
            where: { id: sub.id },
            data: {
              lastSuccessAt: new Date(),
              lastErrorAt: null,
              lastErrorCode: null,
            },
          })
          .catch((e) =>
            log.warn("push.send.update.success.failed", {
              err: e instanceof Error ? e.message : String(e),
            }),
          );
        continue;
      }

      const code = extractStatusCode(r.reason);
      log.warn("push.send.fail", {
        userId: input.userId,
        type: input.notification.type,
        endpointHash: hashEndpoint(sub.endpoint),
        status: code,
      });

      if (code === 404 || code === 410) {
        await prisma.pushSubscription
          .deleteMany({ where: { id: sub.id } })
          .catch((e) =>
            log.warn("push.send.delete.failed", {
              err: e instanceof Error ? e.message : String(e),
            }),
          );
        removed++;
      } else {
        failed++;
        await prisma.pushSubscription
          .updateMany({
            where: { id: sub.id },
            data: {
              lastErrorAt: new Date(),
              lastErrorCode: code || 500,
            },
          })
          .catch((e) =>
            log.warn("push.send.update.error.failed", {
              err: e instanceof Error ? e.message : String(e),
            }),
          );
      }
    }

    log.info("push.send.done", {
      userId: input.userId,
      type: input.notification.type,
      sent,
      failed,
      removed,
    });
    return { status: "sent", sent, failed, removed };
  } catch (err) {
    // Filet de sécurité — sendPushNotification ne doit JAMAIS faire
    // remonter une erreur au caller (qui est createNotification, donc
    // dans le hot path métier).
    log.error("push.send.unexpected", {
      userId: input.userId,
      type: input.notification.type,
      err: err instanceof Error ? err.message : String(err),
    });
    return { status: "skipped", reason: "internal" };
  }
}
