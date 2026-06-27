import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyAction = vi.fn();
const findManyObs = vi.fn();
const findManyProcedureObs = vi.fn();
const findUniqueSession = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importedAction: {
      findMany: (...a: unknown[]) => findManyAction(...a),
    },
    observationItem: {
      findMany: (...a: unknown[]) => findManyObs(...a),
    },
    procedureObservation: {
      findMany: (...a: unknown[]) => findManyProcedureObs(...a),
    },
    veilleSession: {
      findUnique: (...a: unknown[]) => findUniqueSession(...a),
    },
  },
}));

import {
  findAutoValidableActions,
  findAutoValidableActionsForSession,
  getObservedKeyPointsForSession,
  matchActionsByKeyPoint,
} from "./auto-validate";

beforeEach(() => {
  findManyAction.mockReset();
  findManyObs.mockReset();
  findManyProcedureObs.mockReset();
  findUniqueSession.mockReset();
  // Par défaut : aucun titre de procédure — les tests qui veulent vérifier
  // ce cas le surchargent explicitement.
  findManyProcedureObs.mockResolvedValue([]);
});

// ─── matchActionsByKeyPoint — logique pure ────────────────────────────────

describe("matchActionsByKeyPoint — règle startsWith stricte", () => {
  it("matche les 3 cas conformes à la spec", () => {
    const actions = [
      { id: "a1", keyPoint: "Circuits de voie peu empruntés" },
      { id: "a2", keyPoint: "Circuits de voie peu empruntés - Itinéraires" },
      { id: "a3", keyPoint: "Circuits de voie peu empruntés - Déshuntage" },
    ];
    const result = matchActionsByKeyPoint(actions, [
      "Circuits de voie peu empruntés",
    ]);
    expect(result.map((r) => r.action.id).sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("ne matche pas les 3 cas non-conformes à la spec", () => {
    const actions = [
      { id: "b1", keyPoint: "Circuit de voie peu emprunté" }, // singulier
      { id: "b2", keyPoint: "Circuits de voie" }, // tronqué
      { id: "b3", keyPoint: "Circuits peu empruntés" }, // mot retiré
    ];
    const result = matchActionsByKeyPoint(actions, [
      "Circuits de voie peu empruntés",
    ]);
    expect(result).toEqual([]);
  });

  it("strict sur la casse (pas de lowercase)", () => {
    const actions = [
      { id: "a1", keyPoint: "circuits de voie peu empruntés" },
    ];
    expect(
      matchActionsByKeyPoint(actions, ["Circuits de voie peu empruntés"]),
    ).toEqual([]);
  });

  it("strict sur les accents (pas de normalisation)", () => {
    const actions = [{ id: "a1", keyPoint: "Circuits de voie peu empruntes" }];
    expect(
      matchActionsByKeyPoint(actions, ["Circuits de voie peu empruntés"]),
    ).toEqual([]);
  });

  it("trim les points clés observés mais pas la comparaison interne", () => {
    const actions = [{ id: "a1", keyPoint: "Foo bar baz" }];
    const result = matchActionsByKeyPoint(actions, ["  Foo bar  "]);
    // « Foo bar » (trim) — pas matché : "Foo bar baz".startsWith("Foo bar") → true
    expect(result.map((r) => r.action.id)).toEqual(["a1"]);
    expect(result[0].matchedBy).toBe("Foo bar");
  });

  it("dédup : une action n'apparaît qu'une fois même si plusieurs points matchent", () => {
    const actions = [{ id: "a1", keyPoint: "Foo bar baz qux" }];
    const result = matchActionsByKeyPoint(actions, ["Foo", "Foo bar", "Foo bar baz"]);
    expect(result.map((r) => r.action.id)).toEqual(["a1"]);
    // Premier point matchant retenu
    expect(result[0].matchedBy).toBe("Foo");
  });

  it("dédup des points clés observés en entrée (Set)", () => {
    const actions = [{ id: "a1", keyPoint: "Foo bar" }];
    const result = matchActionsByKeyPoint(actions, ["Foo", "Foo", "Foo"]);
    expect(result.map((r) => r.action.id)).toEqual(["a1"]);
  });

  it("ignore les actions sans keyPoint", () => {
    const actions = [
      { id: "a1", keyPoint: null },
      { id: "a2", keyPoint: "" },
      { id: "a3", keyPoint: "Foo bar" },
    ];
    const result = matchActionsByKeyPoint(actions, ["Foo"]);
    expect(result.map((r) => r.action.id)).toEqual(["a3"]);
  });

  it("ignore les points clés vides ou non-string", () => {
    const actions = [{ id: "a1", keyPoint: "Foo bar" }];
    expect(
      matchActionsByKeyPoint(actions, ["", "   ", null as unknown as string]),
    ).toEqual([]);
  });

  it("retourne [] si liste vide en entrée", () => {
    expect(matchActionsByKeyPoint([], ["Foo"])).toEqual([]);
    expect(matchActionsByKeyPoint([{ id: "a1", keyPoint: "x" }], [])).toEqual(
      [],
    );
  });
});

// ─── findAutoValidableActions — wrapper Prisma ────────────────────────────

describe("findAutoValidableActions", () => {
  it("court-circuit si agentId nul/vide", async () => {
    await expect(findAutoValidableActions(null, ["x"])).resolves.toEqual([]);
    await expect(findAutoValidableActions("", ["x"])).resolves.toEqual([]);
    expect(findManyAction).not.toHaveBeenCalled();
  });

  it("court-circuit si pas de points clés observés", async () => {
    await expect(findAutoValidableActions("ag1", [])).resolves.toEqual([]);
    expect(findManyAction).not.toHaveBeenCalled();
  });

  it("ne charge QUE les actions de l'agent au statut ACTIVE", async () => {
    findManyAction.mockResolvedValue([]);
    await findAutoValidableActions("ag1", ["Foo"]);
    expect(findManyAction).toHaveBeenCalledTimes(1);
    expect(findManyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: "ag1", localStatus: "ACTIVE" },
      }),
    );
  });

  it("cloisonne par teamId quand fourni (candidats de l'équipe de la veille)", async () => {
    findManyAction.mockResolvedValue([]);
    await findAutoValidableActions("ag1", ["Foo"], "team-A");
    expect(findManyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: "ag1", localStatus: "ACTIVE", teamId: "team-A" },
      }),
    );
  });

  it("mappe le résultat Prisma avec matchedBy + dates non nulles", async () => {
    findManyAction.mockResolvedValue([
      {
        id: "a1",
        externalId: "ext-1",
        keyPoint: "Foo bar - extension",
        comment: "blabla",
        dueAt: new Date("2026-12-31T00:00:00Z"),
      },
      {
        id: "a2",
        externalId: "ext-2",
        keyPoint: "Bar baz",
        comment: null,
        dueAt: null,
      },
    ]);
    const r = await findAutoValidableActions("ag1", ["Foo bar"]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: "a1",
      externalId: "ext-1",
      keyPoint: "Foo bar - extension",
      comment: "blabla",
      matchedBy: "Foo bar",
    });
    expect(r[0].dueAt).toBeInstanceOf(Date);
  });
});

