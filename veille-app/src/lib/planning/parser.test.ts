import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  assertPlanningHeader,
  combineDateTime,
  parseDateFr,
  parsePlanningBuffer,
  parsePlanningRow,
  parsePlanningRows,
  parseTimeFr,
  readPlanningWorkbook,
} from "./parser";

// ─── Header de référence (24 colonnes) ──────────────────────────────────────

const HEADER = [
  "UCH",
  "CODE UCH",
  "NOM",
  "PRENOM",
  "CODE IMMATRICULATION",
  "CODE APES",
  "CODE SYMBOLE GRADE",
  "CODE COLLEGE GRADE",
  "DATE DEBUT POP / NPO",
  "HEURE DEBUT POP / NPO",
  "HEURE FIN POP / NPO",
  "DATE FIN POP / NPO",
  "AMPLITUDE POP / NPO (100E/HEURE)",
  "AMPLITUDE POP / NPO (HH:MM)",
  "DUREE EFFECTIVE POP (100E/HEURE)",
  "DUREE EFFECTIVE POP (HH:MM)",
  "JS / NPO",
  "CODE JS / CODE NPO",
  "TYPE JS / FAM. NPO",
  "VALEUR NPO",
  "UCH JS",
  "CODE UCH JS",
  "CODE ROULEMENT JS",
  "NUMERO JS",
];

/** Construit une ligne JS à partir d'un override de quelques colonnes. */
function jsRow(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = new Array(24).fill(null);
  row[0] = "RIVE DROITE NORD";
  row[1] = "933713";
  row[2] = "DI MICHELE";
  row[3] = "ROMAIN";
  row[4] = "9504912B";
  row[5] = "82";
  row[6] = "CP5NIV1";
  row[7] = "2";
  row[8] = "09/06/2026";
  row[9] = "08:00:00";
  row[10] = "13:30:00";
  row[11] = "09/06/2026";
  row[12] = "550";
  row[13] = "05:30";
  row[14] = "550";
  row[15] = "05:30";
  row[16] = "JS";
  row[17] = "VMCAS";
  row[18] = "VME";
  row[19] = null;
  row[20] = "SALLE EXPLOITATION LGV SUD EST";
  row[21] = "205765";
  row[22] = null;
  row[23] = "20412";
  for (const [k, v] of Object.entries(overrides)) {
    row[Number(k)] = v;
  }
  return row;
}

/** Construit une ligne NPO (le code/famille NPO ne doivent jamais fuiter). */
function npoRow(
  overrides: Partial<Record<number, unknown>> = {},
): unknown[] {
  const row: unknown[] = new Array(24).fill(null);
  row[0] = "ONDAINE";
  row[1] = "933697";
  row[2] = "PETIT";
  row[3] = "STEPHANE";
  row[4] = "8409135P";
  row[5] = "10";
  row[6] = "CP3NIV2";
  row[7] = "1";
  row[8] = "20/05/2026";
  row[9] = "00:00:00";
  row[10] = "23:59:00";
  row[11] = "20/05/2026";
  row[12] = "2398";
  row[13] = "23:59";
  row[14] = null;
  row[15] = null;
  row[16] = "NPO";
  row[17] = "MA"; // ← sensible : doit être ignoré
  row[18] = "Absence méd sf AT"; // ← sensible : doit être ignoré
  row[19] = "1";
  row[20] = null;
  for (const [k, v] of Object.entries(overrides)) {
    row[Number(k)] = v;
  }
  return row;
}

// ─── parseDateFr ─────────────────────────────────────────────────────────────

