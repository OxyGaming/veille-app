import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

// ─── Mocks Prisma ────────────────────────────────────────────────────────────

const findManyShift = vi.fn();
const countImports = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    planningShift: { findMany: (...a: unknown[]) => findManyShift(...a) },
    planningImport: { count: (...a: unknown[]) => countImports(...a) },
  },
}));

import {
  formatPlanningHint,
  getAgentsOnDutyToday,
  getAgentsPlanningHints,
  getDutyStatus,
  isOvernightShift,
} from "./planning";

beforeEach(() => {
  findManyShift.mockReset();
  countImports.mockReset();
  findManyShift.mockResolvedValue([]);
  countImports.mockResolvedValue(0);
});

// ─── Fixtures utilisateur ────────────────────────────────────────────────────

const EDITOR: SessionUser = {
  id: "u-editor",
  email: "e@x",
  name: "Editor",
  role: "EDITOR",
  teamId: "tA",
  teamIds: ["tA", "tB"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const ADMIN_GLOBAL: SessionUser = {
  ...EDITOR,
  id: "u-admin",
  role: "ADMIN",
  teamIds: [],
};

const NOW = new Date("2026-06-09T14:00:00"); // 14:00 heure locale

function shift(
  overrides: Partial<{
    id: string;
    agentId: string;
    startsAt: Date;
    endsAt: Date;
    jsNumber: string | null;
    jsCode: string | null;
    firstName: string;
    lastName: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "s1",
    agentId: overrides.agentId ?? "a1",
    startsAt: overrides.startsAt ?? new Date("2026-06-09T13:00:00"),
    endsAt: overrides.endsAt ?? new Date("2026-06-09T18:00:00"),
    jsNumber: overrides.jsNumber ?? "20412",
    jsCode: overrides.jsCode ?? "VMCAS",
    agent: {
      firstName: overrides.firstName ?? "Romain",
      lastName: overrides.lastName ?? "Di Michele",
    },
  };
}

// ─── getDutyStatus ───────────────────────────────────────────────────────────

describe("getDutyStatus", () => {
  it("IN_SERVICE quand now est entre startsAt et endsAt", () => {
    expect(
      getDutyStatus(
        new Date("2026-06-09T10:00:00"),
        new Date("2026-06-09T18:00:00"),
        NOW,
      ),
    ).toBe("IN_SERVICE");
  });

  it("LATER quand startsAt est dans le futur", () => {
    expect(
      getDutyStatus(
        new Date("2026-06-09T20:00:00"),
        new Date("2026-06-10T04:00:00"),
        NOW,
      ),
    ).toBe("LATER");
  });

  it("FINISHED quand endsAt est dans le passé", () => {
    expect(
      getDutyStatus(
        new Date("2026-06-09T06:00:00"),
        new Date("2026-06-09T12:00:00"),
        NOW,
      ),
    ).toBe("FINISHED");
  });

  it("IN_SERVICE à la limite startsAt = now", () => {
    expect(
      getDutyStatus(NOW, new Date(NOW.getTime() + 3_600_000), NOW),
    ).toBe("IN_SERVICE");
  });

  it("IN_SERVICE à la limite endsAt = now", () => {
    expect(
      getDutyStatus(new Date(NOW.getTime() - 3_600_000), NOW, NOW),
    ).toBe("IN_SERVICE");
  });
});

// ─── isOvernightShift ────────────────────────────────────────────────────────

describe("isOvernightShift", () => {
  it("false quand startsAt et endsAt sont le même jour", () => {
    expect(
      isOvernightShift(
        new Date("2026-06-09T08:00:00"),
        new Date("2026-06-09T20:00:00"),
      ),
    ).toBe(false);
  });

  it("true quand endsAt est sur J+1", () => {
    expect(
      isOvernightShift(
        new Date("2026-06-09T20:40:00"),
        new Date("2026-06-10T05:00:00"),
      ),
    ).toBe(true);
  });

  it("true quand endsAt traverse un changement de mois", () => {
    expect(
      isOvernightShift(
        new Date("2026-06-30T22:00:00"),
        new Date("2026-07-01T04:00:00"),
      ),
    ).toBe(true);
  });
});

// ─── getAgentsOnDutyToday — requête ──────────────────────────────────────────

describe("getAgentsOnDutyToday — construction de la requête", () => {
  it("filtre en SQL sur la fenêtre journée + scope agent (EDITOR)", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(1);

    await getAgentsOnDutyToday(EDITOR, NOW);

    expect(findManyShift).toHaveBeenCalledOnce();
    const args = findManyShift.mock.calls[0][0];
    // Fenêtre : startsAt < J+1 (00:00 du lendemain) ; endsAt > J (00:00).
    expect(args.where.startsAt.lt).toEqual(new Date("2026-06-10T00:00:00"));
    expect(args.where.endsAt.gt).toEqual(new Date("2026-06-09T00:00:00"));
    // Scope EDITOR : memberships some teamId in user.teamIds (cf. agentScope).
    expect(args.where.agent).toMatchObject({
      isVisible: true,
      memberships: { some: { teamId: { in: ["tA", "tB"] } } },
    });
    // select minimal : pas d'include large.
    expect(args.select.agent.select).toEqual({
      firstName: true,
      lastName: true,
    });
  });

  it("scope ADMIN GLOBAL : pas de restriction sur memberships", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(1);

    await getAgentsOnDutyToday(ADMIN_GLOBAL, NOW);

    const args = findManyShift.mock.calls[0][0];
    // agentScope(ADMIN sans scope restreint) → {}, donc pas de filtre
    // memberships, juste isVisible.
    expect(args.where.agent).toEqual({ isVisible: true });
  });

  it("renvoie hasPlanningImport=false quand aucun import en base", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(0);

    const res = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(res.hasPlanningImport).toBe(false);
    expect(res.items).toEqual([]);
  });

  it("renvoie hasPlanningImport=true même si la liste est vide", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(1);

    const res = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(res.hasPlanningImport).toBe(true);
    expect(res.items).toEqual([]);
  });
});

