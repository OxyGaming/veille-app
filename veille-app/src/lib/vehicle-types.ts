/**
 * Types de Véhicules de Service (TT VS).
 *
 * Le type détermine la grille d'items à vérifier lors d'une tournée :
 * chaque `VehicleRoundItem` porte un tableau `applicableTypes` qui filtre
 * dynamiquement les items affichés à la saisie.
 *
 * Source : `architecture_appli_TTVS.xlsx` (référentiel SNCF Veille).
 */

export const VEHICLE_TYPES = {
  VS_BASIQUE: "VS_BASIQUE",
  VS_TRAVAIL_EIS: "VS_TRAVAIL_EIS",
  VS_DPX_ADPX_ASTREINTE: "VS_DPX_ADPX_ASTREINTE",
} as const;

export type VehicleType = (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  VS_BASIQUE: "VS basique",
  VS_TRAVAIL_EIS: "VS de travail EIS",
  VS_DPX_ADPX_ASTREINTE: "VS DPx / ADPx / Astreinte",
};

export const VEHICLE_TYPE_LIST: VehicleType[] = [
  VEHICLE_TYPES.VS_BASIQUE,
  VEHICLE_TYPES.VS_TRAVAIL_EIS,
  VEHICLE_TYPES.VS_DPX_ADPX_ASTREINTE,
];

export function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPE_LIST as readonly string[]).includes(value);
}

export function vehicleTypeLabel(value: string): string {
  return isVehicleType(value) ? VEHICLE_TYPE_LABELS[value] : value;
}

/**
 * Formats de réponse possibles pour un item — pilote l'affichage des
 * boutons de saisie. Le statut stocké reste OUI / NON / SANS_OBJET.
 */
export const RESPONSE_FORMATS = {
  BON_MAUVAIS: "BON_MAUVAIS",
  PRESENT_ABSENT: "PRESENT_ABSENT",
  PRESENT_ABSENT_OR_NA: "PRESENT_ABSENT_OR_NA",
} as const;

export type ResponseFormat = (typeof RESPONSE_FORMATS)[keyof typeof RESPONSE_FORMATS];

export const RESPONSE_FORMAT_LABELS: Record<
  ResponseFormat,
  { oui: string; non: string; sansObjet?: string }
> = {
  BON_MAUVAIS: { oui: "Bon", non: "Mauvais" },
  PRESENT_ABSENT: { oui: "Présent", non: "Absent" },
  PRESENT_ABSENT_OR_NA: {
    oui: "Présent",
    non: "Absent",
    sansObjet: "Absence conducteur",
  },
};
