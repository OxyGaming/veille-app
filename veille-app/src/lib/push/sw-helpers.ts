/**
 * Helpers purs pour le service worker push (C5).
 *
 * Extraits du SW (`src/app/sw.ts`) pour être testables sans WorkerGlobal
 * et sans `self.location`. Le SW les importe et fournit `origin` au
 * runtime.
 *
 * Conventions :
 *  - `parsePushPayload` est tolérant : un payload absent/invalide
 *    génère un payload de fallback (mieux qu'une notif silencieuse).
 *  - `normalizePushTargetUrl` est strict : tout `targetUrl` non
 *    same-origin retombe sur `/notifications`. Aucune fuite hors app.
 */

export type PushPayload = {
  notificationId: string | null;
  title: string;
  body: string;
  targetUrl: string | null;
  tag: string | null;
};

/** Fallback affichage si payload absent / invalide. */
export const FALLBACK_TITLE = "Veille";
export const FALLBACK_BODY = "Vous avez une nouvelle notification.";

/** Fallback navigation si `targetUrl` invalide ou cross-origin. */
export const FALLBACK_TARGET_URL = "/notifications";

/** Icônes utilisées par défaut. Doivent exister dans `public/icons/`. */
export const NOTIFICATION_ICON = "/icons/icon-192.png";
export const NOTIFICATION_BADGE = "/icons/icon-32.png";

/**
 * Normalise n'importe quoi en `PushPayload`. Tolérant : si une clé
 * manque ou a un type imprévu, on retombe sur les fallbacks.
 *
 * Important : ne lit JAMAIS de champs non listés ici — pas d'évaluation
 * dynamique, pas de propagation d'attributs HTML non sanitizés.
 */
export function parsePushPayload(raw: unknown): PushPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      notificationId: null,
      title: FALLBACK_TITLE,
      body: FALLBACK_BODY,
      targetUrl: null,
      tag: null,
    };
  }
  const r = raw as Record<string, unknown>;
  return {
    notificationId:
      typeof r.notificationId === "string" && r.notificationId.length > 0
        ? r.notificationId
        : null,
    title:
      typeof r.title === "string" && r.title.length > 0
        ? r.title
        : FALLBACK_TITLE,
    body:
      typeof r.body === "string" && r.body.length > 0 ? r.body : FALLBACK_BODY,
    targetUrl: typeof r.targetUrl === "string" ? r.targetUrl : null,
    tag: typeof r.tag === "string" && r.tag.length > 0 ? r.tag : null,
  };
}

/**
 * Renvoie un chemin same-origin sûr à utiliser dans `clients.openWindow`
 * ou `WindowClient.navigate`.
 *
 * Règles :
 *  - `null`/`undefined`/string vide → `/notifications`
 *  - Path absolu commençant par `/` (mais pas `//`) → conservé tel quel
 *  - URL protocole-relatif `//evil.com/x` → rejeté
 *  - URL absolue same-origin → on garde uniquement `pathname+search+hash`
 *  - URL absolue cross-origin → rejeté
 *  - URL invalide (parse error) → rejeté
 *
 * Le rejet retombe TOUJOURS sur `/notifications` — pas de propagation
 * d'un targetUrl partiellement invalide.
 */
export function normalizePushTargetUrl(
  targetUrl: string | null | undefined,
  origin: string,
): string {
  if (!targetUrl || typeof targetUrl !== "string") return FALLBACK_TARGET_URL;
  // Protocole-relatif (`//host/x`) — interdit, peut sortir de l'origin.
  if (targetUrl.startsWith("//")) return FALLBACK_TARGET_URL;
  // Path absolu (`/foo`) — bornée à l'origin courant côté navigation.
  if (targetUrl.startsWith("/")) return targetUrl;
  // URL absolue — doit matcher l'origin du SW.
  try {
    const u = new URL(targetUrl);
    if (u.origin !== origin) return FALLBACK_TARGET_URL;
    return u.pathname + u.search + u.hash;
  } catch {
    return FALLBACK_TARGET_URL;
  }
}

/**
 * Compose `(title, options)` pour `self.registration.showNotification`.
 *
 * `tag` est repris depuis le payload : si deux push successifs partagent
 * le même tag, l'OS remplace la première par la seconde (pas de stack).
 * `renotify: true` n'est appliqué que si `tag` est présent — c'est requis
 * par la spec sinon le browser ignore.
 */
export function buildNotificationOptions(
  payload: PushPayload,
  origin: string,
): { title: string; options: NotificationOptions } {
  const safeTarget = normalizePushTargetUrl(payload.targetUrl, origin);
  const options: NotificationOptions = {
    body: payload.body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    data: {
      notificationId: payload.notificationId,
      targetUrl: safeTarget,
    },
  };
  if (payload.tag) {
    options.tag = payload.tag;
    // renotify déclenche un son/vibration même si une notif avec le même
    // tag est en cours d'affichage — souhaité côté Veille (échéance qui
    // s'aggrave, nouvelle action sur l'agent).
    (options as NotificationOptions & { renotify?: boolean }).renotify = true;
  }
  return { title: payload.title, options };
}

/**
 * Extrait `targetUrl` du `notification.data` posé par
 * `buildNotificationOptions` puis le re-normalise (défense en profondeur :
 * si un autre code écrit dans `data`, on garantit toujours un same-origin).
 */
export function readTargetUrlFromNotification(
  data: unknown,
  origin: string,
): string {
  if (!data || typeof data !== "object") return FALLBACK_TARGET_URL;
  const t = (data as { targetUrl?: unknown }).targetUrl;
  return normalizePushTargetUrl(typeof t === "string" ? t : null, origin);
}
