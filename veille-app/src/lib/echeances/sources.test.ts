import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Pas de DB : on stubbe le client Prisma avec vi.mock. Les sources doivent
// fonctionner uniquement à partir de la forme des rows.

const findManySite = vi.fn();
const findManyEquipment = vi.fn();
const findManyAction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    site: { findMany: (...a: unknown[]) => findManySite(...a) },
    siteEquipment: { findMany: (...a: unknown[]) => findManyEquipment(...a) },
    importedAction: { findMany: (...a: unknown[]) => findManyAction(...a) },
  },
}));

import {
  getActionEcheances,
  getEcheancesForSite,
  getEquipmentEcheances,
  getVisitEcheances,
} from "./sources";

beforeEach(() => {
  findManySite.mockReset();
  findManyEquipment.mockReset();
  findManyAction.mockReset();
});

const NOW = new Date("2026-06-14T12:00:00.000Z");
const DAY_MS = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const into = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const USER: SessionUser = {
  id: "u1",
  email: "u@x",
  name: "U",
  role: "EDITOR",
  teamId: "tA",
  teamIds: ["tA", "tB"],
  viewAllTeams: false,
};

// ─── Visites ────────────────────────────────────────────────────────────────

describe("getVisitEcheances", () => {
  it("site jamais visité → 2 items (trim+plan), tous deux late + critique", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "Site Alpha",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    expect(items).toHaveLength(2);
    const trim = items.find((i) => i.kind === "VISIT_QUARTERLY")!;
    const plan = items.find((i) => i.kind === "VISIT_PLANNED")!;
    expect(trim.dueAt).toBeNull();
    expect(trim.daysToDue).toBeNull();
    expect(trim.urgency).toBe("late");
    expect(trim.isCritical).toBe(true);
    expect(plan.urgency).toBe("late");
    expect(plan.isCritical).toBe(true);
    expect(trim.context.teamIds).toEqual(["tA"]);
    expect(trim.cta.href).toBe("/sites/s1");
  });

  it("site occupé visité trim il y a 80 j → trim non en retard (10 j restants)", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [
          { finishedAt: ago(80), template: { slug: "trimestrielle-incendie" } },
        ],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    const trim = items.find((i) => i.kind === "VISIT_QUARTERLY")!;
    expect(trim.daysToDue).toBe(10);
    expect(trim.urgency).toBe("later");
    expect(trim.isCritical).toBe(false);
  });

  it("site occupé visité plan il y a 200 j → plan en retard 20 j → late mais non critique", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [
          { finishedAt: ago(200), template: { slug: "planifiee-eic-ra" } },
        ],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    const plan = items.find((i) => i.kind === "VISIT_PLANNED")!;
    // dueAt = lastVisit + 180j = -200+180 = -20 → en retard de 20j
    expect(plan.daysToDue).toBe(-20);
    expect(plan.urgency).toBe("late");
    expect(plan.isCritical).toBe(false); // < -30 → critique ; -20 ne l'est pas
  });

  it("site inoccupé visité plan il y a 200 j → plan OK (165 j restants)", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: false,
        memberships: [{ teamId: "tA" }],
        visits: [
          { finishedAt: ago(200), template: { slug: "planifiee-eic-ra" } },
        ],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    const plan = items.find((i) => i.kind === "VISIT_PLANNED")!;
    // dueAt = lastVisit + 365j = -200+365 = 165j restants → future
    expect(plan.daysToDue).toBe(165);
    expect(plan.urgency).toBe("future");
    expect(plan.isCritical).toBe(false);
    expect(plan.context.siteIsOccupied).toBe(false);
  });

  it("garde la dernière visite par cadence (les autres sont ignorées)", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [
          { finishedAt: ago(20), template: { slug: "trimestrielle-recente" } },
          { finishedAt: ago(150), template: { slug: "trimestrielle-old" } },
          { finishedAt: ago(50), template: { slug: "planifiee-recente" } },
          { finishedAt: ago(400), template: { slug: "planifiee-old" } },
        ],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    const trim = items.find((i) => i.kind === "VISIT_QUARTERLY")!;
    const plan = items.find((i) => i.kind === "VISIT_PLANNED")!;
    expect(trim.daysToDue).toBe(70); // 90 - 20
    expect(plan.daysToDue).toBe(130); // 180 - 50
  });

  it("siteId optionnel → la requête Prisma reçoit `where.id`", async () => {
    findManySite.mockResolvedValue([]);
    await getVisitEcheances(USER, NOW, "s1");
    expect(findManySite).toHaveBeenCalledTimes(1);
    const arg = findManySite.mock.calls[0][0];
    expect(arg.where.id).toBe("s1");
  });

  it("templates au slug `inventaire-*` (`other`) ignorés", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [
          { finishedAt: ago(5), template: { slug: "inventaire-pompes" } },
        ],
      },
    ]);
    const items = await getVisitEcheances(USER, NOW);
    // Aucune visite trim/plan trouvée → comportement « jamais »
    const trim = items.find((i) => i.kind === "VISIT_QUARTERLY")!;
    expect(trim.dueAt).toBeNull();
    expect(trim.isCritical).toBe(true);
  });
});

