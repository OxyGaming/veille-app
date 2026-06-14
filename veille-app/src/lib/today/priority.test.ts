import { describe, it, expect } from "vitest";
import {
  classifyUrgency,
  diffInDays,
  lateBoost,
  ownershipMultiplier,
  scoreItem,
  sortItems,
  topItems,
} from "./priority";
import type { ScoreContext, TodoItem } from "./types";

/**
 * Tests Sprint 2 — C2 / US-2.1.14.
 *
 * Vérifie l'algorithme de priorisation pur. Les dates sont injectées
 * via `ctx.now` pour rester déterministes. Aucun fetch Prisma ici.
 */

const NOW = new Date("2026-06-14T08:00:00Z");
const USER = { id: "u1", teamIds: ["t1", "t2"] };
const CTX: ScoreContext = { user: USER, now: NOW };

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeItem(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "test:default",
    sourceType: "ACTION",
    sourceId: "x",
    title: "Item de test",
    dueAt: null,
    context: { teamId: "t1" },
    assignedToUserId: null,
    cta: { label: "Voir", href: "/x" },
    ...overrides,
  };
}

describe("diffInDays", () => {
  it("compte les jours futurs en positif", () => {
    expect(diffInDays(NOW, daysFromNow(3))).toBe(3);
  });
  it("compte les jours passés en négatif", () => {
    expect(diffInDays(NOW, daysFromNow(-3))).toBe(-3);
  });
  it("retourne 0 pour la même date", () => {
    expect(diffInDays(NOW, NOW)).toBe(0);
  });
  it("classe une échéance à -1h comme déjà passée (floor)", () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(diffInDays(NOW, oneHourAgo)).toBe(-1);
  });
});

describe("classifyUrgency", () => {
  it("retourne 'late' pour une échéance dépassée", () => {
    expect(classifyUrgency(daysFromNow(-3), NOW, "ACTION")).toBe("late");
  });
  it("retourne 'today' pour une échéance dans 0-2 jours", () => {
    expect(classifyUrgency(daysFromNow(0), NOW, "ACTION")).toBe("today");
    expect(classifyUrgency(daysFromNow(2), NOW, "ACTION")).toBe("today");
  });
  it("retourne 'soon' pour une échéance dans 3-7 jours", () => {
    expect(classifyUrgency(daysFromNow(3), NOW, "ACTION")).toBe("soon");
    expect(classifyUrgency(daysFromNow(7), NOW, "ACTION")).toBe("soon");
  });
  it("retourne 'later' pour une échéance dans 8-30 jours", () => {
    expect(classifyUrgency(daysFromNow(8), NOW, "ACTION")).toBe("later");
    expect(classifyUrgency(daysFromNow(30), NOW, "ACTION")).toBe("later");
  });
  it("retourne 'info' au-delà de 30 jours", () => {
    expect(classifyUrgency(daysFromNow(60), NOW, "ACTION")).toBe("info");
  });
  it("traite null comme 'info' pour DRAFT_REMINDER", () => {
    expect(classifyUrgency(null, NOW, "DRAFT_REMINDER")).toBe("info");
  });
  it("traite null comme 'later' pour les autres types", () => {
    expect(classifyUrgency(null, NOW, "EQUIPMENT_EXPIRING")).toBe("later");
    expect(classifyUrgency(null, NOW, "ACTION")).toBe("later");
  });
});

describe("lateBoost", () => {
  it("ajoute +30 quand le retard dépasse 7 jours", () => {
    expect(lateBoost(daysFromNow(-8), NOW)).toBe(30);
  });
  it("ajoute +20 quand le retard est entre 0 et 6 jours", () => {
    expect(lateBoost(daysFromNow(-3), NOW)).toBe(20);
    expect(lateBoost(daysFromNow(-1), NOW)).toBe(20);
  });
  it("n'ajoute rien si l'échéance est future", () => {
    expect(lateBoost(daysFromNow(5), NOW)).toBe(0);
  });
  it("n'ajoute rien si dueAt est null", () => {
    expect(lateBoost(null, NOW)).toBe(0);
  });
});

describe("ownershipMultiplier", () => {
  it("renvoie 1.5 quand l'item m'est explicitement assigné", () => {
    const item = makeItem({ assignedToUserId: "u1", context: { teamId: "t1" } });
    expect(ownershipMultiplier(item, USER)).toBe(1.5);
  });
  it("renvoie 1.0 quand l'item est sur une de mes équipes", () => {
    const item = makeItem({ assignedToUserId: null, context: { teamId: "t1" } });
    expect(ownershipMultiplier(item, USER)).toBe(1.0);
  });
  it("renvoie 0.7 quand l'item est sur une équipe étrangère", () => {
    const item = makeItem({ assignedToUserId: null, context: { teamId: "t99" } });
    expect(ownershipMultiplier(item, USER)).toBe(0.7);
  });
  it("renvoie 0.7 si l'item n'a pas de contexte d'équipe", () => {
    const item = makeItem({ assignedToUserId: null, context: undefined });
    expect(ownershipMultiplier(item, USER)).toBe(0.7);
  });
  it("ignore l'assignation à un autre utilisateur", () => {
    const item = makeItem({ assignedToUserId: "u-other", context: { teamId: "t1" } });
    expect(ownershipMultiplier(item, USER)).toBe(1.0);
  });
});

