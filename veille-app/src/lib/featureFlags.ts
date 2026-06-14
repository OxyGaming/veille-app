/**
 * Feature flags lus côté serveur (Node, RSC, route handlers).
 *
 * Pour exposer un flag côté client, le passer en prop depuis un Server
 * Component vers un Client Component. Ne pas lire process.env côté client
 * sans préfixe NEXT_PUBLIC_.
 */

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
  return defaultValue;
}

/**
 * Écran Aujourd'hui (Sprint 2 — US-2.1).
 * Activé par défaut. Désactivable en production via `ENABLE_TODAY=false`
 * pour rollback rapide en cas de régression.
 */
export function isTodayEnabled(): boolean {
  return readBool(process.env.ENABLE_TODAY, true);
}
