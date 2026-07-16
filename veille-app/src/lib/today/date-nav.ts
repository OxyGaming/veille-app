/**
 * Utilitaires purs pour la navigation par jour de l'écran Aujourd'hui
 * (`?date=YYYY-MM-DD`).
 *
 * Contrairement à `startOfDay`/`startOfWeekParis` utilisés ailleurs dans
 * today/sources.ts et today/planning.ts (qui supposent que le process
 * serveur tourne en Europe/Paris — approximation V1 acceptée), ce module
 * calcule les bornes de jour via `Intl.DateTimeFormat` et reste donc correct
 * quel que soit le fuseau de la machine qui exécute Next.js (dev Windows
 * inclus). Cette précision est scoped à la navigation par date ; les calculs
 * d'échéances existants ne sont pas touchés.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Formate un instant en date calendaire Europe/Paris (`YYYY-MM-DD`). */
export function parisDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Valide `raw` (query param `?date=`) ; retombe sur "aujourd'hui" (Paris) si absent/invalide. */
export function parseDateParam(
  raw: string | undefined | null,
  now: Date = new Date(),
): string {
  if (raw && isValidDateStr(raw)) return raw;
  return parisDateStr(now);
}

/** `dateStr` décalé de `delta` jours calendaires (peut être négatif). */
export function addDaysToDateStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Instant UTC correspondant à minuit Europe/Paris pour `dateStr`.
 * Convergence par correction de décalage (offset toujours entier en heures
 * pour Europe/Paris — CET/CEST) : 1 itération suffit, 2 par sécurité.
 */
function parisMidnightUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  let guess = targetUtcMs;
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(guess));
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const shownUtcMs = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour) === 24 ? 0 : Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    guess += targetUtcMs - shownUtcMs;
  }
  return new Date(guess);
}

/** Bornes [start, end) du jour calendaire `dateStr` en Europe/Paris. */
export function parisDayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: parisMidnightUtc(dateStr),
    end: parisMidnightUtc(addDaysToDateStr(dateStr, 1)),
  };
}

/** `true` si `dateStr` correspond au jour calendaire Europe/Paris de `now`. */
export function isTodayParis(dateStr: string, now: Date = new Date()): boolean {
  return dateStr === parisDateStr(now);
}

/**
 * Libellé FR long ("mercredi 15 juillet") pour un jour donné — aligné sur
 * `formatFrenchDate` de TodayHeader mais à partir d'un `dateStr` plutôt que
 * d'un instant (évite tout aller-retour de fuseau côté affichage).
 */
export function formatFrenchDayLabel(dateStr: string): string {
  const bounds = parisDayBounds(dateStr);
  // Midi Paris du jour ciblé : évite tout risque de bascule de jour lors du
  // formatage (contrairement à `bounds.start`, exactement à la frontière).
  const noon = new Date(bounds.start.getTime() + 12 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(noon);
}
