/**
 * Types partagés du Livret CIL (Chef d'Incident Local).
 *
 * Ces types décrivent la forme sérialisable des entités (dates en ISO string)
 * consommée par les modules purs, l'UI et le générateur PDF. Ils reflètent le
 * schéma Prisma (modèles Cil*) sans en dépendre directement, pour rester
 * testables sans base de données.
 */

// ─── Énumérations métier (valeurs stockées telles quelles en base) ────────────

export const INCIDENT_TYPES = [
  "INCENDIE",
  "ACCIDENT_PERSONNE",
  "OBSTACLE",
  "AUTRE",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  INCENDIE: "Incendie",
  ACCIDENT_PERSONNE: "Accident de personne",
  OBSTACLE: "Obstacle",
  AUTRE: "Autre",
};

export const ETABLISSEMENTS = ["EIC_RAL", "INFP_RHN", "INFP_LGV"] as const;
export type Etablissement = (typeof ETABLISSEMENTS)[number];

export const ETABLISSEMENT_LABELS: Record<Etablissement, string> = {
  EIC_RAL: "EIC RAL",
  INFP_RHN: "INFP RHN",
  INFP_LGV: "INFP LGV",
};

export const INCIDENT_STATUSES = ["OPEN", "CLOSED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Sous-type de dépêche — pilote plage de n°, type d'événement, cadre PDF, template. */
export const DEPECHE_SUBTYPES = [
  "PROTECTION_CIRCULATION",
  "PROTECTION_ELECTRIQUE",
  "REPRISE_PARTIELLE",
  "REPRISE_NORMALE",
  "RETABLISSEMENT_PARTIEL",
  "RETABLISSEMENT_NORMAL",
  "LIBRE",
] as const;
export type DepecheSubtype = (typeof DEPECHE_SUBTYPES)[number];

export const DEPECHE_SUBTYPE_LABELS: Record<DepecheSubtype, string> = {
  PROTECTION_CIRCULATION: "Protection circulation",
  PROTECTION_ELECTRIQUE: "Protection électrique",
  REPRISE_PARTIELLE: "Reprise partielle de la circulation",
  REPRISE_NORMALE: "Reprise de la circulation",
  RETABLISSEMENT_PARTIEL: "Rétablissement partiel de la tension",
  RETABLISSEMENT_NORMAL: "Rétablissement de la tension",
  LIBRE: "Dépêche libre",
};

export const DEPECHE_SENS = ["RECU", "EXPEDIE"] as const;
export type DepecheSens = (typeof DEPECHE_SENS)[number];

export const REPRISE_AUTHORIZATIONS = [
  "ACCORD_COS",
  "ACCORD_OPJ",
  "TOUS_PARTIS",
] as const;
export type RepriseAuthorization = (typeof REPRISE_AUTHORIZATIONS)[number];

export const REPRISE_AUTHORIZATION_LABELS: Record<RepriseAuthorization, string> =
  {
    ACCORD_COS: "Accord COS",
    ACCORD_OPJ: "Accord OPJ",
    TOUS_PARTIS: "Tous les intervenants sont partis",
  };

export const INTERVENANT_TYPES = [
  "COS",
  "OPJ",
  "POMPES_FUNEBRES",
  "EIC",
  "INFP",
  "EXF_TRACTION",
  "EXF_VOYAGEURS",
  "AUTRE",
] as const;
export type IntervenantType = (typeof INTERVENANT_TYPES)[number];

export const INTERVENANT_TYPE_LABELS: Record<IntervenantType, string> = {
  COS: "COS",
  OPJ: "OPJ",
  POMPES_FUNEBRES: "Pompes Funèbres",
  EIC: "EIC",
  INFP: "INFP",
  EXF_TRACTION: "ExF (Traction)",
  EXF_VOYAGEURS: "ExF (Voy.)",
  AUTRE: "Autre",
};

/** Destinataire numéroté d'une dépêche (imprimé officiel 2024). */
export const DEPECHE_INTERLOCUTORS = ["CRC", "RSS", "AC", "LIBRE"] as const;
export type DepecheInterlocutor = (typeof DEPECHE_INTERLOCUTORS)[number];

export const EVENT_TYPES = [
  "INCIDENT_CREATED",
  "MISSION_CIL",
  "ARRIVAL_ON_SITE",
  "DEPECHE",
  "INTERVENANT_ARRIVAL",
  "INTERVENANT_DEPARTURE",
  "REPRISE_PARTIELLE_CIRCULATION",
  "REPRISE_CIRCULATION",
  "RETABLISSEMENT_PARTIEL_TENSION",
  "RETABLISSEMENT_TENSION",
  "CHANGEMENT_CIL",
  "CLOSURE",
  "NOTE",
] as const;
export type CilEventType = (typeof EVENT_TYPES)[number];

export const SIGNATURE_OWNER_TYPES = [
  "INCIDENT",
  "EVENT",
  "DEPECHE",
  "INTERVENANT",
] as const;
export type SignatureOwnerType = (typeof SIGNATURE_OWNER_TYPES)[number];

// ─── Formes sérialisables (dates en ISO string) ───────────────────────────────

/** Géométrie non temporelle portée par `CilDepeche.metadata` (JSON). */
export type DepecheGeometry = {
  voies?: string;
  km?: string;
  gareA?: string;
  gareB?: string;
  gareUnique?: string;
  motif?: string;
  marcheInterdite?: string;
  marchePrudente?: string;
  marcheNormale?: string;
  /** Reprise : « à AC de … » (interlocuteur). */
  ac?: string;
  /** Protection circulation : destinataire de la 2ᵉ dépêche (« AC de … »). */
  acLabel?: string;
};

export type CilDepecheDTO = {
  id: string;
  subtype: DepecheSubtype;
  interlocutor: DepecheInterlocutor | null;
  sens: DepecheSens | null;
  texte: string;
  numeroDonne: number;
  numeroRecu: string | null;
  collationne: boolean;
  occurredAt: string; // ISO (repris de l'événement DEPECHE lié)
  avisCrcAt: string | null;
  avisCosAt: string | null;
  avisOpjAt: string | null;
  departEffectifAt: string | null;
  repriseAuthorization: RepriseAuthorization | null;
  geometry: DepecheGeometry;
  destinataires: { id: string; label: string; numeroRecu: string | null }[];
};

export type CilIntervenantDTO = {
  id: string;
  type: IntervenantType;
  typeLibre: string | null;
  nom: string | null;
  tel: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
};

export type CilEventDTO = {
  id: string;
  type: CilEventType;
  occurredAt: string;
  seq: number;
  label: string;
  note: string | null;
  actorName: string | null;
  refType: string | null;
  refId: string | null;
  /** Données structurées de l'action (ex. `remplacant` du changement de CIL). */
  metadata: Record<string, unknown> | null;
};

/** Autorisation recueillie en amont d'une reprise / d'un rétablissement. */
export type CilAutorisationDTO = {
  id: string;
  subtype: DepecheSubtype;
  role: "COS" | "OPJ";
  grantedAt: string;
  signerName: string | null;
  imageB64: string;
};

export type CilSignatureDTO = {
  id: string;
  ownerType: SignatureOwnerType;
  ownerId: string;
  signerName: string | null;
  signerRole: string | null;
  imageB64: string;
};

/** Mode de localisation (choisi une fois pour tout le livret). */
export const GARE_MODES = ["UNIQUE", "BETWEEN"] as const;
export type GareMode = (typeof GARE_MODES)[number];

export type CilIncidentDTO = {
  id: string;
  status: IncidentStatus;
  reference: string | null;
  type: IncidentType;
  typeLibre: string | null;
  occurredAt: string;
  lieu: string;
  poste: string | null;
  voie: string | null;
  observations: string | null;
  /** Localisation officielle : « en gare de » (UNIQUE) ou « entre les gares » (BETWEEN). */
  gareMode: GareMode | null;
  gareUnique: string | null;
  gareA: string | null;
  gareB: string | null;
  /** Géométrie partagée : valeurs par défaut de chaque dépêche. */
  voies: string | null;
  km: string | null;
  acLabel: string | null;
  motif: string | null;
  cilNom: string | null;
  cilPrenom: string | null;
  cilEtablissement: Etablissement | null;
  designatedAt: string | null;
  arrivedOnSiteAt: string | null;
  closedAt: string | null;
};

/** Agrégat complet d'un incident (incident + entités liées) pour les modules purs. */
export type CilIncidentFull = {
  incident: CilIncidentDTO;
  events: CilEventDTO[];
  depeches: CilDepecheDTO[];
  intervenants: CilIntervenantDTO[];
  signatures: CilSignatureDTO[];
  autorisations: CilAutorisationDTO[];
};
