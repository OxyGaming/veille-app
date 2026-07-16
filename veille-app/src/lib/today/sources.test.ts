import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

const findManyVeilleSession = vi.fn();
const findManySiteVisit = vi.fn();
const findManyActionValidation = vi.fn();
const findManyAgentSighting = vi.fn();
const findManyTeamActivity = vi.fn();
const findManyAuditLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    veilleSession: { findMany: (...a: unknown[]) => findManyVeilleSession(...a) },
    siteVisit: { findMany: (...a: unknown[]) => findManySiteVisit(...a) },
    actionValidation: {
      findMany: (...a: unknown[]) => findManyActionValidation(...a),
    },
    agentSighting: {
      findMany: (...a: unknown[]) => findManyAgentSighting(...a),
    },
    teamActivity: { findMany: (...a: unknown[]) => findManyTeamActivity(...a) },
    auditLog: { findMany: (...a: unknown[]) => findManyAuditLog(...a) },
  },
}));

import {
  getAdminRecentActivity,
  getRecentActivityForUser,
  getTeamActivity,
} from "./sources";

beforeEach(() => {
  for (const fn of [
    findManyVeilleSession,
    findManySiteVisit,
    findManyActionValidation,
    findManyAgentSighting,
    findManyTeamActivity,
    findManyAuditLog,
  ]) {
    fn.mockReset();
    fn.mockResolvedValue([]);
  }
});

const USER: SessionUser = {
  id: "u1",
  email: "u@x",
  name: "User",
  role: "USER",
  teamId: "tA",
  teamIds: ["tA"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const NOW = new Date("2026-06-09T14:00:00Z");
const DAY_WINDOW = {
  start: new Date("2026-06-05T00:00:00Z"),
  end: new Date("2026-06-06T00:00:00Z"),
};

describe("getRecentActivityForUser — bornage par jour consulté", () => {
  it("filtre chaque source sur [dayWindow.start, dayWindow.end)", async () => {
    await getRecentActivityForUser(USER, NOW, DAY_WINDOW);

    for (const spy of [
      findManyVeilleSession,
      findManySiteVisit,
      findManyActionValidation,
      findManyAgentSighting,
    ]) {
      const args = spy.mock.calls[0][0];
      const dateField = args.where.finishedAt ?? args.where.createdAt;
      expect(dateField).toEqual({ gte: DAY_WINDOW.start, lt: DAY_WINDOW.end });
    }
  });

  it("reste scopé sur l'utilisateur courant (observerId / validatedById)", async () => {
    await getRecentActivityForUser(USER, NOW, DAY_WINDOW);
    expect(findManyVeilleSession.mock.calls[0][0].where.observerId).toBe("u1");
    expect(findManyActionValidation.mock.calls[0][0].where.validatedById).toBe(
      "u1",
    );
  });

  it("un jour sans aucune activité renvoie un tableau vide (pas de fallback sur une autre date)", async () => {
    const items = await getRecentActivityForUser(USER, NOW, DAY_WINDOW);
    expect(items).toEqual([]);
  });
});

describe("getTeamActivity — bornage par jour consulté", () => {
  it("filtre teamId IN + plage de dates", async () => {
    await getTeamActivity(USER, DAY_WINDOW, 8);
    const args = findManyTeamActivity.mock.calls[0][0];
    expect(args.where.teamId).toEqual({ in: ["tA"] });
    expect(args.where.createdAt).toEqual({
      gte: DAY_WINDOW.start,
      lt: DAY_WINDOW.end,
    });
  });

  it("ne lance aucune requête si l'utilisateur n'a aucune équipe", async () => {
    const noTeam: SessionUser = { ...USER, teamIds: [] };
    const items = await getTeamActivity(noTeam, DAY_WINDOW, 8);
    expect(items).toEqual([]);
    expect(findManyTeamActivity).not.toHaveBeenCalled();
  });
});

describe("getAdminRecentActivity — bornage par jour consulté", () => {
  it("filtre AuditLog sur la plage du jour consulté", async () => {
    await getAdminRecentActivity(NOW, DAY_WINDOW, 20);
    const args = findManyAuditLog.mock.calls[0][0];
    expect(args.where.createdAt).toEqual({
      gte: DAY_WINDOW.start,
      lt: DAY_WINDOW.end,
    });
  });
});
