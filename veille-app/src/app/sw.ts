// SW_VERSION = 2 — bump pour invalider les caches RSC stale (cf. fix /today
// affichant "En service" l'après-midi sur des shifts du matin). Toute modif
// de ce fichier change le hash de sw.js → Serwist force l'update côté client.
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

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
