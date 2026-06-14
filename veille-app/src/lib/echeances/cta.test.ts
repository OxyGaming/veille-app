import { describe, expect, it } from "vitest";
import { ctaForEcheance } from "./cta";

describe("ctaForEcheance — visites", () => {
  it("VISIT_QUARTERLY → « Ouvrir le site »", () => {
    expect(
      ctaForEcheance({
        kind: "VISIT_QUARTERLY",
        sourceId: "s1",
        daysToDue: 10,
        siteId: "s1",
      }),
    ).toEqual({ label: "Ouvrir le site", href: "/sites/s1" });
  });

  it("VISIT_PLANNED → « Ouvrir le site »", () => {
    expect(
      ctaForEcheance({
        kind: "VISIT_PLANNED",
        sourceId: "s2",
        daysToDue: -5,
        siteId: "s2",
      }),
    ).toEqual({ label: "Ouvrir le site", href: "/sites/s2" });
  });

  it("Visite sans siteId → fallback /today (cas pathologique)", () => {
    expect(
      ctaForEcheance({
        kind: "VISIT_QUARTERLY",
        sourceId: "s3",
        daysToDue: null,
      }),
    ).toEqual({ label: "Ouvrir le site", href: "/today" });
  });
});

describe("ctaForEcheance — équipement", () => {
  it("EQUIPMENT_EXPIRING → « Voir le site »", () => {
    expect(
      ctaForEcheance({
        kind: "EQUIPMENT_EXPIRING",
        sourceId: "eq1",
        daysToDue: -1,
        siteId: "siteA",
      }),
    ).toEqual({ label: "Voir le site", href: "/sites/siteA" });
  });

  it("Équipement sans siteId → fallback /today", () => {
    expect(
      ctaForEcheance({
        kind: "EQUIPMENT_EXPIRING",
        sourceId: "eq2",
        daysToDue: 5,
      }),
    ).toEqual({ label: "Voir le site", href: "/today" });
  });
});

describe("ctaForEcheance — actions", () => {
  it("Action en retard → « Valider » + /agents/{agentId}?actionId=…", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act1",
        daysToDue: -10,
        agentId: "ag1",
      }),
    ).toEqual({ label: "Valider", href: "/agents/ag1?actionId=act1" });
  });

  it("Action à venir → « Ouvrir » + /agents/...", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act2",
        daysToDue: 20,
        agentId: "ag2",
      }),
    ).toEqual({ label: "Ouvrir", href: "/agents/ag2?actionId=act2" });
  });

  it("Action sans agent mais avec site → /sites/{siteId}", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act3",
        daysToDue: -3,
        siteId: "siteB",
      }),
    ).toEqual({ label: "Valider", href: "/sites/siteB" });
  });

  it("Action sans agent ni site → /today (fallback)", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act4",
        daysToDue: 5,
      }),
    ).toEqual({ label: "Ouvrir", href: "/today" });
  });

  it("daysToDue = 0 → « Ouvrir » (pas en retard strictement)", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act5",
        daysToDue: 0,
        agentId: "ag5",
      }),
    ).toMatchObject({ label: "Ouvrir" });
  });

  it("daysToDue = null → « Ouvrir » (action sans échéance définie)", () => {
    expect(
      ctaForEcheance({
        kind: "ACTION_OVERDUE",
        sourceId: "act6",
        daysToDue: null,
        agentId: "ag6",
      }),
    ).toMatchObject({ label: "Ouvrir" });
  });
});
