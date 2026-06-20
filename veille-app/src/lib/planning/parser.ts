/**
 * Parser planning de tour de service ferroviaire — formats supportés :
 *
 *  - ODS / XLSX (24 colonnes, ligne 1 = header, pivot `JS / NPO` col 16)
 *  - TSV / TXT  (26 colonnes, ligne 1 = titre, ligne 2 = header, sans pivot
 *               `JS / NPO` → traité comme "JS uniquement")
 *
 * Le mapping de colonnes est résolu par ALIAS sur le header reçu : chaque
 * colonne logique (`matricule`, `dateStart`, `jsCode`, etc.) est cherchée
 * via une liste d'aliases acceptés. La colonne `jsOrNpo` est OPTIONNELLE :
 * absente → toutes les lignes sont des SERVICE (les NPO ne sont jamais
 * exportés dans ce format, sécurisé RGPD by-design).
 *
 * Filtre amont (format avec pivot) : seules les lignes `<jsOrNpo> === "JS"`
 * deviennent un ParsedShift. Les NPO sont comptées dans `rowsNonService`
 * mais aucun champ sensible ne traverse la frontière.
 *
 * Dates : format FR `DD/MM/YYYY`. Heures : `HH:MM:SS` ou `HH:MM`.
 * Fuseau : Europe/Paris implicite (le serveur tourne sur cette TZ).
 *
 * Cf. memory/planning-import-rules.md pour les règles métier complètes.
 */
import * as XLSX from "xlsx";
import type {
  ParsedShift,
  PlanningParseError,
  PlanningParseResult,
  RawUchSummary,
} from "./types";

// ─── Mapping de colonnes par ALIAS ───────────────────────────────────────────

/**
 * Mapping logique → index physique dans le header reçu.
 * `jsOrNpo` est nullable : si la colonne est absente du fichier, on est en
 * mode "JS uniquement" (cas du nouveau format export.txt).
 * `uchJs` est nullable aussi (cas peu probable mais robuste).
 */
type HeaderMapping = {
  uch: number;
  matricule: number;
  dateStart: number;
  timeStart: number;
  timeEnd: number;
  dateEnd: number;
  jsOrNpo: number | null;
  jsCode: number;
  uchJs: number | null;
  jsNumber: number;
};

/** Liste des libellés acceptés pour chaque colonne logique. */
const HEADER_ALIASES: Record<keyof HeaderMapping, readonly string[]> = {
  uch: ["UCH", "UCH AGENT"],
  matricule: ["CODE IMMATRICULATION"],
  dateStart: ["DATE DEBUT POP / NPO", "DATE DEBUT POP"],
  timeStart: ["HEURE DEBUT POP / NPO", "HEURE DEBUT POP"],
  timeEnd: ["HEURE FIN POP / NPO", "HEURE FIN POP"],
  dateEnd: ["DATE FIN POP / NPO", "DATE FIN POP"],
  jsOrNpo: ["JS / NPO"], // optionnelle
  jsCode: ["CODE JS / CODE NPO", "CODE JS"],
  uchJs: ["UCH JS"],
  jsNumber: ["NUMERO JS"],
};

/** Colonnes obligatoires (lance si l'une est introuvable). */
const REQUIRED_LOGICAL_COLS: readonly (keyof HeaderMapping)[] = [
  "uch",
  "matricule",
  "dateStart",
  "timeStart",
  "timeEnd",
  "dateEnd",
  "jsCode",
  "jsNumber",
];