describe("parseDateFr", () => {
  it("parse une date FR valide", () => {
    expect(parseDateFr("16/05/2026")).toEqual({
      year: 2026,
      month: 5,
      day: 16,
    });
  });

  it("rejette un format ISO", () => {
    expect(parseDateFr("2026-05-16")).toBeNull();
  });

  it("rejette un jour > 31", () => {
    expect(parseDateFr("32/05/2026")).toBeNull();
  });

  it("rejette un mois > 12", () => {
    expect(parseDateFr("16/13/2026")).toBeNull();
  });

  it("rejette le 31 février", () => {
    expect(parseDateFr("31/02/2026")).toBeNull();
  });

  it("accepte le 29 février d'une année bissextile", () => {
    expect(parseDateFr("29/02/2024")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
  });

  it("rejette le 29 février d'une année non bissextile", () => {
    expect(parseDateFr("29/02/2026")).toBeNull();
  });

  it("rejette null / undefined / nombre", () => {
    expect(parseDateFr(null)).toBeNull();
    expect(parseDateFr(undefined)).toBeNull();
    expect(parseDateFr(45000)).toBeNull();
  });
});

// ─── parseTimeFr ─────────────────────────────────────────────────────────────

describe("parseTimeFr", () => {
  it("parse HH:MM:SS", () => {
    expect(parseTimeFr("06:00:00")).toEqual({
      hours: 6,
      minutes: 0,
      seconds: 0,
    });
  });

  it("parse HH:MM (sans secondes)", () => {
    expect(parseTimeFr("13:30")).toEqual({
      hours: 13,
      minutes: 30,
      seconds: 0,
    });
  });

  it("accepte 23:59:00 (journée entière)", () => {
    expect(parseTimeFr("23:59:00")).toEqual({
      hours: 23,
      minutes: 59,
      seconds: 0,
    });
  });

  it("rejette 24:00:00", () => {
    expect(parseTimeFr("24:00:00")).toBeNull();
  });

  it("rejette les minutes > 59", () => {
    expect(parseTimeFr("06:60:00")).toBeNull();
  });

  it("rejette null / nombre", () => {
    expect(parseTimeFr(null)).toBeNull();
    expect(parseTimeFr(0.25)).toBeNull();
  });
});

// ─── combineDateTime ─────────────────────────────────────────────────────────

describe("combineDateTime", () => {
  it("combine en Date locale", () => {
    const d = combineDateTime(
      { year: 2026, month: 6, day: 9 },
      { hours: 8, minutes: 0, seconds: 0 },
    );
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
  });
});

// ─── assertPlanningHeader ────────────────────────────────────────────────────

describe("assertPlanningHeader", () => {
  it("accepte le header officiel", () => {
    expect(() => assertPlanningHeader(HEADER)).not.toThrow();
  });

  it("rejette un header avec mauvaise colonne matricule", () => {
    const bad = [...HEADER];
    bad[4] = "MATRICULE";
    expect(() => assertPlanningHeader(bad)).toThrow(/colonne 4/);
  });

  it("rejette un header sans la colonne JS/NPO", () => {
    const bad = [...HEADER];
    bad[16] = "AUTRE";
    expect(() => assertPlanningHeader(bad)).toThrow(/colonne 16/);
  });
});

// ─── parsePlanningRow ────────────────────────────────────────────────────────

describe("parsePlanningRow", () => {
  it("parse une ligne JS canonique", () => {
    const out = parsePlanningRow(jsRow(), 1);
    expect(out.kind).toBe("service");
    if (out.kind !== "service") return; // type guard
    expect(out.shift.matricule).toBe("9504912B");
    expect(out.shift.jsNumber).toBe("20412");
    expect(out.shift.jsCode).toBe("VMCAS");
    // 09/06/2026 08:00 → 09/06/2026 13:30
    expect(out.shift.startsAt.getHours()).toBe(8);
    expect(out.shift.endsAt.getHours()).toBe(13);
    expect(out.shift.endsAt.getMinutes()).toBe(30);
  });

  it("ignore une ligne NPO sans propager le code NPO", () => {
    const out = parsePlanningRow(npoRow(), 2);
    expect(out.kind).toBe("non-service");
    // Le type garantit qu'aucun champ "shift" n'est exposé pour les NPO.
    expect(out).not.toHaveProperty("shift");
  });

  it("ignore une ligne entièrement vide", () => {
    const empty: unknown[] = new Array(24).fill(null);
    expect(parsePlanningRow(empty, 3).kind).toBe("empty");
  });

  it("compte en erreur une ligne JS sans matricule", () => {
    const out = parsePlanningRow(jsRow({ 4: null }), 4);
    expect(out.kind).toBe("error");
    if (out.kind !== "error") return;
    expect(out.error.reason).toMatch(/matricule/);
  });

  it("compte en erreur une ligne JS avec DATE DEBUT invalide", () => {
    const out = parsePlanningRow(jsRow({ 8: "31/02/2026" }), 5);
    expect(out.kind).toBe("error");
  });

  it("compte en erreur une ligne JS avec HEURE FIN invalide", () => {
    const out = parsePlanningRow(jsRow({ 10: "25:00:00" }), 6);
    expect(out.kind).toBe("error");
  });

  it("supporte un service de nuit (DATE FIN = J+1)", () => {
    const out = parsePlanningRow(
      jsRow({
        8: "03/06/2026",
        9: "20:40:00",
        10: "05:00:00",
        11: "04/06/2026",
      }),
      7,
    );
    expect(out.kind).toBe("service");
    if (out.kind !== "service") return;
    expect(out.shift.startsAt.getDate()).toBe(3);
    expect(out.shift.endsAt.getDate()).toBe(4);
    expect(out.shift.endsAt.getTime()).toBeGreaterThan(
      out.shift.startsAt.getTime(),
    );
  });

  it("rejette une ligne JS avec bornes incohérentes (endsAt <= startsAt même date)", () => {
    const out = parsePlanningRow(
      jsRow({
        8: "09/06/2026",
        9: "13:00:00",
        10: "08:00:00",
        11: "09/06/2026",
      }),
      8,
    );
    expect(out.kind).toBe("error");
    if (out.kind !== "error") return;
    expect(out.error.reason).toMatch(/incohérentes/);
  });
});

// ─── parsePlanningRows (intégration) ─────────────────────────────────────────

describe("parsePlanningRows", () => {
  it("agrège correctement les compteurs et expose les UCH brutes", () => {
    const rows = [HEADER, jsRow(), npoRow(), jsRow({ 4: "8308162L" })];
    const result = parsePlanningRows(rows);

    expect(result.rowsTotal).toBe(3);
    expect(result.rowsService).toBe(2);
    expect(result.rowsNonService).toBe(1);
    expect(result.rowsErrored).toBe(0);
    expect(result.shifts).toHaveLength(2);

    // UCH d'appartenance : ONDAINE (1) + RIVE DROITE NORD (2)
    expect(result.rawUchSummary.byAppartenance).toEqual({
      "ONDAINE": 1,
      "RIVE DROITE NORD": 2,
    });
    // UCH JS (col 20) : 2 sur les JS, null sur la NPO
    expect(result.rawUchSummary.byAffectation).toEqual({
      "SALLE EXPLOITATION LGV SUD EST": 2,
    });
  });

  it("ne stocke aucun champ provenant des lignes NPO dans les shifts", () => {
    const rows = [HEADER, npoRow()];
    const result = parsePlanningRows(rows);
    expect(result.shifts).toHaveLength(0);
    // Spot check : la chaîne "MA" (code NPO sensible) n'apparaît dans
    // aucun shift sérialisé.
    const json = JSON.stringify(result.shifts);
    expect(json).not.toContain("MA");
    expect(json).not.toContain("Absence");
  });

  it("calcule periodStart et periodEnd sur les SERVICE uniquement", () => {
    const rows = [
      HEADER,
      // JS début (le plus tôt)
      jsRow({
        8: "01/06/2026",
        9: "06:00:00",
        10: "14:00:00",
        11: "01/06/2026",
      }),
      // NPO bien plus tard — ne doit pas influencer
      npoRow({ 8: "31/12/2026", 11: "31/12/2026" }),
      // JS plus tard mais pas le max
      jsRow({
        8: "05/06/2026",
        9: "20:00:00",
        10: "05:00:00",
        11: "06/06/2026",
      }),
    ];
    const result = parsePlanningRows(rows);
    expect(result.periodStart?.getDate()).toBe(1);
    expect(result.periodStart?.getMonth()).toBe(5);
    // periodEnd = 06/06/2026 05:00 (fin du service de nuit le plus tardif)
    expect(result.periodEnd?.getDate()).toBe(6);
    expect(result.periodEnd?.getHours()).toBe(5);
  });

  it("rejette un fichier vide", () => {
    expect(() => parsePlanningRows([])).toThrow(/vide/);
  });

  it("rejette un en-tête invalide", () => {
    const bad = [...HEADER];
    bad[8] = "X";
    expect(() => parsePlanningRows([bad, jsRow()])).toThrow(/colonne 8/);
  });

  it("accumule les erreurs ligne par ligne", () => {
    const rows = [
      HEADER,
      jsRow({ 4: null }), // matricule manquant
      jsRow({ 8: "99/99/9999" }), // date invalide
      jsRow(), // OK
    ];
    const result = parsePlanningRows(rows);
    expect(result.rowsService).toBe(1);
    expect(result.rowsErrored).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].rowIndex).toBe(1);
    expect(result.errors[1].rowIndex).toBe(2);
  });
});

// ─── End-to-end via buffer xlsx ──────────────────────────────────────────────

describe("parsePlanningBuffer (end-to-end via xlsx)", () => {
  it("lit un workbook XLSX construit en mémoire", () => {
    const rows = [HEADER, jsRow(), npoRow()];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planning");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parsePlanningBuffer(buf as Buffer);
    expect(result.rowsService).toBe(1);
    expect(result.rowsNonService).toBe(1);
    expect(result.shifts[0].matricule).toBe("9504912B");
  });

  it("readPlanningWorkbook renvoie un tableau 2D", () => {
    const rows = [HEADER, jsRow()];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planning");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const read = readPlanningWorkbook(buf as Buffer);
    expect(read.length).toBeGreaterThanOrEqual(2);
    expect(read[0][4]).toBe("CODE IMMATRICULATION");
  });
});
