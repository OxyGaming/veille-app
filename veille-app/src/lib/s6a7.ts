/**
 * Constantes partagées de la visite S6A7.
 *
 * La visite S6A7 est une variante du mode INVENTORY (veille de site) à deux
 * familles d'éléments, toutes deux stockées dans `SiteEquipment` avec
 * `domain = "S6A7"` :
 *   - Téléphones de voie (`itemKind = "PHONE"`) : constat de bon fonctionnement
 *     à 4 états. Ne génère JAMAIS d'action, même HS.
 *   - Petit matériel (`itemKind = "MATERIEL"`) : logique trousse de secours
 *     (présence / quantité / péremption). Un écart génère une action.
 */

/** Domaine (modèle de visite) auquel un `SiteEquipment` est rattaché. */
export const EQUIPMENT_DOMAINS = ["VEILLE_SITE", "S6A7"] as const;
export type EquipmentDomain = (typeof EQUIPMENT_DOMAINS)[number];

/** Famille d'un `SiteEquipment`. */
export const ITEM_KINDS = ["MATERIEL", "PHONE"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * Statuts de fonctionnement d'un téléphone de voie (champ
 * `SiteVisitObservation.phoneStatus`). Aucun ne déclenche d'action.
 */
export const PHONE_STATUSES = [
  "BON",
  "HS",
  "DIFF_RECEPTION",
  "DIFF_EMISSION",
] as const;
export type PhoneStatus = (typeof PHONE_STATUSES)[number];

export const PHONE_STATUS_LABEL: Record<PhoneStatus, string> = {
  BON: "Bon",
  HS: "Hors service",
  DIFF_RECEPTION: "Difficultés de réception",
  DIFF_EMISSION: "Difficultés d'émission",
};

/** Un téléphone est « conforme » (compté OK) uniquement s'il est BON. */
export function isPhoneOk(status: string | null | undefined): boolean {
  return status === "BON";
}

/**
 * Catégorie par défaut regroupant les téléphones de voie dans le catalogue
 * (le champ `category` reste libre, mais l'UI S6A7 pré-remplit celle-ci).
 */
export const PHONE_CATEGORY = "Téléphones de voie";

/**
 * Les deux sous-types de petit matériel S6A7, rangés dans `category`.
 * Repris tels quels dans le PDF et l'inventaire d'origine.
 */
export const S6A7_MATERIEL_CATEGORIES = [
  "Dispositifs d'attention, dispositifs spéciaux d'attention et de réflexion",
  "Matériel divers",
] as const;
