/**
 * Sentry — configuration serveur (Node runtime).
 *
 * Inactif si `SENTRY_DSN` n'est pas défini : aucun appel réseau, aucune
 * capture, aucun overhead à l'exécution.
 *
 * Cf. AUDIT.md §MT-09 / BACKLOG-V2.md US-1.10.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
