import { describe, expect, it } from "vitest";
import type { EcheanceItem, EcheanceUrgency } from "./types";
import {
  classifyEcheanceUrgency,
  groupByUrgency,
  sortByDueAt,
} from "./urgency";

function mkItem(
  partial: Partial<EcheanceItem> & Pick<EcheanceItem, "id" | "urgency">,
): EcheanceItem {
  return {
    kind: "ACTION_OVERDUE",
    title: "x",
    dueAt: null,
    daysToDue: null,
    isCritical: false,
    context: { teamIds: [] },
    cta: { label: "x", href: "/" },
    ...partial,
  };
}

describe("classifyEcheanceUrgency", () => {
  it("null → late (jamais effectué)", () => {
    expect(classifyEcheanceUrgency(null)).toBe("late");
  });

  it("très en retard → late", () => {
    expect(classifyEcheanceUrgency(-100)).toBe("late");
  });

  it("limite haute du retard (-1) → late", () => {
    expect(classifyEcheanceUrgency(-1)).toBe("late");
  });

  it("0 jour → today", () => {
    expect(classifyEcheanceUrgency(0)).toBe("today");
  });

  it("seuil today (2 j) inclus → today", () => {
    expect(classifyEcheanceUrgency(2)).toBe("today");
  });

  it("3 j → soon", () => {
    expect(classifyEcheanceUrgency(3)).toBe("soon");
  });

  it("seuil soon (7 j) inclus → soon", () => {
    expect(classifyEcheanceUrgency(7)).toBe("soon");
  });

  it("8 j → later", () => {
    expect(classifyEcheanceUrgency(8)).toBe("later");
  });

  it("seuil later (30 j) inclus → later", () => {
    expect(classifyEcheanceUrgency(30)).toBe("later");
  });

  it("31 j → future (D3 — nouveau groupe Sprint 4)", () => {
    expect(classifyEcheanceUrgency(31)).toBe("future");
  });

  it("365 j → future", () => {
    expect(classifyEcheanceUrgency(365)).toBe("future");
  });
});

describe("groupByUrgency", () => {
  it("renvoie 5 clés présentes même si vides", () => {
    const out = groupByUrgency([]);
    const keys = Object.keys(out).sort() as EcheanceUrgency[];
    expect(keys).toEqual(["future", "late", "later", "soon", "today"]);
    for (const k of keys) expect(out[k]).toEqual([]);
  });

  it("regroupe correctement un ensemble multi-urgences", () => {
    const items: EcheanceItem[] = [
      mkItem({ id: "a", urgency: "late" }),
      mkItem({ id: "b", urgency: "late" }),
      mkItem({ id: "c", urgency: "today" }),
      mkItem({ id: "d", urgency: "future" }),
    ];
    const out = groupByUrgency(items);
    expect(out.late.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.today.map((i) => i.id)).toEqual(["c"]);
    expect(out.soon).toEqual([]);
    expect(out.later).toEqual([]);
    expect(out.future.map((i) => i.id)).toEqual(["d"]);
  });
});

describe("sortByDueAt", () => {
  it("trie ASC par dueAt", () => {
    const d1 = new Date("2026-06-01T00:00:00Z");
    const d2 = new Date("2026-07-01T00:00:00Z");
    const items = [
      mkItem({ id: "b", urgency: "later", dueAt: d2 }),
      mkItem({ id: "a", urgency: "later", dueAt: d1 }),
    ];
    expect(sortByDueAt(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("place les dueAt=null en tête", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    const items = [
      mkItem({ id: "z", urgency: "later", dueAt: d }),
      mkItem({ id: "n", urgency: "late", dueAt: null }),
    ];
    expect(sortByDueAt(items).map((i) => i.id)).toEqual(["n", "z"]);
  });

  it("ne mute pas l'entrée", () => {
    const input = [
      mkItem({ id: "x", urgency: "later", dueAt: new Date("2026-06-01") }),
    ];
    sortByDueAt(input);
    expect(input.length).toBe(1);
    expect(input[0].id).toBe("x");
  });

  it("stable pour dates équivalentes (préserve l'ordre d'entrée)", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    const items = [
      mkItem({ id: "a", urgency: "later", dueAt: d }),
      mkItem({ id: "b", urgency: "later", dueAt: d }),
      mkItem({ id: "c", urgency: "later", dueAt: d }),
    ];
    expect(sortByDueAt(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
