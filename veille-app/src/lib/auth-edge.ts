/**
 * Vérification de cookie compatible Edge Runtime (proxy.ts, Server Components).
 *
 * Format signé : `base64url(payload).base64url(HMAC-SHA256(payload))`
 *  - payload = `${userId}.${expEpochMs}`
 *  - signature HMAC-SHA256 sur le payload encodé, clé = VEILLE_AUTH_SECRET
 *  - expiration embarquée → un token volé périme ; permet la révocation par TTL
 *
 * Uniquement des primitives disponibles en Edge V8 : `crypto.subtle`,
 * `TextEncoder`/`TextDecoder`, `atob`/`btoa`. Pas de Buffer/crypto Node.
 *
 * Les fonctions sont ASYNC (Web Crypto l'impose). Anciens cookies au format
 * `base64(secret:userId)` deviennent invalides → simple reconnexion.
 */

export const COOKIE_NAME = "veille-auth";
export const ROLES = ["ADMIN", "EDITOR", "USER"] as const;
export type Role = (typeof ROLES)[number];

/** Durée de vie d'un token (30 jours) — alignée sur le maxAge du cookie. */
export const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getSecret(): string {
  const s = process.env.VEILLE_AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "VEILLE_AUTH_SECRET manquant ou trop court (16 chars minimum)."
    );
  }
  return s;
}

const enc = new TextEncoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

/** Comparaison à temps constant (Edge n'a pas timingSafeEqual). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Encode un token signé + horodaté pour `userId`. */
export async function encodeToken(userId: string): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payloadB64 = b64urlFromBytes(enc.encode(`${userId}.${exp}`));
  const sig = b64urlFromBytes(await hmac(payloadB64));
  return `${payloadB64}.${sig}`;
}

/**
 * Décode + vérifie un token : signature HMAC valide ET non expiré.
 * Retourne le `userId` ou `null`. Aucun throw — le caller décide.
 */
export async function decodeToken(
  token: string | undefined | null
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  let expected: string;
  try {
    expected = b64urlFromBytes(await hmac(payloadB64));
  } catch {
    return null;
  }
  if (!timingSafeEqualStr(sig, expected)) return null;
  let payload: string;
  try {
    payload = new TextDecoder().decode(bytesFromB64url(payloadB64));
  } catch {
    return null;
  }
  const idx = payload.lastIndexOf(".");
  if (idx === -1) return null;
  const userId = payload.slice(0, idx);
  const exp = Number(payload.slice(idx + 1));
  if (!userId || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;
  return userId;
}
