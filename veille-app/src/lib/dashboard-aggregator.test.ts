import { describe, expect, it } from "vitest";
import { classifyNcKind, truncateTitle } from "./dashboard-aggregator";

describe("classifyNcKind", () => {
  it("INVENTORY → veille de site", () => {
    expect(classifyNcKind({ kind: "INVENTORY", slug: "veille-site" })).toBe(
      "INVENTORY",
    );
  });

  it("CHECKLIST + trimestrielle-* → QUARTERLY", () => {
    expect(
      classifyNcKind({ kind: "CHECKLIST", slug: "trimestrielle-incendie" }),
    ).toBe("QUARTERLY");
    expect(
      classifyNcKind({ kind: "CHECKLIST", slug: "trimestrielle-eic" }),
    ).toBe("QUARTERLY");
  });

  it("CHECKLIST + planifiee-* → PLANNED", () => {
    expect(classifyNcKind({ kind: "CHECKLIST", slug: "planifiee-eic-ra" })).toBe(
      "PLANNED",
    );
  });

  it("autre slug CHECKLIST → OTHER", () => {
    expect(classifyNcKind({ kind: "CHECKLIST", slug: "unknown" })).toBe("OTHER");
  });

  it("kind/slug nuls → OTHER", () => {
    expect(classifyNcKind({ kind: null, slug: null })).toBe("OTHER");
    expect(classifyNcKind({ kind: undefined, slug: undefined })).toBe("OTHER");
  });

  it("INVENTORY l'emporte même avec slug exotique", () => {
    expect(classifyNcKind({ kind: "INVENTORY", slug: "x" })).toBe("INVENTORY");
  });
});

describe("truncateTitle", () => {
  it("renvoie '(sans titre)' si vide/null/whitespace", () => {
    expect(truncateTitle(null)).toBe("(sans titre)");
    expect(truncateTitle(undefined)).toBe("(sans titre)");
    expect(truncateTitle("")).toBe("(sans titre)");
    expect(truncateTitle("   ")).toBe("(sans titre)");
  });

  it("conserve un titre court inchangé", () => {
    expect(truncateTitle("Refaire formation")).toBe("Refaire formation");
  });

  it("trim les espaces périphériques", () => {
    expect(truncateTitle("  Refaire formation  ")).toBe("Refaire formation");
  });

  it("tronque avec ellipse au-delà de max (default 80)", () => {
    const long = "x".repeat(150);
    const out = truncateTitle(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(80);
  });

  it("respecte un max custom", () => {
    expect(truncateTitle("abcdef", 4)).toBe("abc…");
    expect(truncateTitle("abcd", 4)).toBe("abcd");
  });
});
