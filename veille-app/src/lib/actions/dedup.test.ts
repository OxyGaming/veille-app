import { describe, it, expect } from "vitest";
import {
  countLogicalActions,
  dedupActions,
  groupKeyOf,
  targetOf,
  type DedupActionInput,
} from "./dedup";

/**
 * Tests du helper central de déduplication (Lot 4B-1). 100 % pur, aucun mock.
 */

// Fabrique compacte. dueAt accepte Date | ISO string | null.
function action(
  over: Partial<DedupActionInput> & { id: string },
): DedupActionInput {
  return {
    teamId: "tA",
    agentId: null,
    siteId: null,
    vehicleId: null,
    dedupHash: null,
    localStatus: "ACTIVE",
    dueAt: null,
    ...over,
  };
}

describe("targetOf", () => {
  it("résout la cible par priorité agent > site > véhicule > none", () => {
    expect(targetOf(action({ id: "1", agentId: "ag1" }))).toEqual({ type: "agent", id: "ag1" });
    expect(targetOf(action({ id: "2", siteId: "s1" }))).toEqual({ type: "site", id: "s1" });
    expect(targetOf(action({ id: "3", vehicleId: "v1" }))).toEqual({ type: "vehicle", id: "v1" });
    // none → targetId = id (jamais collapsé)
    expect(targetOf(action({ id: "4" }))).toEqual({ type: "none", id: "4" });
    // agent prioritaire même si site renseigné
    expect(targetOf(action({ id: "5", agentId: "ag1", siteId: "s1" }))).toEqual({ type: "agent", id: "ag1" });
  });
});

describe("groupKeyOf — stabilité et format", () => {
  it("clé = targetType|targetId|teamId|(dedupHash ?? id)", () => {
    expect(groupKeyOf(action({ id: "x", agentId: "ag1", teamId: "tA", dedupHash: "h1" }))).toBe(
      "agent|ag1|tA|h1",
    );
    // sans dedupHash → fallback id
    expect(groupKeyOf(action({ id: "x", agentId: "ag1", teamId: "tA" }))).toBe("agent|ag1|tA|x");
    // none → targetId = id
    expect(groupKeyOf(action({ id: "x", teamId: "tA", dedupHash: "h1" }))).toBe("none|x|tA|h1");
  });

  it("est stable : même action logique ⇒ même clé (indépendant des autres champs)", () => {
    const a = action({ id: "a1", agentId: "ag1", teamId: "tA", dedupHash: "h", dueAt: new Date("2026-06-01") });
    const b = action({ id: "a2", agentId: "ag1", teamId: "tA", dedupHash: "h", dueAt: new Date("2026-09-30"), localStatus: "OBSOLETE" });
    expect(groupKeyOf(a)).toBe(groupKeyOf(b)); // même groupe malgré id/échéance/statut différents
  });
});