// ─── getAgentsOnDutyToday — transformation / tri / dédup ────────────────────

describe("getAgentsOnDutyToday — items renvoyés", () => {
  it("calcule statut, isOvernight et préserve jsNumber/jsCode", async () => {
    findManyShift.mockResolvedValue([
      shift({
        id: "s-overnight",
        agentId: "a-nuit",
        startsAt: new Date("2026-06-08T20:40:00"),
        endsAt: new Date("2026-06-09T05:00:00"),
        jsNumber: "20398",
        jsCode: "LGV/",
        firstName: "Anna",
        lastName: "Nuit",
      }),
    ]);
    countImports.mockResolvedValue(1);

    const { items } = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      shiftId: "s-overnight",
      agentId: "a-nuit",
      agentName: "Anna Nuit",
      jsNumber: "20398",
      jsCode: "LGV/",
      isOvernight: true,
      // 05:00 < 14:00 NOW → FINISHED
      status: "FINISHED",
    });
  });

  it("trie IN_SERVICE → LATER → FINISHED, puis startsAt asc", async () => {
    findManyShift.mockResolvedValue([
      // Plus tard ce soir
      shift({
        id: "s-late",
        agentId: "a3",
        startsAt: new Date("2026-06-09T20:00:00"),
        endsAt: new Date("2026-06-10T04:00:00"),
        firstName: "C",
        lastName: "Soir",
      }),
      // En service
      shift({
        id: "s-now",
        agentId: "a1",
        startsAt: new Date("2026-06-09T10:00:00"),
        endsAt: new Date("2026-06-09T18:00:00"),
        firstName: "A",
        lastName: "Service",
      }),
      // Terminé tôt
      shift({
        id: "s-done",
        agentId: "a2",
        startsAt: new Date("2026-06-09T05:00:00"),
        endsAt: new Date("2026-06-09T09:00:00"),
        firstName: "B",
        lastName: "Tôt",
      }),
    ]);
    countImports.mockResolvedValue(1);

    const { items } = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(items.map((i) => i.shiftId)).toEqual(["s-now", "s-late", "s-done"]);
    expect(items.map((i) => i.status)).toEqual([
      "IN_SERVICE",
      "LATER",
      "FINISHED",
    ]);
  });

  it("déduplique par agent : garde le statut prioritaire", async () => {
    // Un même agent a 2 shifts qui chevauchent aujourd'hui :
    //  - fin d'un service de nuit (FINISHED ce matin)
    //  - début d'un autre service plus tard
    findManyShift.mockResolvedValue([
      shift({
        id: "s-overnight-finished",
        agentId: "a-same",
        startsAt: new Date("2026-06-08T20:00:00"),
        endsAt: new Date("2026-06-09T04:00:00"),
        firstName: "Double",
        lastName: "Jour",
      }),
      shift({
        id: "s-current",
        agentId: "a-same",
        startsAt: new Date("2026-06-09T12:00:00"),
        endsAt: new Date("2026-06-09T20:00:00"),
        firstName: "Double",
        lastName: "Jour",
      }),
    ]);
    countImports.mockResolvedValue(1);

    const { items } = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].shiftId).toBe("s-current");
    expect(items[0].status).toBe("IN_SERVICE");
  });

  it("dédup : à statut égal, garde le startsAt le plus tôt", async () => {
    findManyShift.mockResolvedValue([
      shift({
        id: "s-later",
        agentId: "a-twice",
        startsAt: new Date("2026-06-09T22:00:00"),
        endsAt: new Date("2026-06-09T23:30:00"),
        firstName: "Double",
        lastName: "Soir",
      }),
      shift({
        id: "s-earlier",
        agentId: "a-twice",
        startsAt: new Date("2026-06-09T20:00:00"),
        endsAt: new Date("2026-06-09T21:00:00"),
        firstName: "Double",
        lastName: "Soir",
      }),
    ]);
    countImports.mockResolvedValue(1);

    const { items } = await getAgentsOnDutyToday(EDITOR, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].shiftId).toBe("s-earlier");
  });
});

// ─── formatPlanningHint (helper pur) ─────────────────────────────────────────

