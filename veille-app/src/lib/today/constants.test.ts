import { describe, it, expect } from "vitest";
import {
  QUARTERLY_VISIT_DAYS,
  OCCUPIED_PLANNED_VISIT_DAYS,
  UNOCCUPIED_PLANNED_VISIT_DAYS,
  classifyVisitTemplateSlug,
  visitFrequencyDays,
} from "./constants";

describe("classifyVisitTemplateSlug", () => {
  it("classe les templates trimestrielle-* en quarterly", () => {
    expect(classifyVisitTemplateSlug("trimestrielle-incendie")).toBe("quarterly");
    expect(classifyVisitTemplateSlug("trimestrielle-securite")).toBe("quarterly");
  });
  it("classe les templates planifiee-* en planned", () => {
    expect(classifyVisitTemplateSlug("planifiee-eic-ra")).toBe("planned");
    expect(classifyVisitTemplateSlug("planifiee")).toBe("planned");
  });
  it("tolère la casse mixte", () => {
    expect(classifyVisitTemplateSlug("TRIMESTRIELLE-X")).toBe("quarterly");
    expect(classifyVisitTemplateSlug("Planifiee-Y")).toBe("planned");
  });
  it("renvoie 'other' pour les slugs non typés", () => {
    expect(classifyVisitTemplateSlug("veille-site")).toBe("other");
    expect(classifyVisitTemplateSlug("inventory")).toBe("other");
    expect(classifyVisitTemplateSlug("")).toBe("other");
  });
});

describe("visitFrequencyDays", () => {
  it("trimestrielle = 90 j quel que soit isOccupied", () => {
    expect(visitFrequencyDays("quarterly", true)).toBe(QUARTERLY_VISIT_DAYS);
    expect(visitFrequencyDays("quarterly", false)).toBe(QUARTERLY_VISIT_DAYS);
    expect(QUARTERLY_VISIT_DAYS).toBe(90);
  });
  it("planifiée = 180 j si site occupé", () => {
    expect(visitFrequencyDays("planned", true)).toBe(OCCUPIED_PLANNED_VISIT_DAYS);
    expect(OCCUPIED_PLANNED_VISIT_DAYS).toBe(180);
  });
  it("planifiée = 365 j si site inoccupé", () => {
    expect(visitFrequencyDays("planned", false)).toBe(UNOCCUPIED_PLANNED_VISIT_DAYS);
    expect(UNOCCUPIED_PLANNED_VISIT_DAYS).toBe(365);
  });
  it("'other' tombe sur la valeur par défaut (90 j)", () => {
    expect(visitFrequencyDays("other", true)).toBe(QUARTERLY_VISIT_DAYS);
    expect(visitFrequencyDays("other", false)).toBe(QUARTERLY_VISIT_DAYS);
  });
  it("les 2 cadences sont indépendantes : un même site peut être en retard sur l'une mais pas l'autre", () => {
    // Démontre qu'une donnée 'site occupé visité il y a 200 j' est :
    //  - en retard trimestrielle (200 > 90)
    //  - en retard planifiée (200 > 180)
    // Alors qu'une donnée 'site inoccupé visité il y a 200 j' est :
    //  - en retard trimestrielle (200 > 90)
    //  - PAS en retard planifiée (200 < 365)
    const days = 200;
    expect(days > visitFrequencyDays("quarterly", true)).toBe(true);
    expect(days > visitFrequencyDays("planned", true)).toBe(true);
    expect(days > visitFrequencyDays("planned", false)).toBe(false);
  });
});
