import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPES,
  ACTIVITY_ENTITY_TYPES,
  defaultMessageFor,
  defaultTargetUrlFor,
  formatQuotedSnippet,
  joinActivityParts,
} from "./activityFeed";

/**
 * Tests Vitest sur les helpers purs (pas d'écriture Prisma).
 * `recordActivity` est testé via les scénarios C7 (instrumentation).
 */

describe("ACTIVITY_TYPES", () => {
  it("contient les 10 types attendus (6 base + 3 équipement + tournée VS)", () => {
    expect(ACTIVITY_TYPES).toEqual([
      "SESSION_FINISHED",
      "VISIT_FINISHED",
      "VEHICLE_ROUND_FINISHED",
      "AGENT_NOTE",
      "AGENT_SIGHTED",
      "ACTION_CREATED",
      "ACTION_VALIDATED",
      "EQUIPMENT_NON_COMPLIANT",
      "EQUIPMENT_REPLACED",
      "EQUIPMENT_ADDED",
    ]);
  });
});

describe("ACTIVITY_ENTITY_TYPES", () => {
  it("contient les 7 types d'entité cible attendus", () => {
    expect(ACTIVITY_ENTITY_TYPES).toEqual([
      "session",
      "visit",
      "vehicle-round",
      "agent",
      "action",
      "equipment",
      "site",
    ]);
  });
});

describe("defaultMessageFor", () => {
  it("produit un message FR par type avec actor + entityLabel", () => {
    expect(
      defaultMessageFor({
        type: "SESSION_FINISHED",
        actorName: "Marie",
        entityLabel: "Bardella J.",
      }),
    ).toBe("Marie a terminé une veille — Bardella J..");
    expect(
      defaultMessageFor({
        type: "VISIT_FINISHED",
        actorName: "Pierre",
        entityLabel: "POS-LYON",
      }),
    ).toBe("Pierre a terminé une visite — POS-LYON.");
    expect(
      defaultMessageFor({
        type: "AGENT_NOTE",
        actorName: "Jessy",
        entityLabel: "Martin L.",
      }),
    ).toBe("Jessy a commenté Martin L..");
    expect(
      defaultMessageFor({
        type: "AGENT_SIGHTED",
        actorName: "Jessy",
        entityLabel: "Martin L.",
      }),
    ).toBe("Jessy a vu Martin L..");
    expect(
      defaultMessageFor({
        type: "ACTION_CREATED",
        actorName: "Marie",
        entityLabel: "Bardella J.",
      }),
    ).toBe("Marie a créé une action sur Bardella J..");
    expect(
      defaultMessageFor({
        type: "ACTION_VALIDATED",
        actorName: "Marie",
        entityLabel: "Affichage poste 7",
      }),
    ).toBe("Marie a validé une action — Affichage poste 7.");
    expect(
      defaultMessageFor({
        type: "EQUIPMENT_NON_COMPLIANT",
        actorName: "Pierre",
        entityLabel: "Extincteur N°7",
      }),
    ).toBe("Pierre a signalé une non-conformité sur Extincteur N°7.");
    expect(
      defaultMessageFor({
        type: "EQUIPMENT_REPLACED",
        actorName: "Pierre",
        entityLabel: "Extincteur N°7",
      }),
    ).toBe("Pierre a remplacé l'équipement Extincteur N°7.");
    expect(
      defaultMessageFor({
        type: "EQUIPMENT_ADDED",
        actorName: "Marie",
        entityLabel: "AED LifePak",
      }),
    ).toBe("Marie a ajouté un équipement — AED LifePak.");
  });

  it("tolère l'absence d'acteur et d'entité (fallback 'Quelqu'un' / '—')", () => {
    expect(
      defaultMessageFor({ type: "SESSION_FINISHED" }),
    ).toBe("Quelqu'un a terminé une veille — —.");
    expect(
      defaultMessageFor({
        type: "ACTION_VALIDATED",
        actorName: "",
        entityLabel: "   ",
      }),
    ).toBe("Quelqu'un a validé une action — —.");
  });
});