// ─── Équipements ────────────────────────────────────────────────────────────

describe("getEquipmentEcheances", () => {
  it("équipement déjà périmé (-2 j) → late + critique", async () => {
    findManyEquipment.mockResolvedValue([
      {
        id: "e1",
        label: "Extincteur EXT-12",
        category: "Sécurité incendie",
        expirationDate: ago(2),
        site: {
          id: "s1",
          name: "Alpha",
          isOccupied: true,
          memberships: [{ teamId: "tA" }],
        },
      },
    ]);
    const items = await getEquipmentEcheances(USER, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].daysToDue).toBe(-2);
    expect(items[0].urgency).toBe("late");
    expect(items[0].isCritical).toBe(true);
    expect(items[0].cta.href).toBe("/sites/s1");
    expect(items[0].subtitle).toContain("Sécurité incendie");
  });

  it("équipement expirant dans 5 j → soon, non critique", async () => {
    findManyEquipment.mockResolvedValue([
      {
        id: "e2",
        label: "BAES B-04",
        category: "Éclairage",
        expirationDate: into(5),
        site: {
          id: "s1",
          name: "Alpha",
          isOccupied: true,
          memberships: [{ teamId: "tA" }],
        },
      },
    ]);
    const items = await getEquipmentEcheances(USER, NOW);
    expect(items[0].urgency).toBe("soon");
    expect(items[0].isCritical).toBe(false);
  });

  it("expirationDate null filtré côté JS (et n'apparaît pas)", async () => {
    findManyEquipment.mockResolvedValue([
      {
        id: "e3",
        label: "Pompe",
        category: "Pompes",
        expirationDate: null,
        site: {
          id: "s1",
          name: "Alpha",
          isOccupied: true,
          memberships: [{ teamId: "tA" }],
        },
      },
    ]);
    const items = await getEquipmentEcheances(USER, NOW);
    expect(items).toHaveLength(0);
  });

  it("siteId optionnel → propagé dans `where.site.id`", async () => {
    findManyEquipment.mockResolvedValue([]);
    await getEquipmentEcheances(USER, NOW, "s1");
    const arg = findManyEquipment.mock.calls[0][0];
    expect(arg.where.site.id).toBe("s1");
  });
});

// ─── Actions ────────────────────────────────────────────────────────────────

