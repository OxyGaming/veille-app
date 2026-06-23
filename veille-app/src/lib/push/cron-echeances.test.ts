import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyUser = vi.fn();
const getCriticalEcheancesItems = vi.fn();
const notifyEcheancesCriticalForUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => findManyUser(...a) },
  },
}));

vi.mock("@/lib/echeances/aggregator", () => ({
  getCriticalEcheancesItems: (...a: unknown[]) =>
    getCriticalEcheancesItems(...a),
}));

vi.mock("@/lib/notifications-generators", () => ({
  notifyEcheancesCriticalForUser: (...a: unknown[]) =>
    notifyEcheancesCriticalForUser(...a),
}));

import { runEcheancesPushCron } from "./cron-echeances";

const NOW = new Date("2026-06-23T06:00:00Z");

beforeEach(() => {
  findManyUser.mockReset();
  getCriticalEcheancesItems.mockReset();
  notifyEcheancesCriticalForUser.mockReset();
});

function userRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "u1",
    email: "u1@x.fr",
    name: "U1",
    role: "EDITOR",
    teamId: "t1",
    viewAllTeams: false,
    adminScopeMode: null,
    adminTeamId: null,
    memberships: [{ teamId: "t1" }],
    ...over,
  };
}

describe("runEcheancesPushCron — ciblage", () => {
  it("filtre EDITOR + ADMIN actifs (where Prisma)", async () => {
    findManyUser.mockResolvedValue([]);
    await runEcheancesPushCron(NOW);
    const where = findManyUser.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.role).toEqual({ in: ["EDITOR", "ADMIN"] });
    // USER non inclus → garantit l'exclusion V1.
    expect(where.role.in).not.toContain("USER");
  });

  it("aucun user → rapport vide en 1 query", async () => {
    findManyUser.mockResolvedValue([]);
    const r = await runEcheancesPushCron(NOW);
    expect(r.usersScanned).toBe(0);
    expect(r.usersWithCriticalItems).toBe(0);
    expect(r.notificationsAttempted).toBe(0);
    expect(r.notificationsCreated).toBe(0);
    expect(r.notificationsDeduped).toBe(0);
    expect(r.errors).toBe(0);
    expect(r.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(getCriticalEcheancesItems).not.toHaveBeenCalled();
  });

  it("user sans items critiques → skip propre, pas de notifyCall", async () => {
    findManyUser.mockResolvedValue([userRow()]);
    getCriticalEcheancesItems.mockResolvedValue([]);
    const r = await runEcheancesPushCron(NOW);
    expect(r.usersScanned).toBe(1);
    expect(r.usersWithCriticalItems).toBe(0);
    expect(notifyEcheancesCriticalForUser).not.toHaveBeenCalled();
  });
});

describe("runEcheancesPushCron — SessionUser construit correctement", () => {
  it("recompose teamIds depuis memberships", async () => {
    findManyUser.mockResolvedValue([
      userRow({ memberships: [{ teamId: "tA" }, { teamId: "tB" }] }),
    ]);
    getCriticalEcheancesItems.mockResolvedValue([]);
    await runEcheancesPushCron(NOW);
    const passedUser = getCriticalEcheancesItems.mock.calls[0][0];
    expect(passedUser.teamIds).toEqual(["tA", "tB"]);
    expect(passedUser.id).toBe("u1");
    expect(passedUser.role).toBe("EDITOR");
  });

  it("fallback teamId si memberships vide (legacy)", async () => {
    findManyUser.mockResolvedValue([
      userRow({ memberships: [], teamId: "tLegacy" }),
    ]);
    getCriticalEcheancesItems.mockResolvedValue([]);
    await runEcheancesPushCron(NOW);
    const passedUser = getCriticalEcheancesItems.mock.calls[0][0];
    expect(passedUser.teamIds).toEqual(["tLegacy"]);
  });

  it("propage adminScopeMode + adminTeamId pour ADMIN", async () => {
    findManyUser.mockResolvedValue([
      userRow({
        role: "ADMIN",
        adminScopeMode: "TEAM",
        adminTeamId: "tCible",
      }),
    ]);
    getCriticalEcheancesItems.mockResolvedValue([]);
    await runEcheancesPushCron(NOW);
    const passedUser = getCriticalEcheancesItems.mock.calls[0][0];
    expect(passedUser.adminScopeMode).toBe("TEAM");
    expect(passedUser.adminTeamId).toBe("tCible");
  });
});