describe("scoreItem", () => {
  it("scorre une action en retard plus haut qu'une action future", () => {
    const late = scoreItem(makeItem({ id: "a", dueAt: daysFromNow(-3) }), CTX);
    const future = scoreItem(makeItem({ id: "b", dueAt: daysFromNow(6) }), CTX);
    expect(late.score).toBeGreaterThan(future.score);
  });

  it("priorise un item assigné par rapport à un item équipe au même niveau", () => {
    const mine = scoreItem(
      makeItem({ id: "a", assignedToUserId: "u1", dueAt: daysFromNow(1) }),
      CTX,
    );
    const teamMate = scoreItem(
      makeItem({ id: "b", assignedToUserId: "u2", dueAt: daysFromNow(1) }),
      CTX,
    );
    expect(mine.score).toBeGreaterThan(teamMate.score);
  });

  it("priorise une ACTION par rapport à un DRAFT_REMINDER à urgence égale", () => {
    const action = scoreItem(
      makeItem({ id: "a", sourceType: "ACTION", dueAt: daysFromNow(1) }),
      CTX,
    );
    const draft = scoreItem(
      makeItem({ id: "b", sourceType: "DRAFT_REMINDER", dueAt: daysFromNow(1) }),
      CTX,
    );
    expect(action.score).toBeGreaterThan(draft.score);
  });

  it("attache la classification d'urgence correcte", () => {
    const item = scoreItem(makeItem({ dueAt: daysFromNow(-3) }), CTX);
    expect(item.urgency).toBe("late");
  });

  it("préserve les champs de l'item d'origine", () => {
    const item = makeItem({
      id: "x",
      title: "Titre exact",
      cta: { label: "Démarrer", href: "/visits/new" },
    });
    const scored = scoreItem(item, CTX);
    expect(scored.id).toBe("x");
    expect(scored.title).toBe("Titre exact");
    expect(scored.cta).toEqual({ label: "Démarrer", href: "/visits/new" });
  });
});

describe("sortItems", () => {
  it("trie par score décroissant", () => {
    const items: TodoItem[] = [
      makeItem({ id: "later", dueAt: daysFromNow(15) }),
      makeItem({ id: "late", dueAt: daysFromNow(-3) }),
      makeItem({ id: "today", dueAt: daysFromNow(1) }),
    ];
    const sorted = sortItems(items, CTX);
    expect(sorted.map((i) => i.id)).toEqual(["late", "today", "later"]);
  });

  it("tie-break par dueAt ASC à score égal", () => {
    const items: TodoItem[] = [
      makeItem({ id: "tomorrow", dueAt: daysFromNow(2) }),
      makeItem({ id: "today", dueAt: daysFromNow(1) }),
    ];
    const sorted = sortItems(items, CTX);
    expect(sorted[0].id).toBe("today");
    expect(sorted[1].id).toBe("tomorrow");
  });

  it("place les items datés avant les items sans date à score égal", () => {
    const items: TodoItem[] = [
      makeItem({ id: "no-date", sourceType: "ACTION", dueAt: null, context: { teamId: "t1" } }),
      makeItem({ id: "future", sourceType: "ACTION", dueAt: daysFromNow(15), context: { teamId: "t1" } }),
    ];
    const sorted = sortItems(items, CTX);
    expect(sorted[0].id).toBe("future");
  });

  it("tie-break stable sur l'id quand tout est strictement égal", () => {
    const items: TodoItem[] = [
      makeItem({ id: "z" }),
      makeItem({ id: "a" }),
      makeItem({ id: "m" }),
    ];
    const sorted = sortItems(items, CTX);
    expect(sorted.map((i) => i.id)).toEqual(["a", "m", "z"]);
  });

  it("renvoie une liste vide pour une entrée vide", () => {
    expect(sortItems([], CTX)).toEqual([]);
  });

  it("ne mute pas la liste d'entrée", () => {
    const items: TodoItem[] = [
      makeItem({ id: "b", dueAt: daysFromNow(10) }),
      makeItem({ id: "a", dueAt: daysFromNow(-1) }),
    ];
    const original = items.map((i) => i.id);
    sortItems(items, CTX);
    expect(items.map((i) => i.id)).toEqual(original);
  });

  it("amplifie un retard long via le boost", () => {
    const old = scoreItem(makeItem({ id: "a", dueAt: daysFromNow(-10) }), CTX);
    const recent = scoreItem(makeItem({ id: "b", dueAt: daysFromNow(-2) }), CTX);
    expect(old.score).toBeGreaterThan(recent.score);
  });
});

describe("topItems", () => {
  it("renvoie les N premiers triés", () => {
    const items: TodoItem[] = [
      makeItem({ id: "a", dueAt: daysFromNow(10) }),
      makeItem({ id: "b", dueAt: daysFromNow(-3) }),
      makeItem({ id: "c", dueAt: daysFromNow(1) }),
      makeItem({ id: "d", dueAt: daysFromNow(20) }),
    ];
    const top = topItems(items, CTX, 2);
    expect(top.map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("renvoie tous les items si la limite excède la longueur", () => {
    const items: TodoItem[] = [makeItem({ id: "a" })];
    expect(topItems(items, CTX, 5)).toHaveLength(1);
  });
});