describe("getActionEcheances", () => {
  it("action en retard 10 j sur un agent → critique + CTA Valider /agents/...", async () => {
    findManyAction.mockResolvedValue([
      {
        id: "a1",
        teamId: "tA",
        agentId: "agA",
        siteId: null,
        keyPoint: "Refaire formation incendie",
        comment: null,
        dueAt: ago(10),
        agent: { id: "agA", firstName: "Jean", lastName: "Dupont" },
        site: null,
      },
    ]);
    const items = await getActionEcheances(USER, NOW);
    expect(items).toHaveLength(1);
    const a = items[0];
    expect(a.daysToDue).toBe(-10);
    expect(a.urgency).toBe("late");
    expect(a.isCritical).toBe(true); // > 7 j retard
    expect(a.cta.label).toBe("Valider");
    expect(a.cta.href).toBe("/agents/agA?actionId=a1");
    expect(a.title).toBe("Refaire formation incendie");
    expect(a.context.agentName).toBe("Dupont Jean");
    expect(a.context.teamIds).toContain("tA");
  });

  it("action en retard 3 j → late mais non critique (≤ 7 j)", async () => {
    findManyAction.mockResolvedValue([
      {
        id: "a2",
        teamId: "tA",
        agentId: null,
        siteId: "s1",
        keyPoint: null,
        comment: "Vérifier la porte",
        dueAt: ago(3),
        agent: null,
        site: {
          id: "s1",
          name: "Alpha",
          isOccupied: true,
          memberships: [{ teamId: "tA" }],
        },
      },
    ]);
    const items = await getActionEcheances(USER, NOW);
    expect(items[0].isCritical).toBe(false);
    expect(items[0].cta.label).toBe("Valider");
    expect(items[0].cta.href).toBe("/sites/s1");
    expect(items[0].title).toBe("Vérifier la porte"); // fallback comment
  });

  it("action à venir 20 j → later, non critique, CTA Ouvrir", async () => {
    findManyAction.mockResolvedValue([
      {
        id: "a3",
        teamId: "tA",
        agentId: "agA",
        siteId: null,
        keyPoint: "Renouveler habilitation",
        comment: null,
        dueAt: into(20),
        agent: { id: "agA", firstName: null, lastName: "Martin" },
        site: null,
      },
    ]);
    const items = await getActionEcheances(USER, NOW);
    expect(items[0].urgency).toBe("later");
    expect(items[0].isCritical).toBe(false);
    expect(items[0].cta.label).toBe("Ouvrir");
  });

  it("dueAt null filtré côté JS (sécurité runtime)", async () => {
    findManyAction.mockResolvedValue([
      {
        id: "a4",
        teamId: "tA",
        agentId: null,
        siteId: null,
        keyPoint: "X",
        comment: null,
        dueAt: null,
        agent: null,
        site: null,
      },
    ]);
    const items = await getActionEcheances(USER, NOW);
    expect(items).toHaveLength(0);
  });

  it("siteId optionnel → propagé dans `where.siteId`", async () => {
    findManyAction.mockResolvedValue([]);
    await getActionEcheances(USER, NOW, "s1");
    const arg = findManyAction.mock.calls[0][0];
    expect(arg.where.siteId).toBe("s1");
  });
});

// ─── Composition site (drilldown C8) ────────────────────────────────────────

describe("getEcheancesForSite", () => {
  it("agrège les 3 sources avec un filtre `siteId` propagé partout", async () => {
    findManySite.mockResolvedValue([
      {
        id: "s1",
        name: "S1",
        isOccupied: true,
        memberships: [{ teamId: "tA" }],
        visits: [],
      },
    ]);
    findManyEquipment.mockResolvedValue([]);
    findManyAction.mockResolvedValue([]);

    const items = await getEcheancesForSite(USER, "s1", NOW);
    // 2 visites (jamais) + 0 + 0
    expect(items).toHaveLength(2);
    expect(findManySite.mock.calls[0][0].where.id).toBe("s1");
    expect(findManyEquipment.mock.calls[0][0].where.site.id).toBe("s1");
    expect(findManyAction.mock.calls[0][0].where.siteId).toBe("s1");
  });
});
