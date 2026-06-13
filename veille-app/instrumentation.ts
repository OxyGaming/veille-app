/**
 * Instrumentation Next.js — hook auto-discovery pour Sentry.
 *
 * `register()` est appelé une fois au démarrage du runtime ; on charge la
 * config appropriée selon `NEXT_RUNTIME`. Sans `SENTRY_DSN`, les configs
 * sont no-op : pas d'overhead.
 *
 * `onRequestError` est invoqué par Next.js sur chaque erreur de route ;
 * délégué à Sentry (no-op sans DSN).
 *
 * Cf. AUDIT.md §MT-09 / BACKLOG-V2.md US-1.10.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
