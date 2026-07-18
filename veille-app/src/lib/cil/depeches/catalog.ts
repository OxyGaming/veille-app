/**
 * Catalogue de modèles de dépêches standard du Livret CIL.
 *
 * Architecture extensible : chaque modèle est un objet typé
 * `{ id, subtype, label, text, variables }`. Le texte contient des
 * placeholders `{{variable}}` remplis par `renderDepecheTemplate`. Ajouter un
 * modèle = ajouter un objet. Ce schéma est conçu pour migrer 1:1 vers une
 * table `CilDepecheTemplate` éditable en base (Lot 2) sans changer les
 * conscommateurs.
 *
 * Les textes reprennent le vocabulaire exact de l'imprimé officiel EIC RA
 * (« CRC de Lyon », « RSS de Lyon », « AC de … »).
 */
import type { DepecheSubtype } from "../types";

export type DepecheVariable = {
  name: string;
  label: string;
  required: boolean;
};

export type DepecheTemplate = {
  id: string;
  subtype: DepecheSubtype;
  label: string;
  /** Texte avec placeholders `{{var}}`. */
  text: string;
  variables: DepecheVariable[];
};

const V = {
  cil: { name: "cil", label: "Nom du CIL", required: false },
  evenement: { name: "evenement", label: "Événement", required: false },
  voies: { name: "voies", label: "Voie(s)", required: false },
  km: { name: "km", label: "Kilomètre", required: false },
  motif: { name: "motif", label: "Motif", required: false },
  ac: { name: "ac", label: "AC de", required: false },
  localisation: {
    name: "localisation",
    label: "Localisation (en gare de… / entre les gares de… et de…)",
    required: false,
  },
  voiesInterdites: {
    name: "voiesInterdites",
    label: "Voies interdites à la circulation",
    required: false,
  },
  voiesPrudente: {
    name: "voiesPrudente",
    label: "Voies en marche prudente",
    required: false,
  },
  voiesNormale: {
    name: "voiesNormale",
    label: "Voies en marche normale",
    required: false,
  },
} satisfies Record<string, DepecheVariable>;

export const DEPECHE_TEMPLATES: DepecheTemplate[] = [
  {
    id: "protection-circulation",
    subtype: "PROTECTION_CIRCULATION",
    label: "Protection vis-à-vis de la circulation des trains",
    text:
      "M. {{cil}}, CIL, à CRC de Lyon :\n" +
      "Je reprends à mon compte les mesures de protection suite à (l'événement) {{evenement}} sur voie(s) {{voies}} au km {{km}} {{localisation}}.\n" +
      "Voies n° {{voiesInterdites}} interdites à la circulation,\n" +
      "Voies n° {{voiesPrudente}} circulation en marche prudente,\n" +
      "Voies n° {{voiesNormale}} circulation en marche normale.\n" +
      "Motif : {{motif}}",
    variables: [
      V.cil,
      V.evenement,
      V.voies,
      V.km,
      V.localisation,
      V.voiesInterdites,
      V.voiesPrudente,
      V.voiesNormale,
      V.motif,
    ],
  },
  {
    id: "protection-electrique",
    subtype: "PROTECTION_ELECTRIQUE",
    label: "Protection vis-à-vis des risques électriques",
    text:
      "M. {{cil}}, CIL, à CRC de Lyon :\n" +
      "Je reprends à mon compte la coupure d'urgence demandée suite à (l'événement) {{evenement}} sur voie(s) {{voies}} au kilomètre {{km}} {{localisation}}.\n" +
      "Motif : {{motif}}",
    variables: [V.cil, V.evenement, V.voies, V.km, V.localisation, V.motif],
  },
  {
    id: "reprise-partielle",
    subtype: "REPRISE_PARTIELLE",
    label: "Reprise partielle de la circulation des trains",
    text:
      "M. {{cil}}, CIL, à AC de {{ac}} :\n" +
      "Au titre de (l'événement) {{evenement}}, j'autorise la reprise de la circulation des trains en marche prudente sur voie(s) {{voies}} aux abords du kilomètre {{km}} {{localisation}}.\n" +
      "Cette autorisation ne tient pas compte d'autres mesures de sécurité éventuellement en cours.",
    variables: [V.cil, V.ac, V.evenement, V.voies, V.km],
  },
  {
    id: "reprise-normale",
    subtype: "REPRISE_NORMALE",
    label: "Reprise de la circulation des trains",
    text:
      "M. {{cil}}, CIL, à AC de {{ac}} :\n" +
      "Au titre de (l'événement) {{evenement}}, j'autorise la reprise de la circulation normale des trains sur voie(s) {{voies}} aux abords du kilomètre {{km}} {{localisation}}.\n" +
      "Cette autorisation ne tient pas compte d'autres mesures de sécurité éventuellement en cours.",
    variables: [V.cil, V.ac, V.evenement, V.voies, V.km],
  },
  {
    id: "retablissement-partiel",
    subtype: "RETABLISSEMENT_PARTIEL",
    label: "Rétablissement partiel de la tension d'alimentation",
    text:
      "M. {{cil}}, CIL, à RSS de Lyon :\n" +
      "J'autorise le rétablissement de la tension d'alimentation sur voie(s) {{voies}} au kilomètre {{km}} {{localisation}}.",
    variables: [V.cil, V.voies, V.km],
  },
  {
    id: "retablissement-normal",
    subtype: "RETABLISSEMENT_NORMAL",
    label: "Rétablissement de la tension d'alimentation",
    text:
      "Assurez-vous que le motif de la coupure d'urgence a disparu.\n" +
      "M. {{cil}}, CIL, à RSS de Lyon :\n" +
      "J'autorise le rétablissement de la tension d'alimentation sur voie(s) {{voies}} au kilomètre {{km}} {{localisation}}.",
    variables: [V.cil, V.voies, V.km],
  },
];

const BY_ID = new Map(DEPECHE_TEMPLATES.map((t) => [t.id, t]));
const BY_SUBTYPE = new Map<DepecheSubtype, DepecheTemplate>(
  DEPECHE_TEMPLATES.map((t) => [t.subtype, t]),
);

export function getTemplateById(id: string): DepecheTemplate | undefined {
  return BY_ID.get(id);
}

export function getTemplateForSubtype(
  subtype: DepecheSubtype,
): DepecheTemplate | undefined {
  return BY_SUBTYPE.get(subtype);
}

/**
 * Remplit les placeholders `{{var}}` d'un modèle avec `values`. Une variable
 * absente/vide est remplacée par une chaîne vide (le CIL complète ensuite le
 * texte, éditable). Renvoie le texte prêt à afficher/éditer.
 */
export function renderDepecheTemplate(
  templateId: string,
  values: Record<string, string | null | undefined>,
): string {
  const tpl = BY_ID.get(templateId);
  if (!tpl) return "";
  return renderTemplateText(tpl.text, values);
}

export function renderTemplateText(
  text: string,
  values: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => {
    const v = values[name];
    return v == null ? "" : String(v);
  });
}