describe("defaultTargetUrlFor", () => {
  it("renvoie /sessions/[id] pour une session", () => {
    expect(
      defaultTargetUrlFor({ entityType: "session", entityId: "s1" }),
    ).toBe("/sessions/s1");
  });
  it("renvoie /visits/[id]/report pour une visite", () => {
    expect(
      defaultTargetUrlFor({ entityType: "visit", entityId: "v1" }),
    ).toBe("/visits/v1/report");
  });
  it("renvoie /agents/[id] pour un agent", () => {
    expect(
      defaultTargetUrlFor({ entityType: "agent", entityId: "a1" }),
    ).toBe("/agents/a1");
  });
  it("renvoie /sites/[id] pour un site", () => {
    expect(
      defaultTargetUrlFor({ entityType: "site", entityId: "si1" }),
    ).toBe("/sites/si1");
  });
  it("renvoie null pour action et equipment (URL contextuelle laissée au call-site)", () => {
    expect(
      defaultTargetUrlFor({ entityType: "action", entityId: "ac1" }),
    ).toBeNull();
    expect(
      defaultTargetUrlFor({ entityType: "equipment", entityId: "eq1" }),
    ).toBeNull();
  });
  it("renvoie null si entityId est vide", () => {
    expect(
      defaultTargetUrlFor({ entityType: "session", entityId: "" }),
    ).toBeNull();
  });
});

// ─── formatQuotedSnippet + joinActivityParts (C10) ──────────────────────────

describe("formatQuotedSnippet", () => {
  it("encadre un texte non vide entre guillemets français", () => {
    expect(formatQuotedSnippet("RAS")).toBe("« RAS »");
  });

  it("trim le texte avant traitement", () => {
    expect(formatQuotedSnippet("  bonjour  ")).toBe("« bonjour »");
  });

  it("renvoie null si vide ou whitespace", () => {
    expect(formatQuotedSnippet(null)).toBeNull();
    expect(formatQuotedSnippet(undefined)).toBeNull();
    expect(formatQuotedSnippet("")).toBeNull();
    expect(formatQuotedSnippet("   ")).toBeNull();
  });

  it("tronque avec ellipse si > max chars", () => {
    const long = "a".repeat(200);
    const out = formatQuotedSnippet(long, 50);
    expect(out).toBe(`« ${"a".repeat(49)}… »`);
    expect(out!.length).toBeLessThan(60);
  });

  it("ne tronque pas si exactement max chars", () => {
    const fifty = "a".repeat(50);
    expect(formatQuotedSnippet(fifty, 50)).toBe(`« ${fifty} »`);
  });

  it("default max = 140 chars", () => {
    const huge = "x".repeat(500);
    const out = formatQuotedSnippet(huge);
    expect(out).toContain("…");
    expect(out!.length).toBeLessThan(150);
  });
});

describe("joinActivityParts", () => {
  it("joint avec un espace, ignore null/undefined/vide", () => {
    expect(
      joinActivityParts(["A", null, "B", undefined, "", "  ", "C"]),
    ).toBe("A B C");
  });

  it("trim chaque part avant join", () => {
    expect(joinActivityParts(["  A  ", " B"])).toBe("A B");
  });

  it("tout vide → string vide", () => {
    expect(joinActivityParts([null, undefined, "", "  "])).toBe("");
  });

  it("composition réelle — message + snippet", () => {
    const out = joinActivityParts([
      "Jessy a vu Tom Martin.",
      formatQuotedSnippet("RAS au poste."),
    ]);
    expect(out).toBe("Jessy a vu Tom Martin. « RAS au poste. »");
  });

  it("composition réelle — pas de snippet → message brut sans espace final", () => {
    const out = joinActivityParts([
      "Jessy a vu Tom Martin.",
      formatQuotedSnippet(null),
    ]);
    expect(out).toBe("Jessy a vu Tom Martin.");
  });
});
