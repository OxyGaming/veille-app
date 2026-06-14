import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPES,
  ACTIVITY_ENTITY_TYPES,
  defaultMessageFor,
  defaultTargetUrlFor,
} from "./activityFeed";

/**
 * Tests Vitest sur les helpers purs (pas d'écriture Prisma).
 * `recordActivity` est testé via les scénarios C7 (instrumentation).
 */

describe("ACTIVITY_TYPES", () => {
  it("contient les 9 types MVP attendus (6 base + 3 équipement)", () => {
    expect(ACTIVITY_TYPES).toEqual([
      "SESSION_FINISHED",
      "VISIT_FINISHED",
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
  it("contient les 6 types d'entité cible attendus", () => {
    expect(ACTIVITY_ENTITY_TYPES).toEqual([
      "session",
      "visit",
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
