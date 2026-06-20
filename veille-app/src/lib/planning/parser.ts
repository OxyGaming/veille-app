/**
 * Parser ODS/XLSX du planning de tour de service ferroviaire.
 *
 * Format attendu (cf. fichier de référence, 24 colonnes) :
 *   [ 0] UCH                              [12] AMPLITUDE POP/NPO (100E)
 *   [ 1] CODE UCH                         [13] AMPLITUDE POP/NPO (HH:MM)
 *   [ 2] NOM                              [14] DUREE EFFECTIVE POP (100E)
 *   [ 3] PRENOM                           [15] DUREE EFFECTIVE POP (HH:MM)
 *   [ 4] CODE IMMATRICULATION  ◄── clé    [16] JS / NPO              ◄── pivot
 *   [ 5] CODE APES                        [17] CODE JS / CODE NPO
 *   [ 6] CODE SYMBOLE GRADE               [18] TYPE JS / FAM. NPO
 *   [ 7] CODE COLLEGE GRADE               [19] VALEUR NPO
 *   [ 8] DATE DEBUT POP / NPO  ◄── used   [20] UCH JS               (info brute)
 *   [ 9] HEURE DEBUT POP / NPO ◄── used   [21] CODE UCH JS
 *   [10] HEURE FIN POP / NPO   ◄── used   [22] CODE ROULEMENT JS
 *   [11] DATE FIN POP / NPO    ◄── used   [23] NUMERO JS            ◄── used
 *
 * Filtre amont strict : seules les lignes `row[16] === "JS"` deviennent un
 * ParsedShift. Les NPO sont comptées (`rowsNonService`) mais aucun champ
 * sensible (CODE NPO, TYPE NPO) ne traverse cette frontière.
 *
 * Dates : format FR `DD/MM/YYYY`. Heures : `HH:MM:SS` ou `HH:MM`.
 * Fuseau : Europe/Paris implicite — les Date construites le sont en heure
 * locale du serveur (le déploiement cible est en France métropolitaine).
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

// ─── Constantes de colonnes (en-tête + index) ────────────────────────────────

const COL = {
  uch: 0,
  matricule: 4,
  dateStart: 8,
  timeStart: 9,
  timeEnd: 10,
  dateEnd: 11,
  jsOrNpo: 16,
  jsCode: 17,
  uchJs: 20,
  jsNumber: 23,
} as const;

const EXPECTED_HEADERS: ReadonlyArray<readonly [number, string]> = [
  [COL.uch, "UCH"],
  [COL.matricule, "CODE IMMATRICULATION"],
  [COL.dateStart, "DATE DEBUT POP / NPO"],
  [COL.timeStart, "HEURE DEBUT POP / NPO"],
  [COL.timeEnd, "HEURE FIN POP / NPO"],
  [COL.dateEnd, "DATE FIN POP / NPO"],
  [COL.jsOrNpo, "JS / NPO"],
  [COL.jsNumber, "NUMERO JS"],
];

/** Première feuille du workbook lue en tableau 2D (header inclus). */
export function readPlanningWorkbook(
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

/** Vérifie qu'un en-tête contient bien les colonnes attendues. Lance si KO. */
export function assertPlanningHeader(header: unknown[]): void {
  for (const [idx, label] of EXPECTED_HEADERS) {
    const cell = header[idx];
    if (typeof cell !== "string" || cell.trim() !== label) {
      throw new Error(
        `En-tête invalide : colonne ${idx} doit être "${label}", reçu "${
          cell == null ? "" : String(cell)
        }".`,
      );
    }
  }
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
 * Transforme une ligne brute en outcome typé.
 *
 * Règle de filtrage : seul `JS / NPO === "JS"` produit un shift. Toute autre
 * valeur (NPO, vide, inconnue) est classée non-service ou ignorée. Aucun
 * champ de la ligne NPO n'est conservé dans le shift retourné.
 */
export function parsePlanningRow(
  row: unknown[],
  rowIndex: number,
): RowOutcome {
  // Ligne vide / quasi-vide → on ne compte ni en service ni en erreur.
  const allEmpty = row.every((c) => c == null || String(c).trim() === "");
  if (allEmpty) return { kind: "empty" };

  const jsOrNpo = cellString(row[COL.jsOrNpo]);

  // Toute ligne non-"JS" est traitée comme non-service. Pas de pénalité
  // d'erreur même si la valeur est inattendue : le PO veut un compte
  // simple SERVICE vs NON_SERVICE, et ne pas perdre de signal sur des
  // colonnes 17/18/19 partielles que nous ignorons de toute façon.
  if (jsOrNpo !== "JS") {
    return { kind: "non-service" };
  }

  // À partir d'ici, on est sur du SERVICE — il FAUT toutes les bornes.
  const matricule = cellString(row[COL.matricule]);
  if (!matricule) {
    return {
      kind: "error",
      error: { rowIndex, reason: "matricule manquant" },
    };
  }

  const dateStart = parseDateFr(row[COL.dateStart]);
  if (!dateStart) {
    return {
      kind: "error",
      error: { rowIndex, reason: "DATE DEBUT invalide" },
    };
  }
  const timeStart = parseTimeFr(row[COL.timeStart]);
  if (!timeStart) {
    return {
      kind: "error",
      error: { rowIndex, reason: "HEURE DEBUT invalide" },
    };
  }
  const dateEnd = parseDateFr(row[COL.dateEnd]);
  if (!dateEnd) {
    return {
      kind: "error",
      error: { rowIndex, reason: "DATE FIN invalide" },
    };
  }
  const timeEnd = parseTimeFr(row[COL.timeEnd]);
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
      jsNumber: cellString(row[COL.jsNumber]),
      jsCode: cellString(row[COL.jsCode]),
    },
  };
}

// ─── Parsing d'un fichier complet ────────────────────────────────────────────

/**
 * Parse un workbook complet et produit le PlanningParseResult.
 *
 * - L'en-tête est validé strictement (assertPlanningHeader).
 * - Le rawUchSummary capture UCH (col 0) et UCH JS (col 20) — uniquement
 *   pour le rapport d'import, jamais utilisé pour le scope applicatif.
 * - periodStart/periodEnd reflètent l'intervalle SERVICE effectivement
 *   conservé (pas les NPO).
 */
export function parsePlanningRows(rows: unknown[][]): PlanningParseResult {
  if (rows.length === 0) {
    throw new Error("Fichier planning vide.");
  }
  assertPlanningHeader(rows[0]);

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
    const outcome = parsePlanningRow(row, i);
    if (outcome.kind === "empty") continue;
    rowsTotal++;

    // UCH d'appartenance et UCH JS sont collectés pour TOUTES les lignes
    // non vides (utile au manager pour repérer un fichier exotique).
    incrementMap(rawUchSummary.byAppartenance, cellString(row[COL.uch]));
    incrementMap(rawUchSummary.byAffectation, cellString(row[COL.uchJs]));

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
