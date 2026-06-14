import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";
import type { EcheanceItem } from "./types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const getVisitEcheances = vi.fn();
const getEquipmentEcheances = vi.fn();
const getActionEcheances = vi.fn();
const findManyTeam = vi.fn();
const findManySite = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    team: { findMany: (...a: unknown[]) => findManyTeam(...a) },
    site: { findMany: (...a: unknown[]) => findManySite(...a) },
  },
}));

vi.mock("./sources", () => ({
  getVisitEcheances: (...a: unknown[]) => getVisitEcheances(...a),
  getEquipmentEcheances: (...a: unknown[]) => getEquipmentEcheances(...a),
  getActionEcheances: (...a: unknown[]) => getActionEcheances(...a),
}));

import {
  aggregateEcheances,
  getCriticalEcheancesCount,
} from "./aggregator";

beforeEach(() => {
  getVisitEcheances.mockReset();
  getEquipmentEcheances.mockReset();
  getActionEcheances.mockReset();
  findManyTeam.mockReset();
  findManySite.mockReset();
  // Par défaut : sites vides, on n'a pas besoin de tester l'enrichissement
  // partout — uniquement dans le test dédié.
  findManySite.mockResolvedValue([]);
});

const NOW = new Date("2026-06-14T12:00:00.000Z");
const DAY_MS = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const into = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const EDITOR: SessionUser = {
  id: "u1",
  email: "u@x",
  name: "U",
  role: "EDITOR",
  teamId: "tA",
  teamIds: ["tA", "tB"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const ADMIN: SessionUser = {
  ...EDITOR,
  id: "u2",
  role: "ADMIN",
};

function mkItem(p: Partial<EcheanceItem> & { id: string }): EcheanceItem {
  return {
    kind: "ACTION_OVERDUE",
    title: "x",
    dueAt: null,
    daysToDue: null,
    urgency: "late",
    isCritical: false,
    context: { teamIds: [] },
    cta: { label: "x", href: "/" },
    ...p,
  };
}

describe("aggregateEcheances — assemblage", () => {
  it("fan-out parallèle des 3 sources + teams + sites", async () => {
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    findManyTeam.mockResolvedValue([{ id: "tA", name: "A" }]);
    findManySite.mockResolvedValue([{ id: "s1", name: "Alpha" }]);
    const out = await aggregateEcheances(EDITOR, NOW);
    expect(getVisitEcheances).toHaveBeenCalledTimes(1);
    expect(getEquipmentEcheances).toHaveBeenCalledTimes(1);
    expect(getActionEcheances).toHaveBeenCalledTimes(1);
    expect(findManyTeam).toHaveBeenCalledTimes(1);
    expect(findManySite).toHaveBeenCalledTimes(1);
    expect(out.now).toBe(NOW.toISOString());
    expect(out.total).toBe(0);
    expect(out.teamsAvailable).toEqual([{ id: "tA", name: "A" }]);
    expect(out.sitesAvailable).toEqual([{ id: "s1", name: "Alpha" }]);
  });

  it("ADMIN/viewAllTeams → toutes les équipes sans filtre", async () => {
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    findManyTeam.mockResolvedValue([
      { id: "tA", name: "A" },
      { id: "tB", name: "B" },
    ]);
    await aggregateEcheances(ADMIN, NOW);
    expect(findManyTeam.mock.calls[0][0]).not.toHaveProperty("where");
  });

  it("EDITOR avec teamIds vides → teamsAvailable=[] sans requête", async () => {
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    const out = await aggregateEcheances(
      { ...EDITOR, teamIds: [] },
      NOW,
    );
    expect(out.teamsAvailable).toEqual([]);
    expect(findManyTeam).not.toHaveBeenCalled();
  });
});

describe("aggregateEcheances — KPI et groupement", () => {
  it("KPIs calculés post-filtre (count par urgence + critical transverse)", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({
        id: "v1",
        kind: "VISIT_QUARTERLY",
        urgency: "late",
        isCritical: true,
      }),
      mkItem({ id: "v2", kind: "VISIT_PLANNED", urgency: "today" }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({
        id: "e1",
        kind: "EQUIPMENT_EXPIRING",
        urgency: "late",
        isCritical: true,
      }),
      mkItem({ id: "e2", kind: "EQUIPMENT_EXPIRING", urgency: "soon" }),
    ]);
    getActionEcheances.mockResolvedValue([
      mkItem({ id: "a1", urgency: "later" }),
      mkItem({ id: "a2", urgency: "future" }),
    ]);
    findManyTeam.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW);
    expect(out.total).toBe(6);
    expect(out.kpis).toEqual({
      late: 2,
      today: 1,
      soon: 1,
      later: 1,
      future: 1,
      critical: 2,
    });
    expect(out.groups.late.map((i) => i.id).sort()).toEqual(["e1", "v1"]);
    expect(out.criticalItems.map((i) => i.id).sort()).toEqual(["e1", "v1"]);
  });

  it("groups contient les 5 clés même si certaines sont vides", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({ id: "v1", urgency: "late" }),
    ]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    findManyTeam.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW);
    expect(Object.keys(out.groups).sort()).toEqual([
      "future",
      "late",
      "later",
      "soon",
      "today",
    ]);
    expect(out.groups.today).toEqual([]);
  });

  it("groups triés ASC par dueAt", async () => {
    const d1 = ago(3);
    const d2 = ago(10);
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([
      mkItem({ id: "a", urgency: "late", dueAt: d1 }),
      mkItem({ id: "b", urgency: "late", dueAt: d2 }),
    ]);
    findManyTeam.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW);
    expect(out.groups.late.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("aggregateEcheances — filtres", () => {
  beforeEach(() => {
    findManyTeam.mockResolvedValue([]);
  });

  it("filtre type[] : intersection avec kind", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({ id: "v", kind: "VISIT_QUARTERLY", urgency: "later" }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({ id: "e", kind: "EQUIPMENT_EXPIRING", urgency: "later" }),
    ]);
    getActionEcheances.mockResolvedValue([
      mkItem({ id: "a", urgency: "later" }),
    ]);
    const out = await aggregateEcheances(EDITOR, NOW, {
      type: ["VISIT_QUARTERLY", "ACTION_OVERDUE"],
    });
    expect(out.total).toBe(2);
    expect(out.kpis.later).toBe(2);
    expect(out.groups.later.map((i) => i.id).sort()).toEqual(["a", "v"]);
  });

  it("filtre siteId", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({
        id: "v",
        urgency: "late",
        context: { siteId: "s1", teamIds: ["tA"] },
      }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({
        id: "e",
        urgency: "later",
        context: { siteId: "s2", teamIds: ["tA"] },
      }),
    ]);
    getActionEcheances.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW, { siteId: "s1" });
    expect(out.total).toBe(1);
    expect(out.groups.late[0].id).toBe("v");
  });

  it("filtre teamId : un item visible via ≥1 équipe matching passe", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({
        id: "v",
        urgency: "later",
        context: { teamIds: ["tA", "tB"] },
      }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({ id: "e", urgency: "later", context: { teamIds: ["tC"] } }),
    ]);
    getActionEcheances.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW, { teamId: "tA" });
    expect(out.total).toBe(1);
    expect(out.groups.later[0].id).toBe("v");
  });

  it("filtre urgency=critical (D13) — transverse", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({
        id: "v1",
        urgency: "late",
        isCritical: true,
      }),
      mkItem({ id: "v2", urgency: "late", isCritical: false }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({
        id: "e1",
        kind: "EQUIPMENT_EXPIRING",
        urgency: "soon",
        isCritical: false,
      }),
    ]);
    getActionEcheances.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW, {
      urgency: ["critical"],
    });
    expect(out.total).toBe(1);
    expect(out.groups.late[0].id).toBe("v1");
    expect(out.kpis.critical).toBe(1);
  });

  it("filtre urgency mixte 'critical' + 'today' → union", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({ id: "v1", urgency: "late", isCritical: true }),
      mkItem({ id: "v2", urgency: "today", isCritical: false }),
      mkItem({ id: "v3", urgency: "later", isCritical: false }),
    ]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW, {
      urgency: ["critical", "today"],
    });
    expect(out.total).toBe(2);
    expect(out.groups.late.map((i) => i.id)).toEqual(["v1"]);
    expect(out.groups.today.map((i) => i.id)).toEqual(["v2"]);
  });
});

