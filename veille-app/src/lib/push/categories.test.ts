import { describe, expect, it } from "vitest";
import { PUSH_CATEGORY_KEYS, getCategoryForType } from "./categories";

describe("PUSH_CATEGORY_KEYS", () => {
  it("expose exactement les 2 catégories V1", () => {
    expect(PUSH_CATEGORY_KEYS).toEqual(["catEcheances", "catEquipes"]);
  });
});

describe("getCategoryForType", () => {
  it("ECHEANCE_CRITICAL_ON_MY_PERIMETER → catEcheances", () => {
    expect(getCategoryForType("ECHEANCE_CRITICAL_ON_MY_PERIMETER")).toBe(
      "catEcheances",
    );
  });

  it("TEAM_MEMBERSHIP_ADDED → catEquipes", () => {
    expect(getCategoryForType("TEAM_MEMBERSHIP_ADDED")).toBe("catEquipes");
  });

  it("TEAM_HISTORY_ADDED → catEquipes (C9.2)", () => {
    expect(getCategoryForType("TEAM_HISTORY_ADDED")).toBe("catEquipes");
  });

  it("types existants NON mappés en V1 → null (pas de push)", () => {
    expect(getCategoryForType("ACTION_ASSIGNED_TO_ME")).toBeNull();
    expect(getCategoryForType("ACTION_VALIDATED_ON_MY_ACTION")).toBeNull();
    expect(getCategoryForType("VISIT_FINISHED_ON_MY_SITE")).toBeNull();
  });

  it("type inconnu → null", () => {
    expect(getCategoryForType("UNKNOWN_TYPE")).toBeNull();
    expect(getCategoryForType("")).toBeNull();
  });

  it("sensible à la casse — pas d'auto-lowercase", () => {
    expect(getCategoryForType("team_membership_added")).toBeNull();
    expect(getCategoryForType("Team_Membership_Added")).toBeNull();
  });
});
