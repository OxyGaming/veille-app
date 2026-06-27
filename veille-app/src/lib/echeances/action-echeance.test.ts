import { describe, it, expect } from "vitest";
import {
  ACTION_ECHEANCE_LABEL,
  actionEcheanceState,
  actionEcheanceStateAt,
  criticalThreshold,
  deserializeEcheanceBounds,
  dueSoonEnd,
  echeanceBounds,
  isOverdue,
  serializeEcheanceBounds,
  startOfEcheanceDay,
} from "./action-echeance";

/**
 * Calculs d'échéance — nomenclature figée (docs/NOMENCLATURE-ECHEANCES.md).
 * Toutes les dates sont construites en heure LOCALE (constructeur (y,m,d,…))
 * pour rester cohérentes avec startOfDay (fuseau serveur = Europe/Paris).
 */

// Référence : mer. 15 juin 2026, 10:00 local. Aujourd'hui 00:00 = 15/06 00:00.
const NOW = new Date(2026, 5, 15, 10, 0, 0);
const d = (y: number, m: number, day: number, h = 12, min = 0) =>
  new Date(y, m, day, h, min, 0);

describe("bornes canoniques", () => {
  it("startOfEcheanceDay = aujourd'hui 00:00", () => {
    expect(startOfEcheanceDay(NOW)).toEqual(new Date(2026, 5, 15, 0, 0, 0));
  });
  it("criticalThreshold = aujourd'hui 00:00 − 7 j", () => {
    expect(criticalThreshold(NOW)).toEqual(new Date(2026, 5, 8, 0, 0, 0));
  });
  it("dueSoonEnd = fin du 7e jour suivant (22/06 23:59:59.999)", () => {
    const e = dueSoonEnd(NOW);
    expect(e.getFullYear()).toBe(2026);
    expect(e.getMonth()).toBe(5);
    expect(e.getDate()).toBe(22);
    expect(e.getHours()).toBe(23);
    expect(e.getMinutes()).toBe(59);
  });
});

describe("actionEcheanceState", () => {
  it("NO_DUE_DATE quand dueAt est absente", () => {
    expect(actionEcheanceState(null, NOW)).toBe("NO_DUE_DATE");
    expect(actionEcheanceState(undefined, NOW)).toBe("NO_DUE_DATE");
  });

  it("OVERDUE_CRITICAL : dueAt < aujourd'hui − 7 j (8 j de retard)", () => {
    expect(actionEcheanceState(d(2026, 5, 7), NOW)).toBe("OVERDUE_CRITICAL");
    // veille de la borne critique (07/06 23:59) → critique
    expect(actionEcheanceState(d(2026, 5, 7, 23, 59), NOW)).toBe(
      "OVERDUE_CRITICAL",
    );
  });

  it("OVERDUE (non critique) : retard ≤ 7 j", () => {
    // exactement 7 j de retard (08/06 midi) → en retard, PAS critique
    expect(actionEcheanceState(d(2026, 5, 8), NOW)).toBe("OVERDUE");
    // hier (14/06) → en retard
    expect(actionEcheanceState(d(2026, 5, 14, 23, 0), NOW)).toBe("OVERDUE");
  });

  it("frontière en retard / à venir à minuit", () => {
    // 14/06 23:59 → en retard
    expect(actionEcheanceState(new Date(2026, 5, 14, 23, 59), NOW)).toBe(
      "OVERDUE",
    );
    // 15/06 00:00 (aujourd'hui) → à venir (échéance du jour)
    expect(actionEcheanceState(new Date(2026, 5, 15, 0, 0), NOW)).toBe(
      "DUE_SOON",
    );
  });

  it("DUE_SOON : aujourd'hui → +7 j inclus (fin de journée)", () => {
    expect(actionEcheanceState(d(2026, 5, 15), NOW)).toBe("DUE_SOON"); // aujourd'hui
    expect(actionEcheanceState(d(2026, 5, 18), NOW)).toBe("DUE_SOON"); // +3 j
    expect(actionEcheanceState(new Date(2026, 5, 22, 23, 59), NOW)).toBe(
      "DUE_SOON",
    ); // +7 j fin de journée
  });

  it("SCHEDULED (Planifiée) : au-delà de +7 j", () => {
    expect(actionEcheanceState(d(2026, 5, 23), NOW)).toBe("SCHEDULED"); // +8 j
    expect(actionEcheanceState(d(2026, 6, 30), NOW)).toBe("SCHEDULED"); // ~6 semaines
  });
});

describe("isOverdue", () => {
  it("vrai pour en retard et critique uniquement", () => {
    expect(isOverdue("OVERDUE")).toBe(true);
    expect(isOverdue("OVERDUE_CRITICAL")).toBe(true);
    expect(isOverdue("DUE_SOON")).toBe(false);
    expect(isOverdue("SCHEDULED")).toBe(false);
    expect(isOverdue("NO_DUE_DATE")).toBe(false);
  });
});

describe("bornes partagées (référence serveur unique)", () => {
  it("echeanceBounds expose today0 / critical0 / dueSoonEnd cohérents", () => {
    const b = echeanceBounds(NOW);
    expect(b.today0).toEqual(startOfEcheanceDay(NOW));
    expect(b.critical0).toEqual(criticalThreshold(NOW));
    expect(b.dueSoonEnd).toEqual(dueSoonEnd(NOW));
  });

  it("actionEcheanceStateAt(bornes) == actionEcheanceState(now) pour tous les états", () => {
    const b = echeanceBounds(NOW);
    const cases: (Date | null)[] = [
      null,
      d(2026, 5, 7), // critique
      d(2026, 5, 8), // en retard
      d(2026, 5, 15), // à venir (aujourd'hui)
      d(2026, 5, 23), // planifiée
    ];
    for (const due of cases) {
      expect(actionEcheanceStateAt(due, b)).toBe(actionEcheanceState(due, NOW));
    }
  });

  it("sérialisation ISO → désérialisation : classification IDENTIQUE (indépendante du fuseau)", () => {
    const b = echeanceBounds(NOW);
    const round = deserializeEcheanceBounds(serializeEcheanceBounds(b));
    // Mêmes instants absolus.
    expect(round.today0.getTime()).toBe(b.today0.getTime());
    expect(round.critical0.getTime()).toBe(b.critical0.getTime());
    expect(round.dueSoonEnd.getTime()).toBe(b.dueSoonEnd.getTime());
    // Même résultat de classification via les bornes désérialisées — c'est ce
    // qui garantit que le badge client = le compteur serveur.
    const samples: (Date | null)[] = [
      null,
      d(2026, 5, 7),
      d(2026, 5, 14, 23, 59),
      d(2026, 5, 15, 0, 0),
      new Date(2026, 5, 22, 23, 59),
      d(2026, 5, 23),
    ];
    for (const due of samples) {
      expect(actionEcheanceStateAt(due, round)).toBe(
        actionEcheanceStateAt(due, b),
      );
    }
  });
});

describe("libellés FR canoniques", () => {
  it("utilise la nomenclature figée (pas d'« échu », pas d'« expiré »)", () => {
    expect(ACTION_ECHEANCE_LABEL).toEqual({
      OVERDUE_CRITICAL: "En retard critique",
      OVERDUE: "En retard",
      DUE_SOON: "À venir",
      SCHEDULED: "Planifiée",
      NO_DUE_DATE: "Sans échéance",
    });
  });
});
