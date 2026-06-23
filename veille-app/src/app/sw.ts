// SW_VERSION = 3 — bump pour invalider les caches RSC stale (cf. fix /today
// affichant "En service" l'après-midi sur des shifts du matin) ET intégration
// des listeners push V1 (Sprint Push C5). Toute modif de ce fichier change
// le hash de sw.js → Serwist force l'update côté client.
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import {
  buildNotificationOptions,
  parsePushPayload,
  readTargetUrlFromNotification,
} from "@/lib/push/sw-helpers";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Routes "live" qui dépendent de `new Date()` côté serveur et dont la mise
 * en cache RSC produit un affichage erroné (statut shift figé). La règle
 * NetworkOnly doit être placée AVANT `...defaultCache` pour court-circuiter
 * les matchers `pages-rsc` / `pages-rsc-prefetch` de Serwist.
 */
const ALWAYS_LIVE = /^\/(today|api\/today|api\/echeances)(\/|$|\?)/;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && ALWAYS_LIVE.test(url.pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// ─── Push notifications (Sprint Push V1 — C5) ───────────────────────────────

/**
 * Listener push — affiche une notification depuis le payload web-push.
 *
 * Tolère un payload absent / invalide en retombant sur un fallback
 * minimal côté `parsePushPayload` (mieux qu'une notif silencieuse qui
 * ferait croire à un bug serveur).
 *
 * Le `tag` du payload est utilisé pour dédupliquer côté OS : un nouveau
 * push avec le même tag remplace la notif existante (cf. dedupKey
 * partagé avec la table Notification côté serveur).
 */
self.addEventListener("push", (event: PushEvent) => {
  let raw: unknown = null;
  if (event.data) {
    try {
      raw = event.data.json();
    } catch {
      raw = null;
    }
  }
  const payload = parsePushPayload(raw);
  const { title, options } = buildNotificationOptions(
    payload,
    self.location.origin,
  );
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Listener notificationclick — focus la fenêtre existante (en la
 * naviguant vers `targetUrl` si possible) ou en ouvre une nouvelle.
 *
 * `targetUrl` est re-normalisé via `readTargetUrlFromNotification` —
 * défense en profondeur contre un payload ayant glissé une URL externe
 * jusque dans `notification.data`.
 *
 * Stratégie :
 *  1. Ferme la notification cliquée.
 *  2. Énumère les fenêtres existantes (`matchAll`).
 *  3. Si une fenêtre same-origin existe → `navigate` puis `focus`.
 *     Fallback `focus` simple si `navigate` jette (browser ancien).
 *  4. Sinon `clients.openWindow(targetUrl)`.
 */
self.addEventListener(
  "notificationclick",
  (event: NotificationEvent) => {
    event.notification.close();
    const targetUrl = readTargetUrlFromNotification(
      event.notification.data,
      self.location.origin,
    );
    event.waitUntil(
      (async () => {
        const all = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of all) {
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
              return client.focus();
            } catch {
              // Browsers anciens : navigate peut throw — focus simple suffit.
            }
          }
          return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      })(),
    );
  },
);

/**
 * Listener pushsubscriptionchange — déclenché quand le push service
 * rotate ou invalide un endpoint (cf. RFC 8030 §6.1).
 *
 * Stratégie V1 — pas de resubscribe automatique dans le SW :
 *  - On n'a pas accès à `NEXT_PUBLIC_VAPID_PUBLIC_KEY` injectée à
 *    runtime dans le worker (Serwist ne fait pas d'env replacement
 *    côté SW). Ré-importer la clé fragile et risquer une desync.
 *  - L'ancien `endpoint` reste en base. Il sera purgé par la
 *    suppression auto sur 404/410 dès le prochain envoi serveur.
 *  - Le client se réabonne au prochain chargement de page via
 *    `usePushNotifications` (probe + bouton « Activer »).
 *
 * Si Apple/iOS impose un resubscribe côté SW à terme, on injectera la
 * clé via un endpoint `/api/push/vapid-public-key` lu en async.
 */
self.addEventListener("pushsubscriptionchange", (event: ExtendableEvent) => {
  // Pas de resubscribe en V1 — l'event est juste consommé pour ne pas
  // laisser le SW dans un état d'erreur silencieuse.
  event.waitUntil(Promise.resolve());
});
