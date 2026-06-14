import { describe, it, expect } from "vitest";
import {
  mapDraftSessionToTodoItem,
  mapDraftVisitToTodoItem,
  mapExpiringEquipmentToTodoItem,
  mapImportedActionToTodoItem,
  mapRecentEvent,
} from "./mappers";

/**
 * Tests des mappers purs — pas de Prisma. On simule des rows en mémoire
 * pour valider la transformation row → TodoItem / RecentActivityItem.
 */

const NOW = new Date("2026-06-14T08:00:00Z");

describe("mapImportedActionToTodoItem", () => {
  it("compose titre + sous-titre depuis keyPoint, agent, dueAt", () => {
    const item = mapImportedActionToTodoItem({
      id: "a1",
      teamId: "t1",
      agentId: "ag1",
      siteId: null,
      keyPoint: "Affichage signalisation poste 7",
      comment: null,
      dueAt: new Date("2026-06-15T00:00:00Z"),
      agent: { id: "ag1", firstName: "Jean", lastName: "Dupont" },
      site: null,
    });
    expect(item.id).toBe("action:a1");
    expect(item.sourceType).toBe("ACTION");
    expect(item.title).toBe("Affichage signalisation poste 7");
    expect(item.subtitle).toContain("Dupont Jean");
    expect(item.subtitle).toContain("15/06");
    expect(item.context?.agentId).toBe("ag1");
    expect(item.context?.teamId).toBe("t1");
    expect(item.cta.label).toBe("Valider");
    expect(item.cta.href).toBe("/agents/ag1");
  });

  it("retombe sur comment puis libellé par défaut", () => {
    const item = mapImportedActionToTodoItem({
      id: "a2",
      teamId: "t1",
      agentId: null,
      siteId: null,
      keyPoint: null,
      comment: "Vérifier l'extincteur",
      dueAt: null,
      agent: null,
      site: null,
    });
    expect(item.title).toBe("Vérifier l'extincteur");
    expect(item.dueAt).toBeNull();
  });

  it("tronque les titres trop longs avec ellipse", () => {
    const longText = "A".repeat(150);
    const item = mapImportedActionToTodoItem({
      id: "a3",
      teamId: "t1",
      agentId: null,
      siteId: null,
      keyPoint: longText,
      comment: null,
      dueAt: null,
      agent: null,
      site: null,
    });
    expect(item.title.length).toBeLessThanOrEqual(80);
    expect(item.title.endsWith("…")).toBe(true);
  });
});

describe("mapDraftSessionToTodoItem", () => {
  it("génère un item DRAFT_REMINDER avec CTA Reprendre", () => {
    const item = mapDraftSessionToTodoItem({
      id: "s1",
      teamId: "t1",
      startedAt: new Date("2026-06-10T09:14:00Z"),
      updatedAt: new Date("2026-06-10T09:14:00Z"),
      agent: { id: "ag1", firstName: "Jean", lastName: "Bardella" },
    });
    expect(item.id).toBe("draft-session:s1");
    expect(item.sourceType).toBe("DRAFT_REMINDER");
    expect(item.title).toContain("Bardella Jean");
    expect(item.dueAt).toBeNull();
    expect(item.cta).toEqual({ label: "Reprendre", href: "/sessions/s1" });
  });

  it("affiche 'Sans agent' implicitement quand l'agent est absent", () => {
    const item = mapDraftSessionToTodoItem({
      id: "s2",
      teamId: "t1",
      startedAt: new Date("2026-06-10T09:14:00Z"),
      updatedAt: new Date("2026-06-10T09:14:00Z"),
      agent: null,
    });
    expect(item.title).toBe("Veille en brouillon");
  });
});

describe("mapDraftVisitToTodoItem", () => {
  it("génère un item DRAFT_REMINDER lié au site", () => {
    const item = mapDraftVisitToTodoItem({
      id: "v1",
      teamId: "t1",
      visitDate: new Date("2026-06-12T08:00:00Z"),
      updatedAt: new Date("2026-06-12T08:30:00Z"),
      site: { id: "si1", name: "POS-LYON" },
    });
    expect(item.id).toBe("draft-visit:v1");
    expect(item.title).toContain("POS-LYON");
    expect(item.context?.siteId).toBe("si1");
    expect(item.cta).toEqual({ label: "Reprendre", href: "/visits/v1" });
  });
});

describe("mapExpiringEquipmentToTodoItem", () => {
  it("affiche 'expire dans X j' pour une péremption future", () => {
    const item = mapExpiringEquipmentToTodoItem(
      {
        id: "eq1",
        label: "Extincteur N°7 CO2 2kg",
        category: "Extincteurs",
        expirationDate: new Date("2026-06-22T00:00:00Z"),
        site: { id: "si1", name: "POS-LYON", teamId: "t1" },
      },
      NOW,
    );
    expect(item.id).toBe("equipment:eq1");
    expect(item.sourceType).toBe("EQUIPMENT_EXPIRING");
    expect(item.subtitle).toContain("POS-LYON");
    expect(item.subtitle).toContain("expire dans");
    expect(item.dueAt?.toISOString()).toBe("2026-06-22T00:00:00.000Z");
    expect(item.cta.href).toBe("/sites/si1");
  });

  it("affiche 'expire aujourd'hui' pour le jour J", () => {
    const item = mapExpiringEquipmentToTodoItem(
      {
        id: "eq2",
        label: "AED",
        category: "Défibrillateurs",
        expirationDate: new Date("2026-06-14T12:00:00Z"),
        site: { id: "si1", name: "POS-LYON", teamId: "t1" },
      },
      NOW,
    );
    expect(item.subtitle).toContain("expire aujourd'hui");
  });

  it("affiche 'périmé depuis X j' pour une date passée", () => {
    const item = mapExpiringEquipmentToTodoItem(
      {
        id: "eq3",
        label: "Trousse",
        category: "Premiers secours",
        expirationDate: new Date("2026-06-10T00:00:00Z"),
        site: { id: "si1", name: "POS-LYON", teamId: null },
      },
      NOW,
    );
    expect(item.subtitle).toContain("périmé depuis 4 j");
  });
});

describe("mapRecentEvent", () => {
  it("préfixe le label avec une date relative 'Aujourd'hui HH:MM'", () => {
    const e = mapRecentEvent(
      {
        kind: "session",
        id: "s1",
        at: new Date("2026-06-14T07:22:00Z"),
        label: "Veille terminée — Bardella",
      },
      NOW,
    );
    expect(e.label).toContain("Veille terminée — Bardella");
    expect(e.label.toLowerCase()).toMatch(/^(aujourd|hier|\d|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/);
  });

  it("utilise 'Hier' pour J-1", () => {
    const e = mapRecentEvent(
      {
        kind: "visit",
        id: "v1",
        at: new Date("2026-06-13T15:00:00Z"),
        label: "Visite terminée — POS-LYON",
      },
      NOW,
    );
    expect(e.label.startsWith("Hier")).toBe(true);
  });

  it("compose un id unique par kind+id source", () => {
    const a = mapRecentEvent({ kind: "session", id: "x", at: NOW, label: "..." }, NOW);
    const b = mapRecentEvent({ kind: "visit", id: "x", at: NOW, label: "..." }, NOW);
    expect(a.id).not.toBe(b.id);
  });
});
