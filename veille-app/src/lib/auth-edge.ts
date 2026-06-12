/**
 * Vérification de cookie compatible Edge Runtime (proxy.ts, Server Components).
 *
 * Format imposé : base64(secret:userId).
 * - secret : VEILLE_AUTH_SECRET (côté serveur uniquement)
 * - userId : id (cuid) de l'utilisateur
 *
 * Pas de Buffer/crypto Node ici : seulement `atob` / `btoa`,
 * disponibles dans le runtime Edge V8.
 */

export const COOKIE_NAME = "veille-auth";
export const ROLES = ["ADMIN", "EDITOR", "USER"] as const;
export type Role = (typeof ROLES)[number];

function getSecret(): string {
  const s = process.env.VEILLE_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "VEILLE_AUTH_SECRET manquant ou trop court (16 chars minimum)."
    );
  }
  return s;
}

/** Encode "secret:userId" en base64. */
export function encodeToken(userId: string): string {
  const raw = `${getSecret()}:${userId}`;
  // btoa attend une chaîne ASCII : on échappe préventivement pour les ids cuid (ASCII).
  return btoa(raw);
}

/**
 * Décode un token et retourne le userId si la signature secret correspond,
 * sinon `null`. Aucun throw — le caller décide.
 */
export function decodeToken(token: string | undefined | null): string | null {
  if (!token) return null;
  let raw: string;
  try {
    raw = atob(token);
  } catch {
    return null;
  }
  const idx = raw.indexOf(":");
  if (idx === -1) return null;
  const secret = raw.slice(0, idx);
  const userId = raw.slice(idx + 1);
  if (secret !== getSecret()) return null;
  if (!userId) return null;
  return userId;
}