/** Résout chaque colonne logique en index dans le header reçu. */
export function resolveHeaderMapping(header: unknown[]): HeaderMapping {
  const norm = header.map((c) =>
    typeof c === "string" ? c.trim() : c == null ? "" : String(c).trim(),
  );
  const findCol = (aliases: readonly string[]): number | null => {
    for (const alias of aliases) {
      const idx = norm.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return null;
  };
  const result = {} as HeaderMapping;
  for (const logical of Object.keys(HEADER_ALIASES) as (keyof HeaderMapping)[]) {
    const idx = findCol(HEADER_ALIASES[logical]);
    if (idx === null && REQUIRED_LOGICAL_COLS.includes(logical)) {
      throw new Error(
        `En-tête invalide : colonne obligatoire introuvable — attendu l'un de [${HEADER_ALIASES[
          logical
        ]
          .map((a) => `"${a}"`)
          .join(", ")}].`,
      );
    }
    // L'assignation ci-dessous est sûre :
    //  - si idx === null, on a déjà jeté pour les colonnes obligatoires ;
    //  - les colonnes optionnelles (jsOrNpo, uchJs) sont typées `number | null`.
    (result as Record<keyof HeaderMapping, number | null>)[logical] = idx;
  }
  return result;
}

// ─── Lecture du buffer (auto-détection format ODS/XLSX vs TSV) ───────────────

/** Vrai si le buffer commence par la signature ZIP (ODS et XLSX). */
function looksLikeOfficeBuffer(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): boolean {
  const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  // ZIP local file header = 0x50 0x4B 0x03 0x04 = "PK\x03\x04"
  return (
    view.length >= 4 &&
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    view[2] === 0x03 &&
    view[3] === 0x04
  );
}

/** Lit un buffer ODS/XLSX → tableau 2D. */
function readWorkbookRows(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
}

/**
 * Lit un buffer TSV (text/plain UTF-8) → tableau 2D.
 *
 * Tolère les BOM UTF-8 et les sauts CRLF/LF.
 * Saute les éventuelles lignes "titre" en tête (lignes sans tabulation),
 * fréquentes en export RH (ex. "Liste des couvertures de JS…").
 */
function readTsvRows(buffer: ArrayBuffer | Uint8Array | Buffer): unknown[][] {
  const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  // Buffer (Node) ou Uint8Array (Web). Buffer.from supporte les deux et le BOM.
  const text = Buffer.from(view).toString("utf8").replace(/^﻿/, "");
  const rawLines = text.split(/\r?\n/);
  // Filtre les lignes complètement vides en fin de fichier.
  const lines: string[] = [];
  for (const l of rawLines) {
    if (l.length > 0) lines.push(l);
  }
  // Saute les premières lignes qui ne contiennent pas de tabulation
  // (descriptions textuelles avant le vrai header).
  let startIdx = 0;
  while (startIdx < lines.length && !lines[startIdx].includes("\t")) {
    startIdx++;
  }
  return lines.slice(startIdx).map((l) =>
    l.split("\t").map((c) => (c.length > 0 ? c : null)),
  );
}

/** Lit n'importe quel buffer planning supporté → tableau 2D. */
export function readPlanningWorkbook(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): unknown[][] {
  if (looksLikeOfficeBuffer(buffer)) {
    return readWorkbookRows(buffer);
  }
  return readTsvRows(buffer);
}

/**
 * Valide qu'un en-tête contient bien les colonnes obligatoires (via aliases).
 * Lance si KO.
 *
 * Wrapper kept pour compatibilité ascendante avec d'éventuels callers
 * externes — délègue maintenant à `resolveHeaderMapping`.
 */
export function assertPlanningHeader(header: unknown[]): void {
  resolveHeaderMapping(header);
}

// ─── Parsing date / heure FR ─────────────────────────────────────────────────

const DATE_FR_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse une date FR `DD/MM/YYYY` en composants Y/M/D (mois 1-indexé).
 * Retourne `null` si le format est invalide ou la date impossible
 * (ex. 31/02/2026, mois > 12, jour > 31).
 */
export function parseDateFr(
  value: unknown,
): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(DATE_FR_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Vérif calendaire stricte : Date.UTC recalcule la date si invalide
  // (ex. 31/02 → 03/03), on compare pour rejeter.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Parse une heure `HH:MM` ou `HH:MM:SS`. Accepte 24:00:00 ?
 * Non : on rejette tout ce qui n'entre pas dans [0..23]:[0..59]:[0..59].
 * Le fichier contient des `23:59:00` pour les journées entières — c'est OK.
 */
export function parseTimeFr(
  value: unknown,
): { hours: number; minutes: number; seconds: number } | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(TIME_RE);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] != null ? Number(m[3]) : 0;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (seconds < 0 || seconds > 59) return null;
  return { hours, minutes, seconds };
}

/** Combine date + heure en `Date` locale (le serveur tourne en Europe/Paris). */
export function combineDateTime(
  date: { year: number; month: number; day: number },
  time: { hours: number; minutes: number; seconds: number },
): Date {
  return new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hours,
    time.minutes,
    time.seconds,
    0,
  );
}

// ─── Helpers internes ────────────────────────────────────────────────────────

function cellString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function incrementMap(map: Record<string, number>, key: string | null): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

// ─── Parsing d'une ligne ─────────────────────────────────────────────────────

type RowOutcome =
  | { kind: "service"; shift: ParsedShift }
  | { kind: "non-service" }
  | { kind: "error"; error: PlanningParseError }
  | { kind: "empty" };

/**
 * Transforme une ligne brute en outcome typé selon le `mapping` résolu.
 *
 * Filtrage : si `mapping.jsOrNpo !== null` et `row[mapping.jsOrNpo] !== "JS"`,
 * la ligne est classée non-service (NPO ou autre). Si `mapping.jsOrNpo` est
 * null (format JS-only sans pivot), toutes les lignes non-vides sont des
 * candidats SERVICE. Aucun champ NPO sensible ne traverse cette frontière.
 */
