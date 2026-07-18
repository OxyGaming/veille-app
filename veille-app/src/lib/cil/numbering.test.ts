import { describe, expect, it } from "vitest";
import {
  availabilityGrid,
  nextAvailableNumber,
  nextNumberForSubtype,
  NUMBER_RANGES,
  randomAvailableNumber,
  randomNumberForSubtype,
  rangeForSubtype,
  rangeKeyForSubtype,
} from "./numbering";

describe("rangeKeyForSubtype / rangeForSubtype", () => {
  it("protections → 10-29", () => {
    expect(rangeKeyForSubtype("PROTECTION_CIRCULATION")).toBe("PROTECTION");
    expect(rangeKeyForSubtype("PROTECTION_ELECTRIQUE")).toBe("PROTECTION");
    expect(rangeForSubtype("PROTECTION_CIRCULATION")).toEqual([10, 29]);
  });
  it("reprises / rétablissements → 30-49", () => {
    for (const s of [
      "REPRISE_PARTIELLE",
      "REPRISE_NORMALE",
      "RETABLISSEMENT_PARTIEL",
      "RETABLISSEMENT_NORMAL",
    ] as const) {
      expect(rangeKeyForSubtype(s)).toBe("RETABLISSEMENT");
    }
    expect(rangeForSubtype("REPRISE_NORMALE")).toEqual([30, 49]);
  });
  it("libre → 50-69", () => {
    expect(rangeForSubtype("LIBRE")).toEqual([50, 69]);
  });
});

describe("nextAvailableNumber", () => {
  it("renvoie le minimum si rien n'est utilisé", () => {
    expect(nextAvailableNumber(NUMBER_RANGES.PROTECTION, [])).toBe(10);
  });
  it("saute les numéros utilisés", () => {
    expect(nextAvailableNumber(NUMBER_RANGES.PROTECTION, [10, 11, 13])).toBe(12);
  });
  it("renvoie null quand la plage est épuisée", () => {
    const all = Array.from({ length: 20 }, (_, i) => 10 + i); // 10..29
    expect(nextAvailableNumber(NUMBER_RANGES.PROTECTION, all)).toBeNull();
  });
  it("accepte un Set", () => {
    expect(nextAvailableNumber(NUMBER_RANGES.LIBRE, new Set([50, 51]))).toBe(52);
  });
});

describe("nextNumberForSubtype", () => {
  it("réserve dans la bonne plage indépendamment des autres plages", () => {
    // 10,11 pris en protection ; 30 pris en rétablissement ; 50 pris en libre
    const used = [10, 11, 30, 50];
    expect(nextNumberForSubtype("PROTECTION_ELECTRIQUE", used)).toBe(12);
    expect(nextNumberForSubtype("REPRISE_NORMALE", used)).toBe(31);
    expect(nextNumberForSubtype("LIBRE", used)).toBe(51);
  });
});

describe("randomAvailableNumber", () => {
  it("tire toujours un numéro libre dans la plage", () => {
    const used = [10, 11, 12];
    for (let i = 0; i < 50; i++) {
      const n = randomAvailableNumber(NUMBER_RANGES.PROTECTION, used)!;
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(29);
      expect(used).not.toContain(n);
    }
  });
  it("respecte le rng injecté (déterministe)", () => {
    // free = [12..29] (10,11 pris) ; rng=0 → premier libre = 12.
    expect(randomAvailableNumber(NUMBER_RANGES.PROTECTION, [10, 11], () => 0)).toBe(12);
    // rng→ dernier index.
    expect(randomAvailableNumber(NUMBER_RANGES.PROTECTION, [10, 11], () => 0.999)).toBe(29);
  });
  it("null si la plage est pleine", () => {
    const all = Array.from({ length: 20 }, (_, i) => 10 + i);
    expect(randomAvailableNumber(NUMBER_RANGES.PROTECTION, all)).toBeNull();
  });
  it("randomNumberForSubtype tire dans la bonne plage", () => {
    const n = randomNumberForSubtype("LIBRE", [], () => 0)!;
    expect(n).toBe(50);
  });
});

describe("availabilityGrid", () => {
  it("marque les numéros utilisés dans chaque plage", () => {
    const grid = availabilityGrid([10, 35, 69]);
    expect(grid.PROTECTION).toHaveLength(20);
    expect(grid.PROTECTION[0]).toEqual({ n: 10, used: true });
    expect(grid.PROTECTION[1]).toEqual({ n: 11, used: false });
    expect(grid.RETABLISSEMENT.find((c) => c.n === 35)?.used).toBe(true);
    expect(grid.LIBRE.at(-1)).toEqual({ n: 69, used: true });
  });
});
