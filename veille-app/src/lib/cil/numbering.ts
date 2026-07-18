/**
 * Numérotation des dépêches du Livret CIL — réservation PAR INCIDENT.
 *
 * Le livret est un carnet propre à chaque incident : chaque plage repart à
 * son minimum. L'unicité est garantie côté serveur par `@@unique([incidentId,
 * numeroDonne])` (le `create` échoue → retry). Ce module est pur : il calcule
 * le prochain numéro libre et la grille de disponibilité pour l'affichage.
 *
 * Plages (imprimé officiel) :
 *  - 10–29 : protections (circulation + électrique)
 *  - 30–49 : reprises / rétablissements
 *  - 50–69 : dépêches libres (carnet)
 */
import type { DepecheSubtype } from "./types";

export type NumberRangeKey = "PROTECTION" | "RETABLISSEMENT" | "LIBRE";

export const NUMBER_RANGES: Record<NumberRangeKey, readonly [number, number]> = {
  PROTECTION: [10, 29],
  RETABLISSEMENT: [30, 49],
  LIBRE: [50, 69],
};

/** Mappe un sous-type de dépêche vers sa plage de numéros. */
export function rangeKeyForSubtype(subtype: DepecheSubtype): NumberRangeKey {
  switch (subtype) {
    case "PROTECTION_CIRCULATION":
    case "PROTECTION_ELECTRIQUE":
      return "PROTECTION";
    case "REPRISE_PARTIELLE":
    case "REPRISE_NORMALE":
    case "RETABLISSEMENT_PARTIEL":
    case "RETABLISSEMENT_NORMAL":
      return "RETABLISSEMENT";
    case "LIBRE":
      return "LIBRE";
  }
}

export function rangeForSubtype(
  subtype: DepecheSubtype,
): readonly [number, number] {
  return NUMBER_RANGES[rangeKeyForSubtype(subtype)];
}

/**
 * Prochain numéro libre dans la plage, ou `null` si la plage est épuisée.
 * `used` = numéros déjà attribués (tous subtypes confondus de l'incident).
 */
export function nextAvailableNumber(
  range: readonly [number, number],
  used: Iterable<number>,
): number | null {
  const usedSet = used instanceof Set ? used : new Set(used);
  const [min, max] = range;
  for (let n = min; n <= max; n++) {
    if (!usedSet.has(n)) return n;
  }
  return null;
}

/** Prochain numéro libre pour un sous-type donné. */
export function nextNumberForSubtype(
  subtype: DepecheSubtype,
  used: Iterable<number>,
): number | null {
  return nextAvailableNumber(rangeForSubtype(subtype), used);
}

/**
 * Tire un numéro libre AU HASARD dans la plage (les numéros donnés doivent
 * être aléatoires, pas séquentiels). `null` si la plage est pleine.
 * `rng` injectable pour les tests déterministes (défaut `Math.random`).
 */
export function randomAvailableNumber(
  range: readonly [number, number],
  used: Iterable<number>,
  rng: () => number = Math.random,
): number | null {
  const usedSet = used instanceof Set ? used : new Set(used);
  const [min, max] = range;
  const free: number[] = [];
  for (let n = min; n <= max; n++) if (!usedSet.has(n)) free.push(n);
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

/** Tirage aléatoire d'un numéro libre pour un sous-type donné. */
export function randomNumberForSubtype(
  subtype: DepecheSubtype,
  used: Iterable<number>,
  rng: () => number = Math.random,
): number | null {
  return randomAvailableNumber(rangeForSubtype(subtype), used, rng);
}

export type NumberCell = { n: number; used: boolean };
export type AvailabilityGrid = Record<NumberRangeKey, NumberCell[]>;

/**
 * Grille de disponibilité des 3 plages pour l'affichage temps réel de la
 * réglette (numéros utilisés barrés). `used` = numéros déjà attribués.
 */
export function availabilityGrid(used: Iterable<number>): AvailabilityGrid {
  const usedSet = used instanceof Set ? used : new Set(used);
  const build = ([min, max]: readonly [number, number]): NumberCell[] => {
    const cells: NumberCell[] = [];
    for (let n = min; n <= max; n++) cells.push({ n, used: usedSet.has(n) });
    return cells;
  };
  return {
    PROTECTION: build(NUMBER_RANGES.PROTECTION),
    RETABLISSEMENT: build(NUMBER_RANGES.RETABLISSEMENT),
    LIBRE: build(NUMBER_RANGES.LIBRE),
  };
}
