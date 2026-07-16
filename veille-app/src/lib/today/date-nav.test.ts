import { describe, expect, it } from "vitest";
import {
  addDaysToDateStr,
  formatFrenchDayLabel,
  isTodayParis,
  parisDateStr,
  parisDayBounds,
  parseDateParam,
} from "./date-nav";

describe("parseDateParam", () => {
  it("accepte une date valide YYYY-MM-DD", () => {
    expect(parseDateParam("2026-07-15")).toBe("2026-07-15");
  });

  it("retombe sur aujourd'hui (Paris) si absent", () => {
    const now = new Date("2026-07-16T10:00:00Z");
    expect(parseDateParam(undefined, now)).toBe(parisDateStr(now));
  });

  it("retombe sur aujourd'hui si le format est invalide", () => {
    const now = new Date("2026-07-16T10:00:00Z");
    expect(parseDateParam("15/07/2026", now)).toBe(parisDateStr(now));
    expect(parseDateParam("not-a-date", now)).toBe(parisDateStr(now));
  });

  it("rejette une date calendaire impossible (ex. 2026-02-30)", () => {
    const now = new Date("2026-07-16T10:00:00Z");
    expect(parseDateParam("2026-02-30", now)).toBe(parisDateStr(now));
  });
});

describe("addDaysToDateStr", () => {
  it("avance et recule d'un jour", () => {
    expect(addDaysToDateStr("2026-07-16", 1)).toBe("2026-07-17");
    expect(addDaysToDateStr("2026-07-16", -1)).toBe("2026-07-15");
  });

  it("traverse un changement de mois/année", () => {
    expect(addDaysToDateStr("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("parisDayBounds", () => {
  it("bornes de 24h en période standard (CET, hiver)", () => {
    const { start, end } = parisDayBounds("2026-01-15");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    // Minuit Paris (CET = UTC+1) → 23:00 UTC la veille.
    expect(start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("bornes correctes en période d'été (CEST, UTC+2)", () => {
    const { start } = parisDayBounds("2026-07-16");
    expect(start.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("gère le jour de bascule DST (mars) sans erreur de bornes", () => {
    // Dernier dimanche de mars 2026 = 29 mars (passage CET → CEST).
    const { start, end } = parisDayBounds("2026-03-29");
    // Ce jour ne dure que 23h en heure réelle.
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("start/end s'enchaînent sans trou ni chevauchement entre 2 jours", () => {
    const d1 = parisDayBounds("2026-07-16");
    const d2 = parisDayBounds("2026-07-17");
    expect(d1.end.getTime()).toBe(d2.start.getTime());
  });
});

describe("isTodayParis", () => {
  it("vrai si dateStr == jour calendaire de now", () => {
    const now = new Date("2026-07-16T22:30:00Z"); // tard le soir UTC
    expect(isTodayParis(parisDateStr(now), now)).toBe(true);
  });

  it("faux pour un autre jour", () => {
    const now = new Date("2026-07-16T10:00:00Z");
    expect(isTodayParis("2026-07-15", now)).toBe(false);
  });
});

describe("formatFrenchDayLabel", () => {
  it("formate en toutes lettres, locale fr-FR (aligné sur TodayHeader)", () => {
    // 15 juillet 2026 est un mercredi.
    expect(formatFrenchDayLabel("2026-07-15")).toBe("mercredi 15 juillet");
  });
});
