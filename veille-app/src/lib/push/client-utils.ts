/**
 * Helpers purs côté client pour le push (C4).
 *
 * Tout ce qui peut être testé sans toucher `window` / `navigator` vit
 * ici. Le hook `usePushNotifications` consomme ces helpers et fait
 * l'orchestration DOM.
 */

import type { SubscribeBody } from "@/lib/push/schemas";

export type PushPlatform = "android" | "ios" | "desktop" | "other";

/**
 * Convertit une clé VAPID base64url en `Uint8Array` exigé par
 * `PushManager.subscribe({ applicationServerKey })`.
 *
 * Pure : ne touche pas le DOM. `atob` est disponible dans Node ≥ 16 et
 * tous les browsers cibles.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const result = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    result[i] = rawData.charCodeAt(i);
  }
  return result;
}

/**
 * Détecte la plateforme depuis un user-agent. Best-effort, sert au
 * tracking et à l'UI conditionnelle (jamais à la sécurité).
 *
 * Note iPadOS 13+ : Safari iPad renvoie le UA Mac. Le caller peut
 * réinjecter `ios` après détection de `navigator.maxTouchPoints > 1`.
 */
export function detectPlatform(userAgent: string): PushPlatform {
  const ua = userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Mac OS X|Linux/i.test(ua)) return "desktop";
  return "other";
}

/** Forme retournée par `PushSubscription.toJSON()` côté browser. */
export type RawPushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

/**
 * Compose le body envoyé à `POST /api/push/subscribe` à partir d'une
 * `PushSubscription` (JSON) et du contexte client. Retourne `null` si
 * les clés ne sont pas exposées (browser dégradé, rare).
 *
 * Le serveur revalide via Zod — ce helper ne fait que normaliser.
 */
export function buildSubscribePayload(
  raw: RawPushSubscriptionJson,
  context: { userAgent: string; platform: PushPlatform },
): SubscribeBody | null {
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) return null;
  return {
    endpoint: raw.endpoint,
    keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
    platform: context.platform,
    userAgent: context.userAgent.slice(0, 500),
  };
}

/**
 * Vérifie les pré-requis browser pour le push, à partir d'un snapshot
 * `globals`. Pure : le caller capture l'état depuis `window` /
 * `navigator` puis appelle ce helper.
 *
 * Renvoie un discriminant exploitable directement par l'UI.
 */
export type PushSupportProbe = {
  hasPushManager: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  isSecureContext: boolean;
  hasVapidKey: boolean;
};

export type PushSupportVerdict =
  | { status: "supported" }
  | { status: "unsupported" }
  | { status: "insecure" }
  | { status: "vapid-missing" };

export function probePushSupport(p: PushSupportProbe): PushSupportVerdict {
  if (!p.hasPushManager || !p.hasNotification || !p.hasServiceWorker) {
    return { status: "unsupported" };
  }
  if (!p.isSecureContext) return { status: "insecure" };
  if (!p.hasVapidKey) return { status: "vapid-missing" };
  return { status: "supported" };
}
