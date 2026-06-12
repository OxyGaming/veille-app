/**
 * Parsing du fichier Excel des actions (xlsx).
 *
 * Colonnes attendues (cf. spec) :
 *  Établissement, Unité, Secteur, Groupe de veille, Espace, Domaine, Theme,
 *  Point clé, Statut, Type, Sous-type, Élement veillé, Type de veille,
 *  Date de réalisation, Date d'échéance, Date de cloture, Commentaire,
 *  Propriétaire initial, Partagé/Affecté à, Transféré à, Plan d'action, ID Action
 *
 * Format du libellé agent : "PRENOM NOM MATRICULE"
 *   - matricule alphanumérique 6-9 chars terminant éventuellement par lettre
 *   - ex : "ALEXANDRE VALOUR 8511663H", "9012096G ACHILLE JESSIE"
 */
import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;
export type ParsedAgent = {
  matricule: string;
  firstName: string;
  lastName: string;
  raw: string;
};

const MATRICULE_RE = /\b([0-9]{6,9}[A-Z]?)\b/;

export function parseAgentLabel(raw: string | null | undefined): ParsedAgent | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const m = cleaned.match(MATRICULE_RE);
  if (!m) return null;
  const matricule = m[1];
  const rest = cleaned.replace(matricule, "").trim();
  // Heuristique : si rest commence par UNE majuscule continue, on a "NOM PRENOM"
  // ou "PRENOM NOM". On garde l'ordre fourni : premier mot = prénom, derniers = nom.
  // Pour les variantes "9012096G ACHILLE JESSIE" on inverse :
  const parts = rest.split(" ").filter(Boolean);
  if (!parts.length) {
    return { matricule, firstName: "", lastName: "", raw: cleaned };
  }
  // Détection : si le matricule était en tête, le pattern est "MAT NOM PRENOM".
  const matAtStart = cleaned.startsWith(matricule);
  let firstName: string, lastName: string;
  if (matAtStart) {
    lastName = parts[0] ?? "";
    firstName = parts.slice(1).join(" ");
  } else {
    // Pattern "PRENOM NOM MAT" : on prend le dernier mot comme nom de famille,
    // les précédents comme prénom (gère les prénoms composés).
    if (parts.length === 1) {
      lastName = parts[0];
      firstName = "";
    } else {
      lastName = parts[parts.length - 1];
      firstName = parts.slice(0, -1).join(" ");
    }
  }
  return {
    matricule,
    firstName: titleCase(firstName),
    lastName: titleCase(lastName),
    raw: cleaned,
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/** Convertit un nombre Excel série en Date locale, ou parse une string. */
export function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel epoch : 1900-01-00 (avec bug du 29/02/1900). xlsx renvoie en jours.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export type ParsedActionRow = {
  externalId: string;
  type: string | null;
  subType: string | null;
  establishment: string | null;
  unit: string | null;
  secteur: string | null;
  veilleGroup: string | null;
  space: string | null;
  domain: string | null;
  theme: string | null;
  keyPoint: string | null;
  observedElement: string | null;
  veilleType: string | null;
  originalStatus: string | null;
  realizedAt: Date | null;
  dueAt: Date | null;
  closedAt: Date | null;
  comment: string | null;
  initialOwner: string | null;
  sharedWith: string | null;
  transferredTo: string | null;
  actionPlan: string | null;
  parsedAgent: ParsedAgent | null;
  ownerAgent: ParsedAgent | null;
  raw: RawRow;
};

const COLS = {
  establishment: "Établissement",
  unit: "Unité",
  secteur: "Secteur",
  veilleGroup: "Groupe de veille",
  space: "Espace",
  domain: "Domaine",
  theme: "Theme",
  keyPoint: "Point clé",
  status: "Statut",
  type: "Type",
  subType: "Sous-type",
  observedElement: "Élement veillé",
  veilleType: "Type de veille",
  realizedAt: "Date de réalisation",
  dueAt: "Date d'échéance",
  closedAt: "Date de cloture",
  comment: "Commentaire",
  initialOwner: "Propriétaire initial",
  sharedWith: "Partagé/Affecté à",
  transferredTo: "Transféré à",
  actionPlan: "Plan d'action",
  externalId: "ID Action",
} as const;

export function readWorkbook(buffer: ArrayBuffer | Uint8Array | Buffer): RawRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[sheetName], { defval: null });
}

export function parseRow(row: RawRow): ParsedActionRow | null {
  const externalId = (row[COLS.externalId] as string | null)?.toString().trim();
  if (!externalId) return null;
  const shared = row[COLS.sharedWith] as string | null;
  const observed = row[COLS.observedElement] as string | null;
  const owner = row[COLS.initialOwner] as string | null;
  const transferred = row[COLS.transferredTo] as string | null;
  const veilleType = (row[COLS.veilleType] as string | null) ?? null;
  // L'agent ciblé par la veille est TOUJOURS dans "Élement veillé" (colonne L)
  // quand Type de veille = "Agent". Les colonnes Partagé/Transféré indiquent
  // l'affectation administrative (qui doit traiter), pas la cible de la veille.
  const isAgentVeille =
    !veilleType || veilleType.toLowerCase() === "agent";
  const parsedAgent = isAgentVeille ? parseAgentLabel(observed) : null;
  return {
    externalId,
    type: row[COLS.type] as string | null,
    subType: row[COLS.subType] as string | null,
    establishment: row[COLS.establishment] as string | null,
    unit: row[COLS.unit] as string | null,
    secteur: row[COLS.secteur] as string | null,
    veilleGroup: row[COLS.veilleGroup] as string | null,
    space: row[COLS.space] as string | null,
    domain: row[COLS.domain] as string | null,
    theme: row[COLS.theme] as string | null,
    keyPoint: row[COLS.keyPoint] as string | null,
    observedElement: observed,
    veilleType,
    originalStatus: row[COLS.status] as string | null,
    realizedAt: excelDate(row[COLS.realizedAt]),
    dueAt: excelDate(row[COLS.dueAt]),
    closedAt: excelDate(row[COLS.closedAt]),
    comment: row[COLS.comment] as string | null,
    initialOwner: owner,
    sharedWith: shared,
    transferredTo: transferred,
    actionPlan: row[COLS.actionPlan] as string | null,
    parsedAgent,
    ownerAgent: parseAgentLabel(owner),
    raw: row,
  };
}