// ─── getObservedKeyPointsForSession ───────────────────────────────────────

describe("getObservedKeyPointsForSession", () => {
  it("retourne [] si sessionId vide", async () => {
    await expect(getObservedKeyPointsForSession("")).resolves.toEqual([]);
    expect(findManyObs).not.toHaveBeenCalled();
    expect(findManyProcedureObs).not.toHaveBeenCalled();
  });

  it("dédup + trim des libellés observés", async () => {
    findManyObs.mockResolvedValue([
      { checklistItem: { label: " Circuits de voie peu empruntés " } },
      { checklistItem: { label: "Circuits de voie peu empruntés" } },
      { checklistItem: { label: "Annonces" } },
      { checklistItem: { label: "" } },
      { checklistItem: { label: null } },
    ]);
    const r = await getObservedKeyPointsForSession("s1");
    expect(r.sort()).toEqual([
      "Annonces",
      "Circuits de voie peu empruntés",
    ]);
  });

  it("inclut le titre de procédure observée (cas keyPoint=titre)", async () => {
    findManyProcedureObs.mockResolvedValue([
      { procedure: { title: "Circulations de catégorie A, B, C" } },
      { procedure: { title: " Circulations de catégorie A, B, C " } },
      { procedure: { title: "" } },
      { procedure: { title: null } },
    ]);
    findManyObs.mockResolvedValue([]);
    const r = await getObservedKeyPointsForSession("s1");
    expect(r).toEqual(["Circulations de catégorie A, B, C"]);
  });

  it("fusionne titres de procédure + libellés d'items, dédupliqués", async () => {
    findManyProcedureObs.mockResolvedValue([
      { procedure: { title: "Circulations de catégorie A, B, C" } },
    ]);
    findManyObs.mockResolvedValue([
      { checklistItem: { label: "Signaux fixes" } },
      // Même chaîne que le titre — doit être collapsée par le Set.
      { checklistItem: { label: "Circulations de catégorie A, B, C" } },
    ]);
    const r = await getObservedKeyPointsForSession("s1");
    expect(r.sort()).toEqual([
      "Circulations de catégorie A, B, C",
      "Signaux fixes",
    ]);
  });
});

