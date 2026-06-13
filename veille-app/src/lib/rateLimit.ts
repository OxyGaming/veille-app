/**
 * Rate-limit in-memory pour le login (US-1.7).
 *
 * Stratégie : sliding window 15 min, comptage par clé (IP + email).
 *  - 1 ou 2 échecs : aucune restriction (utilisateur légitime qui se trompe).
 *  - 3e échec : délai 30 s avant prochaine tentative.
 *  - 4e échec : 60 s.
 *  - 5e échec : 2 min.
 *  - 6e échec et au-delà : 10 min de blocage rolling.
 * Reset complet après login réussi.
 *
 * Limitations connues :
 *  - In-memory : ne survit pas au reboot du serveur ni au déploiement
 *    multi-instance. Migration vers Redis recommandée si scale > 1 instance
 *    (Sprint 5+, cf. MT-01 PostgreSQL prérequis).
 *  - Clé (IP, email) : un attaquant peut varier l'email pour contourner sur
 *    une IP donnée. Atténué par le coût scrypt côté serveur. Une seconde
 *    couche par IP-globale est envisageable mais hors périmètre US-1.7.
 *  - Pas de protection contre les attaques distribuées (IP rotation).
 *
 * Cf. AUDIT.md §M3 / BACKLOG-V2.md US-1.7.
 */

/** Délai minimal entre 2 tentatives selon le nombre d'échecs cumulés. */
const BACKOFFS_MS = [
  0, // 0 échec → OK
  0, // 1 échec → OK
  0, // 2 échecs → OK (brief : "1 ou 2 erreurs ne doivent pas bloquer")
  30_000, // 3e échec → 30 s
  60_000, // 4e échec → 60 s
  120_000, // 5e échec → 2 min
];

/** Au-delà du dernier seuil, blocage long roulant. */
const HARD_BLOCK_MS = 10 * 60 * 1000;

/** Fenêtre de mesure : un échec plus vieux que ça est oublié. */
const WINDOW_MS = 15 * 60 * 1000;

type Attempts = number[];
const buckets = new Map<string, Attempts>();

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; failCount: number };

export function buildLoginKey(ip: string | null, email: string): string {
  return `${ip ?? "unknown"}|${email.toLowerCase()}`;
}

function prune(arr: Attempts, now: number): Attempts {
  return arr.filter((ts) => now - ts < WINDOW_MS);
}

/**
 * Décide si une nouvelle tentative est autorisée pour cette clé.
 * Ne modifie pas le compteur — à appeler AVANT verifyPassword.
 */
export function checkLoginRateLimit(key: string): RateLimitDecision {
  const now = Date.now();
  const arr = prune(buckets.get(key) ?? [], now);
  buckets.set(key, arr);
  const failCount = arr.length;
  if (failCount === 0) return { ok: true };

  const lastFailTs = arr[arr.length - 1];
  const sinceLastMs = now - lastFailTs;

  // 6e échec et au-delà : blocage long.
  if (failCount >= BACKOFFS_MS.length) {
    if (sinceLastMs < HARD_BLOCK_MS) {
      return { ok: false, retryAfterMs: HARD_BLOCK_MS - sinceLastMs, failCount };
    }
    return { ok: true };
  }

  const required = BACKOFFS_MS[failCount];
  if (sinceLastMs < required) {
    return { ok: false, retryAfterMs: required - sinceLastMs, failCount };
  }
  return { ok: true };
}

/**
 * Enregistre un échec — à appeler après verifyPassword négatif OU si
 * l'utilisateur n'existe pas / est inactif (pour ne pas révéler l'existence
 * par le timing d'absence d'échec).
 */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const arr = prune(buckets.get(key) ?? [], now);
  arr.push(now);
  buckets.set(key, arr);
}

/** Réinitialise le compteur après login réussi. */
export function resetLoginAttempts(key: string): void {
  buckets.delete(key);
}

/** Extrait l'IP du client (best-effort, derrière proxy ou non). */
export function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) {
    const r = real.trim();
    if (r) return r;
  }
  return null;
}

/** Réservé tests — vide tous les compteurs. */
export function __resetAllForTests(): void {
  buckets.clear();
}