describe("dedupActions — regroupement", () => {
  it("action unique → 1 groupe, occurrenceCount 1, logicalCount 1, non dupliqué", () => {
    const groups = dedupActions([action({ id: "1", agentId: "ag1", dedupHash: "h" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrenceCount).toBe(1);
    expect(groups[0].logicalCount).toBe(1);
    expect(groups[0].isDuplicated).toBe(false);
    expect(groups[0].memberIds).toEqual(["1"]);
    expect(groups[0].anomalies).toEqual([]);
    expect(groups[0].targetType).toBe("agent");
    expect(groups[0].targetId).toBe("ag1");
    expect(groups[0].teamId).toBe("tA");
    expect(groups[0].dedupHash).toBe("h");
    expect(groups[0].state).toBe("ACTIVE");
  });

  it("plusieurs doublons (même agent+équipe+hash) → 1 groupe de N", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h" }),
      action({ id: "2", agentId: "ag1", dedupHash: "h" }),
      action({ id: "3", agentId: "ag1", dedupHash: "h" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrenceCount).toBe(3);
    expect(groups[0].isDuplicated).toBe(true);
    expect(groups[0].memberIds.sort()).toEqual(["1", "2", "3"]);
  });

  it("plusieurs équipes (même agent+hash, équipe différente) → groupes séparés", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", teamId: "tA", dedupHash: "h" }),
      action({ id: "2", agentId: "ag1", teamId: "tB", dedupHash: "h" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("plusieurs agents (même hash+équipe, agent différent) → groupes séparés", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h" }),
      action({ id: "2", agentId: "ag2", dedupHash: "h" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("plusieurs sites (même hash+équipe, site différent) → groupes séparés", () => {
    const groups = dedupActions([
      action({ id: "1", siteId: "s1", dedupHash: "h" }),
      action({ id: "2", siteId: "s2", dedupHash: "h" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("sans dedupHash → chaque action reste seule, même contenu identique", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: null }),
      action({ id: "2", agentId: "ag1", dedupHash: null }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.occurrenceCount === 1)).toBe(true);
  });

  it("dedupHash identique mais ÉQUIPE différente → ne fusionne pas", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", teamId: "tA", dedupHash: "same" }),
      action({ id: "2", agentId: "ag1", teamId: "tB", dedupHash: "same" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("dedupHash identique mais CIBLE différente → ne fusionne pas", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "same" }),
      action({ id: "2", siteId: "s1", dedupHash: "same" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.targetType).sort()).toEqual(["agent", "site"]);
  });

  it("véhicule comme cible", () => {
    const groups = dedupActions([
      action({ id: "1", vehicleId: "v1", dedupHash: "h" }),
      action({ id: "2", vehicleId: "v1", dedupHash: "h" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].targetType).toBe("vehicle");
    expect(groups[0].targetId).toBe("v1");
  });
});

describe("dedupActions — anomalies", () => {
  it("groupe multi-statuts → hasMixedState + anomalie MIXED_STATE", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h", localStatus: "ACTIVE" }),
      action({ id: "2", agentId: "ag1", dedupHash: "h", localStatus: "VALIDATED_LOCAL" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].hasMixedState).toBe(true);
    expect(groups[0].anomalies).toContain("MIXED_STATE");
  });

  it("groupe multi-échéances (jours différents) → hasMixedDueDate + anomalie", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-01T10:00:00Z") }),
      action({ id: "2", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-09T10:00:00Z") }),
    ]);
    expect(groups[0].hasMixedDueDate).toBe(true);
    expect(groups[0].anomalies).toContain("MIXED_DUE_DATE");
  });

  it("même jour, heures différentes → PAS d'anomalie d'échéance (granularité jour)", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-01T08:00:00Z") }),
      action({ id: "2", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-01T18:00:00Z") }),
    ]);
    expect(groups[0].hasMixedDueDate).toBe(false);
    expect(groups[0].anomalies).toEqual([]);
  });

  it("hasMixedOwner reste false par construction (teamId dans la clé)", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", teamId: "tA", dedupHash: "h" }),
      action({ id: "2", agentId: "ag1", teamId: "tA", dedupHash: "h" }),
    ]);
    expect(groups[0].hasMixedOwner).toBe(false);
  });
});

describe("dedupActions — représentant déterministe", () => {
  it("représentant = échéance la plus proche (dueAt croissant)", () => {
    const groups = dedupActions([
      action({ id: "late", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-12-31") }),
      action({ id: "soon", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-01-01") }),
    ]);
    expect(groups[0].representative.id).toBe("soon");
    expect(groups[0].memberIds).toEqual(["soon", "late"]); // ordre trié
  });

  it("dueAt null passe en dernier (préfère une échéance réelle comme représentant)", () => {
    const groups = dedupActions([
      action({ id: "noDue", agentId: "ag1", dedupHash: "h", dueAt: null }),
      action({ id: "withDue", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-01") }),
    ]);
    expect(groups[0].representative.id).toBe("withDue");
  });

  it("égalité d'échéance → tie-break par id croissant", () => {
    const d = new Date("2026-06-01");
    const groups = dedupActions([
      action({ id: "b", agentId: "ag1", dedupHash: "h", dueAt: d }),
      action({ id: "a", agentId: "ag1", dedupHash: "h", dueAt: d }),
    ]);
    expect(groups[0].representative.id).toBe("a");
  });

  it("dueAt invalide (string non parsable ou Date NaN) → traité comme null (en dernier)", () => {
    const groups = dedupActions([
      action({ id: "bad", agentId: "ag1", dedupHash: "h", dueAt: "pas-une-date" }),
      action({ id: "nan", agentId: "ag1", dedupHash: "h", dueAt: new Date("invalide") }),
      action({ id: "ok", agentId: "ag1", dedupHash: "h", dueAt: new Date("2026-06-01") }),
    ]);
    // l'échéance valide passe en représentant ; les invalides (= null) en fin
    expect(groups[0].representative.id).toBe("ok");
    expect(groups[0].memberIds[0]).toBe("ok");
    // deux dueAt « invalides » ⇒ même clé jour "none" ⇒ pas de fausse anomalie entre elles
    expect(groups[0].hasMixedDueDate).toBe(true); // ok (un jour) vs none (invalides)
  });

  it("dueAt en string ISO traité comme une Date", () => {
    const groups = dedupActions([
      action({ id: "1", agentId: "ag1", dedupHash: "h", dueAt: "2026-12-31T00:00:00.000Z" }),
      action({ id: "2", agentId: "ag1", dedupHash: "h", dueAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(groups[0].representative.id).toBe("2");
  });
});

describe("dedupActions — ordre des groupes déterministe", () => {
  it("la sortie est indépendante de l'ordre d'entrée", () => {
    const a = action({ id: "a", agentId: "ag1", dedupHash: "h1", dueAt: new Date("2026-03-01") });
    const b = action({ id: "b", agentId: "ag2", dedupHash: "h2", dueAt: new Date("2026-01-01") });
    const c = action({ id: "c", siteId: "s1", dedupHash: "h3", dueAt: new Date("2026-02-01") });

    const keys1 = dedupActions([a, b, c]).map((g) => g.groupKey);
    const keys2 = dedupActions([c, a, b]).map((g) => g.groupKey);
    const keys3 = dedupActions([b, c, a]).map((g) => g.groupKey);
    expect(keys2).toEqual(keys1);
    expect(keys3).toEqual(keys1);
    // tri par échéance la plus proche : b (jan) < c (fév) < a (mars)
    expect(keys1).toEqual(["agent|ag2|tA|h2", "site|s1|tA|h3", "agent|ag1|tA|h1"]);
  });
});

describe("dedupActions — robustesse", () => {
  it("liste vide → []", () => {
    expect(dedupActions([])).toEqual([]);
  });

  it("préserve le type concret du caller (champs supplémentaires)", () => {
    type Row = DedupActionInput & { keyPoint: string };
    const rows: Row[] = [
      { id: "1", teamId: "tA", agentId: "ag1", dedupHash: "h", localStatus: "ACTIVE", dueAt: null, keyPoint: "Refaire X" },
    ];
    const groups = dedupActions(rows);
    expect(groups[0].representative.keyPoint).toBe("Refaire X");
  });
});

describe("countLogicalActions", () => {
  it("compte le nombre de groupes logiques", () => {
    expect(
      countLogicalActions([
        action({ id: "1", agentId: "ag1", dedupHash: "h" }),
        action({ id: "2", agentId: "ag1", dedupHash: "h" }), // doublon
        action({ id: "3", agentId: "ag2", dedupHash: "h" }), // autre agent
        action({ id: "4", siteId: "s1", dedupHash: null }), // sans hash
      ]),
    ).toBe(3);
  });

  it("liste vide → 0", () => {
    expect(countLogicalActions([])).toBe(0);
  });
});
