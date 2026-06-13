/**
 * Sentry — configuration client (browser).
 *
 * Inactif si `NEXT_PUBLIC_SENTRY_DSN` n'est pas défini : aucun appel
 * réseau, aucune capture, aucun overhead à l'exécution.
 *
 * Cf. AUDIT.md §MT-09 / BACKLOG-V2.md US-1.10.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    // Échantillonnage des traces : ajustable selon volume. 10 % par défaut.
    tracesSampleRate: 0.1,
    // Ne pas envoyer d'IP ni d'identifiants par défaut (RGPD / brief commit 9).
    sendDefaultPii: false,
    // Pas de session replay (capture potentielle d'écran sensible).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
