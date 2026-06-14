import { describe, expect, it } from "vitest";
import {
  ACTION_CRITICAL_THRESHOLD_DAYS,
  VISIT_CRITICAL_THRESHOLD_DAYS,
  countCriticalEcheances,
  filterCriticalEcheances,
  isCriticalEcheance,
  isKnownEcheanceKind,
} from "./criticality";
import type { EcheanceItem } from "./types";

function mkItem(
  partial: Partial<EcheanceItem> & Pick<EcheanceItem, "id" | "kind">,
): EcheanceItem {
  return {
    title: "x",
    dueAt: null,
    daysToDue: null,
    urgency: "late",
    isCritical: false,
    context: { teamIds: [] },
    cta: { label: "x", href: "/" },
    ...partial,
  };
}

describe("constants", () => {
  it("seuils alignés sur la décision PO D13", () => {
    expect(ACTION_CRITICAL_THRESHOLD_DAYS).toBe(7);
    expect(VISIT_CRITICAL_THRESHOLD_DAYS).toBe(30);
  });
});

describe("isCriticalEcheance — ACTION_OVERDUE (> 7 j de retard)", () => {
  it("retard exactement -7 j → non critique (limite stricte)", () => {
    expect(
      isCriticalEcheance({ kind: "ACTION_OVERDUE", daysToDue: -7 }),
    ).toBe(false);
  });
  it("retard -8 j → critique", () => {
    expect(
      isCriticalEcheance({ kind: "ACTION_OVERDUE", daysToDue: -8 }),
    ).toBe(true);
  });
  it("retard léger (-3 j) → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "ACTION_OVERDUE", daysToDue: -3 }),
    ).toBe(false);
  });
  it("daysToDue = null → non critique (pas d'échéance)", () => {
    expect(
      isCriticalEcheance({ kind: "ACTION_OVERDUE", daysToDue: null }),
    ).toBe(false);
  });
  it("dans le futur (5 j) → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "ACTION_OVERDUE", daysToDue: 5 }),
    ).toBe(false);
  });
});

describe("isCriticalEcheance — VISIT_QUARTERLY (> 30 j de retard ou jamais)", () => {
  it("daysToDue = null (jamais visité) → critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_QUARTERLY", daysToDue: null }),
    ).toBe(true);
  });
  it("retard exactement -30 j → non critique (limite stricte)", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_QUARTERLY", daysToDue: -30 }),
    ).toBe(false);
  });
  it("retard -31 j → critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_QUARTERLY", daysToDue: -31 }),
    ).toBe(true);
  });
  it("dans le futur → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_QUARTERLY", daysToDue: 10 }),
    ).toBe(false);
  });
});

describe("isCriticalEcheance — VISIT_PLANNED (idem trimestrielle)", () => {
  it("daysToDue = null → critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_PLANNED", daysToDue: null }),
    ).toBe(true);
  });
  it("retard -31 j → critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_PLANNED", daysToDue: -31 }),
    ).toBe(true);
  });
  it("retard -10 j → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "VISIT_PLANNED", daysToDue: -10 }),
    ).toBe(false);
  });
});

describe("isCriticalEcheance — EQUIPMENT_EXPIRING (déjà expiré)", () => {
  it("daysToDue = -1 (expiré hier) → critique", () => {
    expect(
      isCriticalEcheance({ kind: "EQUIPMENT_EXPIRING", daysToDue: -1 }),
    ).toBe(true);
  });
  it("daysToDue = 0 (expire aujourd'hui) → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "EQUIPMENT_EXPIRING", daysToDue: 0 }),
    ).toBe(false);
  });
  it("daysToDue = 5 → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "EQUIPMENT_EXPIRING", daysToDue: 5 }),
    ).toBe(false);
  });
  it("daysToDue = null (équipement non périssable) → non critique", () => {
    expect(
      isCriticalEcheance({ kind: "EQUIPMENT_EXPIRING", daysToDue: null }),
    ).toBe(false);
  });
});

describe("countCriticalEcheances / filterCriticalEcheances", () => {
  const items: EcheanceItem[] = [
    mkItem({ id: "a", kind: "ACTION_OVERDUE", isCritical: true }),
    mkItem({ id: "b", kind: "VISIT_PLANNED", isCritical: false }),
    mkItem({ id: "c", kind: "EQUIPMENT_EXPIRING", isCritical: true }),
  ];

  it("count = nombre d'items avec isCritical=true", () => {
    expect(countCriticalEcheances(items)).toBe(2);
    expect(countCriticalEcheances([])).toBe(0);
  });

  it("filter renvoie le sous-ensemble critique", () => {
    expect(filterCriticalEcheances(items).map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("isKnownEcheanceKind", () => {
  it("reconnaît les 4 kinds valides", () => {
    expect(isKnownEcheanceKind("VISIT_QUARTERLY")).toBe(true);
    expect(isKnownEcheanceKind("VISIT_PLANNED")).toBe(true);
    expect(isKnownEcheanceKind("EQUIPMENT_EXPIRING")).toBe(true);
    expect(isKnownEcheanceKind("ACTION_OVERDUE")).toBe(true);
  });

  it("refuse les inconnus", () => {
    expect(isKnownEcheanceKind("VISIT_FOO")).toBe(false);
    expect(isKnownEcheanceKind("")).toBe(false);
    expect(isKnownEcheanceKind("action_overdue")).toBe(false);
  });
});
