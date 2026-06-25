/**
 * Template de tournée véhicule (TT VS) — issu de l'architecture fonctionnelle
 * `architecture_appli_TTVS.xlsx`.
 *
 * Une seule grille avec items taggés par type VS applicable. L'UI filtre
 * dynamiquement selon le type du véhicule choisi à la tournée.
 *
 * Périodicité cible : semestrielle (180 j).
 */

import {
  RESPONSE_FORMATS,
  VEHICLE_TYPES,
  type ResponseFormat,
  type VehicleType,
} from "../src/lib/vehicle-types";

export type SeedVehicleRoundItem = {
  label: string;
  responseFormat: ResponseFormat;
  applicableTypes: VehicleType[];
};

export type SeedVehicleRoundSection = {
  title: string;
  icon?: string;
  items: SeedVehicleRoundItem[];
};

export type SeedVehicleRoundTemplate = {
  slug: string;
  name: string;
  description: string;
  expectedFrequencyDays: number;
  sections: SeedVehicleRoundSection[];
};

const ALL_TYPES: VehicleType[] = [
  VEHICLE_TYPES.VS_BASIQUE,
  VEHICLE_TYPES.VS_TRAVAIL_EIS,
  VEHICLE_TYPES.VS_DPX_ADPX_ASTREINTE,
];

export const TEMPLATE_TOURNEE_VS: SeedVehicleRoundTemplate = {
  slug: "tournee-vs",
  name: "Tournée Véhicule de Service",
  description:
    "Contrôle semestriel d'un véhicule de service. Les items affichés dépendent du type du véhicule (basique, travail EIS, DPx/ADPx/Astreinte).",
  expectedFrequencyDays: 180,
  sections: [
    {
      title: "Inspection générale",
      icon: "🚗",
      items: [
        {
          label: "Bon état général du VS",
          responseFormat: RESPONSE_FORMATS.BON_MAUVAIS,
          applicableTypes: ALL_TYPES,
        },
        {
          label:
            "Kit de sécurité (gilet jaune dans l'habitacle + triangle, roue de secours ou kit de réparation)",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: ALL_TYPES,
        },
        {
          label:
            "Documents du VS : carte grise + 3 docs conducteur (charte, présentation PC, autorisation de conduite)",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT_OR_NA,
          applicableTypes: ALL_TYPES,
        },
        {
          label: "Marquage SNCF carrosserie",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: ALL_TYPES,
        },
        {
          label: "Trousse de secours",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: ALL_TYPES,
        },
        {
          label: "Feu à éclat",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: [VEHICLE_TYPES.VS_DPX_ADPX_ASTREINTE],
        },
        {
          label: "Feu de signalisation (fds)",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: [VEHICLE_TYPES.VS_TRAVAIL_EIS],
        },
        {
          label: "Équipement modul-system",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: [VEHICLE_TYPES.VS_TRAVAIL_EIS],
        },
        {
          label: "Kits anti-pollution",
          responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
          applicableTypes: [VEHICLE_TYPES.VS_TRAVAIL_EIS],
        },
      ],
    },
  ],
};

export const SEED_VEHICLE_ROUND_TEMPLATES: SeedVehicleRoundTemplate[] = [
  TEMPLATE_TOURNEE_VS,
];