describe("runEcheancesPushCron — compteurs", () => {
  function mkItem(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: "VISIT_QUARTERLY:s1",
      kind: "VISIT_QUARTERLY",
      isCritical: true,
      title: "Site Alpha",
      subtitle: "trimestrielle",
      cta: { label: "Ouvrir", href: "/sites/s1" },
      daysToDue: -12,
      context: { siteId: "s1", agentId: null },
      ...over,
    };
  }

  it("happy path — 3 items créés", async () => {
    findManyUser.mockResolvedValue([userRow()]);
    getCriticalEcheancesItems.mockResolvedValue([
      mkItem({ id: "x:1" }),
      mkItem({ id: "x:2" }),
      mkItem({ id: "x:3" }),
    ]);
    notifyEcheancesCriticalForUser.mockResolvedValue(3);
    const r = await runEcheancesPushCron(NOW);
    expect(r.usersScanned).toBe(1);
    expect(r.usersWithCriticalItems).toBe(1);
    expect(r.notificationsAttempted).toBe(3);
    expect(r.notificationsCreated).toBe(3);
    expect(r.notificationsDeduped).toBe(0);
    expect(notifyEcheancesCriticalForUser).toHaveBeenCalledWith(
      "u1",
      expect.any(Array),
    );
  });

  it("doublons dédupliqués — attempted=3, created=1 → deduped=2", async () => {
    findManyUser.mockResolvedValue([userRow()]);
    getCriticalEcheancesItems.mockResolvedValue([
      mkItem({ id: "x:1" }),
      mkItem({ id: "x:2" }),
      mkItem({ id: "x:3" }),
    ]);
    notifyEcheancesCriticalForUser.mockResolvedValue(1);
    const r = await runEcheancesPushCron(NOW);
    expect(r.notificationsAttempted).toBe(3);
    expect(r.notificationsCreated).toBe(1);
    expect(r.notificationsDeduped).toBe(2);
  });

  it("doublon complet — attempted=2, created=0 (P2002 silencieux)", async () => {
    findManyUser.mockResolvedValue([userRow()]);
    getCriticalEcheancesItems.mockResolvedValue([mkItem(), mkItem()]);
    notifyEcheancesCriticalForUser.mockResolvedValue(0);
    const r = await runEcheancesPushCron(NOW);
    expect(r.notificationsAttempted).toBe(2);
    expect(r.notificationsCreated).toBe(0);
    expect(r.notificationsDeduped).toBe(2);
  });

  it("plusieurs users — agrège les compteurs", async () => {
    findManyUser.mockResolvedValue([
      userRow({ id: "u1" }),
      userRow({ id: "u2", role: "ADMIN" }),
      userRow({ id: "u3" }),
    ]);
    getCriticalEcheancesItems
      .mockResolvedValueOnce([mkItem(), mkItem()])
      .mockResolvedValueOnce([mkItem()])
      .mockResolvedValueOnce([]);
    notifyEcheancesCriticalForUser
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    const r = await runEcheancesPushCron(NOW);
    expect(r.usersScanned).toBe(3);
    expect(r.usersWithCriticalItems).toBe(2);
    expect(r.notificationsAttempted).toBe(3);
    expect(r.notificationsCreated).toBe(2);
    expect(r.notificationsDeduped).toBe(1);
  });
});

describe("runEcheancesPushCron — robustesse", () => {
  function mkItem() {
    return {
      id: "x:1",
      kind: "VISIT_QUARTERLY",
      isCritical: true,
      title: "X",
      subtitle: null,
      cta: { label: "O", href: "/x" },
      daysToDue: -1,
      context: {},
    };
  }

  it("erreur sur 1 user → errors++, les autres continuent", async () => {
    findManyUser.mockResolvedValue([
      userRow({ id: "u1" }),
      userRow({ id: "u2" }),
      userRow({ id: "u3" }),
    ]);
    getCriticalEcheancesItems
      .mockResolvedValueOnce([mkItem()])
      .mockRejectedValueOnce(new Error("DB hiccup on u2"))
      .mockResolvedValueOnce([mkItem()]);
    notifyEcheancesCriticalForUser.mockResolvedValue(1);
    const r = await runEcheancesPushCron(NOW);
    expect(r.usersScanned).toBe(3);
    expect(r.errors).toBe(1);
    // u1 et u3 ont été traités malgré l'échec de u2
    expect(r.usersWithCriticalItems).toBe(2);
    expect(r.notificationsCreated).toBe(2);
  });

  it("erreur notifyEcheances → comptée dans errors, pas de propagation", async () => {
    findManyUser.mockResolvedValue([
      userRow({ id: "u1" }),
      userRow({ id: "u2" }),
    ]);
    getCriticalEcheancesItems.mockResolvedValue([mkItem()]);
    notifyEcheancesCriticalForUser
      .mockRejectedValueOnce(new Error("notify crash"))
      .mockResolvedValueOnce(1);
    const r = await runEcheancesPushCron(NOW);
    expect(r.errors).toBe(1);
    expect(r.notificationsCreated).toBe(1);
  });

  it("findMany crash → propage le throw (route handler gère le 500)", async () => {
    findManyUser.mockRejectedValue(new Error("DB total down"));
    await expect(runEcheancesPushCron(NOW)).rejects.toThrow("DB total down");
  });
});