// ─── findAutoValidableActionsForSession — orchestration ──────────────────

describe("findAutoValidableActionsForSession", () => {
  it("retourne [] si la session n'a pas d'agent", async () => {
    findUniqueSession.mockResolvedValue({ agentId: null });
    const r = await findAutoValidableActionsForSession("s1");
    expect(r).toEqual([]);
    expect(findManyObs).not.toHaveBeenCalled();
    expect(findManyAction).not.toHaveBeenCalled();
  });

  it("retourne [] si la session est inconnue", async () => {
    findUniqueSession.mockResolvedValue(null);
    const r = await findAutoValidableActionsForSession("s1");
    expect(r).toEqual([]);
  });

  it("matche les actions agent à partir des points clés observés", async () => {
    findUniqueSession.mockResolvedValue({ agentId: "ag1" });
    findManyObs.mockResolvedValue([
      { checklistItem: { label: "Circuits de voie peu empruntés" } },
    ]);
    findManyAction.mockResolvedValue([
      {
        id: "a1",
        externalId: "x1",
        keyPoint: "Circuits de voie peu empruntés - Déshuntage",
        comment: null,
        dueAt: null,
      },
      {
        id: "a2",
        externalId: "x2",
        keyPoint: "Tout autre sujet",
        comment: null,
        dueAt: null,
      },
    ]);
    const r = await findAutoValidableActionsForSession("s1");
    expect(r.map((x) => x.id)).toEqual(["a1"]);
  });

  it("matche les actions dont le keyPoint commence par le titre de la procédure observée", async () => {
    findUniqueSession.mockResolvedValue({ agentId: "ag1" });
    findManyProcedureObs.mockResolvedValue([
      { procedure: { title: "Circulations de catégorie A, B, C" } },
    ]);
    findManyObs.mockResolvedValue([]);
    findManyAction.mockResolvedValue([
      {
        id: "a1",
        externalId: "x1",
        keyPoint: "Circulations de catégorie A, B, C sud",
        comment: null,
        dueAt: null,
      },
      {
        id: "a2",
        externalId: "x2",
        keyPoint: "Circulations de catégorie A, B, C ca c est le test",
        comment: null,
        dueAt: null,
      },
      {
        id: "a3",
        externalId: "x3",
        keyPoint: "Autre sujet",
        comment: null,
        dueAt: null,
      },
    ]);
    const r = await findAutoValidableActionsForSession("s1");
    expect(r.map((x) => x.id).sort()).toEqual(["a1", "a2"]);
  });
});