describe("formatPlanningHint", () => {
  it("retourne le label IN_SERVICE avec horaire + JS", () => {
    expect(
      formatPlanningHint(
        {
          startsAt: new Date("2026-06-09T06:00:00"),
          endsAt: new Date("2026-06-09T14:00:00"),
          jsNumber: "20412",
        },
        NOW,
      ),
    ).toBe("En service aujourd'hui · 06:00 → 14:00 · JS 20412");
  });

  it("retourne le label LATER", () => {
    expect(
      formatPlanningHint(
        {
          startsAt: new Date("2026-06-09T20:00:00"),
          endsAt: new Date("2026-06-09T23:00:00"),
          jsNumber: "18754",
        },
        NOW,
      ),
    ).toBe("Prévu plus tard · 20:00 → 23:00 · JS 18754");
  });

  it("retourne le label FINISHED", () => {
    expect(
      formatPlanningHint(
        {
          startsAt: new Date("2026-06-09T05:00:00"),
          endsAt: new Date("2026-06-09T09:00:00"),
          jsNumber: "16587",
        },
        NOW,
      ),
    ).toBe("Service terminé · 05:00 → 09:00 · JS 16587");
  });

  it("ajoute (+1) pour un service de nuit", () => {
    expect(
      formatPlanningHint(
        {
          startsAt: new Date("2026-06-09T20:40:00"),
          endsAt: new Date("2026-06-10T05:00:00"),
          jsNumber: "20412",
        },
        NOW,
      ),
    ).toBe("Prévu plus tard · 20:40 → 05:00 (+1) · JS 20412");
  });

  it("omet la mention JS si jsNumber est null", () => {
    expect(
      formatPlanningHint(
        {
          startsAt: new Date("2026-06-09T06:00:00"),
          endsAt: new Date("2026-06-09T14:00:00"),
          jsNumber: null,
        },
        NOW,
      ),
    ).toBe("En service aujourd'hui · 06:00 → 14:00");
  });

  it("retourne le label vide quand pas de shift", () => {
    expect(formatPlanningHint(null, NOW)).toBe(
      "Non prévu en service aujourd'hui",
    );
  });
});

// ─── getAgentsPlanningHints (orchestrateur) ──────────────────────────────────

describe("getAgentsPlanningHints", () => {
  it("ne lance aucune requête si agentIds est vide", async () => {
    const map = await getAgentsPlanningHints([], NOW);
    expect(map.size).toBe(0);
    expect(findManyShift).not.toHaveBeenCalled();
    expect(countImports).not.toHaveBeenCalled();
  });

  it("renvoie une Map vide si aucun PlanningImport en base", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(0);
    const map = await getAgentsPlanningHints(["a1", "a2"], NOW);
    expect(map.size).toBe(0);
  });

  it("filtre SQL sur la fenêtre journée + agentIds", async () => {
    findManyShift.mockResolvedValue([]);
    countImports.mockResolvedValue(1);
    await getAgentsPlanningHints(["a1", "a2"], NOW);
    const args = findManyShift.mock.calls[0][0];
    expect(args.where.agentId.in).toEqual(["a1", "a2"]);
    expect(args.where.startsAt.lt).toEqual(new Date("2026-06-10T00:00:00"));
    expect(args.where.endsAt.gt).toEqual(new Date("2026-06-09T00:00:00"));
    // Select minimal — agentScope NON appliqué (déjà fait par le caller).
    expect(args.where).not.toHaveProperty("agent");
    expect(args.select).toEqual({
      agentId: true,
      startsAt: true,
      endsAt: true,
      jsNumber: true,
    });
  });

  it("renvoie 'Non prévu...' pour les agents sans shift mais planning importé", async () => {
    findManyShift.mockResolvedValue([
      {
        agentId: "a-service",
        startsAt: new Date("2026-06-09T10:00:00"),
        endsAt: new Date("2026-06-09T18:00:00"),
        jsNumber: "20412",
      },
    ]);
    countImports.mockResolvedValue(1);

    const map = await getAgentsPlanningHints(
      ["a-service", "a-rien", "a-zero"],
      NOW,
    );
    expect(map.get("a-service")).toBe(
      "En service aujourd'hui · 10:00 → 18:00 · JS 20412",
    );
    expect(map.get("a-rien")).toBe("Non prévu en service aujourd'hui");
    expect(map.get("a-zero")).toBe("Non prévu en service aujourd'hui");
  });

  it("dédup : un agent avec 2 shifts du jour garde le statut prioritaire", async () => {
    findManyShift.mockResolvedValue([
      {
        agentId: "a-twice",
        startsAt: new Date("2026-06-09T05:00:00"),
        endsAt: new Date("2026-06-09T09:00:00"),
        jsNumber: "old",
      },
      {
        agentId: "a-twice",
        startsAt: new Date("2026-06-09T12:00:00"),
        endsAt: new Date("2026-06-09T20:00:00"),
        jsNumber: "now",
      },
    ]);
    countImports.mockResolvedValue(1);
    const map = await getAgentsPlanningHints(["a-twice"], NOW);
    expect(map.get("a-twice")).toBe(
      "En service aujourd'hui · 12:00 → 20:00 · JS now",
    );
  });
});