describe("aggregateEcheances — dédup défensive", () => {
  it("items avec même id n'apparaissent qu'une fois", async () => {
    // Cas pathologique : une action remontée via 2 chemins.
    const dup = mkItem({ id: "dup", urgency: "late" });
    getVisitEcheances.mockResolvedValue([dup]);
    getEquipmentEcheances.mockResolvedValue([dup]);
    getActionEcheances.mockResolvedValue([dup]);
    findManyTeam.mockResolvedValue([]);
    const out = await aggregateEcheances(EDITOR, NOW);
    expect(out.total).toBe(1);
  });
});

describe("getCriticalEcheancesCount", () => {
  it("compte uniquement les items critiques sur les 3 sources", async () => {
    getVisitEcheances.mockResolvedValue([
      mkItem({ id: "v1", isCritical: true }),
      mkItem({ id: "v2", isCritical: false }),
    ]);
    getEquipmentEcheances.mockResolvedValue([
      mkItem({ id: "e1", isCritical: true }),
    ]);
    getActionEcheances.mockResolvedValue([
      mkItem({ id: "a1", isCritical: false }),
    ]);
    const n = await getCriticalEcheancesCount(EDITOR, NOW);
    expect(n).toBe(2);
  });

  it("0 si aucun item critique", async () => {
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    const n = await getCriticalEcheancesCount(EDITOR, NOW);
    expect(n).toBe(0);
  });

  it("ne fetch pas les équipes", async () => {
    getVisitEcheances.mockResolvedValue([]);
    getEquipmentEcheances.mockResolvedValue([]);
    getActionEcheances.mockResolvedValue([]);
    await getCriticalEcheancesCount(EDITOR, NOW);
    expect(findManyTeam).not.toHaveBeenCalled();
  });
});

// ─── Lint use of helper to avoid unused imports ─────────────────────────────
void into;