export function parsePlanningRow(
  row: unknown[],
  rowIndex: number,
  mapping: HeaderMapping,
): RowOutcome {
  // Ligne vide / quasi-vide → on ne compte ni en service ni en erreur.
  const allEmpty = row.every((c) => c == null || String(c).trim() === "");
  if (allEmpty) return { kind: "empty" };

  if (mapping.jsOrNpo !== null) {
    const jsOrNpo = cellString(row[mapping.jsOrNpo]);
    // Toute ligne non-"JS" est traitée comme non-service.
    if (jsOrNpo !== "JS") {
      return { kind: "non-service" };
    }
  }
  // Si mapping.jsOrNpo est null (format JS-only), on continue tel quel.

  // À partir d'ici, on est sur du SERVICE — il FAUT toutes les bornes.
  const matricule = cellString(row[mapping.matricule]);
  if (!matricule) {
    return {
      kind: "error",
      error: { rowIndex, reason: "matricule manquant" },
    };
  }

  const dateStart = parseDateFr(row[mapping.dateStart]);
  if (!dateStart) {
    return {
      kind: "error",
      error: { rowIndex, reason: "DATE DEBUT invalide" },
    };
  }
  const timeStart = parseTimeFr(row[mapping.timeStart]);
  if (!timeStart) {
    return {
      kind: "error",
      error: { rowIndex, reason: "HEURE DEBUT invalide" },
    };
  }
  const dateEnd = parseDateFr(row[mapping.dateEnd]);
  if (!dateEnd) {
    return {
      kind: "error",
      error: { rowIndex, reason: "DATE FIN invalide" },
    };
  }
  const timeEnd = parseTimeFr(row[mapping.timeEnd]);
  if (!timeEnd) {
    return {
      kind: "error",
      error: { rowIndex, reason: "HEURE FIN invalide" },
    };
  }

  const startsAt = combineDateTime(dateStart, timeStart);
  const endsAt = combineDateTime(dateEnd, timeEnd);

  // Service de nuit : DATE FIN = J+1 → endsAt > startsAt naturellement.
  // Si endsAt <= startsAt, soit le fichier inverse les bornes, soit le service
  // de nuit n'a pas été marqué J+1 (incohérence). On rejette en erreur.
  if (endsAt.getTime() <= startsAt.getTime()) {
    return {
      kind: "error",
      error: {
        rowIndex,
        reason: "endsAt <= startsAt (bornes incohérentes)",
      },
    };
  }

  return {
    kind: "service",
    shift: {
      rowIndex,
      matricule,
      startsAt,
      endsAt,
      jsNumber: cellString(row[mapping.jsNumber]),
      jsCode: cellString(row[mapping.jsCode]),
    },
  };
}

// ─── Parsing d'un fichier complet ────────────────────────────────────────────

/**
 * Parse un workbook complet et produit le PlanningParseResult.
 *
 * - L'en-tête est résolu via `resolveHeaderMapping` (aliases supportés).
 * - Le rawUchSummary capture UCH d'appartenance et UCH JS — uniquement
 *   pour le rapport d'import, jamais utilisé pour le scope applicatif.
 * - periodStart/periodEnd reflètent l'intervalle SERVICE effectivement
 *   conservé (pas les NPO).
 * - Si le format n'a pas de pivot `JS / NPO` (export.txt nouveau format),
 *   toutes les lignes non-vides sont des candidats SERVICE — `rowsNonService`
 *   reste à 0.
 */
export function parsePlanningRows(rows: unknown[][]): PlanningParseResult {
  if (rows.length === 0) {
    throw new Error("Fichier planning vide.");
  }
  const mapping = resolveHeaderMapping(rows[0]);

  const shifts: ParsedShift[] = [];
  const errors: PlanningParseError[] = [];
  const rawUchSummary: RawUchSummary = {
    byAppartenance: {},
    byAffectation: {},
  };
  let rowsTotal = 0;
  let rowsService = 0;
  let rowsNonService = 0;
  let rowsErrored = 0;
  let periodStartMs: number | null = null;
  let periodEndMs: number | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const outcome = parsePlanningRow(row, i, mapping);
    if (outcome.kind === "empty") continue;
    rowsTotal++;

    // UCH d'appartenance et UCH JS sont collectés pour TOUTES les lignes
    // non vides (utile au manager pour repérer un fichier exotique).
    incrementMap(rawUchSummary.byAppartenance, cellString(row[mapping.uch]));
    if (mapping.uchJs !== null) {
      incrementMap(rawUchSummary.byAffectation, cellString(row[mapping.uchJs]));
    }

    if (outcome.kind === "non-service") {
      rowsNonService++;
      continue;
    }
    if (outcome.kind === "error") {
      rowsErrored++;
      errors.push(outcome.error);
      continue;
    }
    // service
    rowsService++;
    shifts.push(outcome.shift);
    const startMs = outcome.shift.startsAt.getTime();
    const endMs = outcome.shift.endsAt.getTime();
    if (periodStartMs === null || startMs < periodStartMs) {
      periodStartMs = startMs;
    }
    if (periodEndMs === null || endMs > periodEndMs) {
      periodEndMs = endMs;
    }
  }

  return {
    shifts,
    rowsTotal,
    rowsService,
    rowsNonService,
    rowsErrored,
    errors,
    rawUchSummary,
    periodStart: periodStartMs !== null ? new Date(periodStartMs) : null,
    periodEnd: periodEndMs !== null ? new Date(periodEndMs) : null,
  };
}

/** Raccourci : lit un buffer et parse en une étape. */
export function parsePlanningBuffer(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): PlanningParseResult {
  const rows = readPlanningWorkbook(buffer);
  return parsePlanningRows(rows);
}
