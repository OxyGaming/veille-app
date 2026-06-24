import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueAction = vi.fn();
const findUniqueObservation = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importedAction: { findUnique: (...a: unknown[]) => findUniqueAction(...a) },
    siteVisitObservation: {
      findUnique: (...a: unknown[]) => findUniqueObservation(...a),
    },
  },
}));

import {
  getEquipmentLinkForAction,
  parseObservationIdFromExternalId,
} from "./equipment-action-link";

beforeEach(() => {
  findUniqueAction.mockReset();
  findUniqueObservation.mockReset();
});

describe("parseObservationIdFromExternalId", () => {
  it("extrait l'observationId d'un externalId nc-inv-...", () => {
    expect(parseObservationIdFromExternalId("nc-inv-cmqxxx")).toBe("cmqxxx");
  });

  it("null si format inattendu", () => {
    expect(parseObservationIdFromExternalId("manual-abc")).toBeNull();
    expect(parseObservationIdFromExternalId("nc-inv-")).toBeNull();
    expect(parseObservationIdFromExternalId(null)).toBeNull();
    expect(parseObservationIdFromExternalId("")).toBeNull();
  });
});

describe("getEquipmentLinkForAction", () => {
  it("renvoie null si action inconnue", async () => {
    findUniqueAction.mockResolvedValue(null);
    const r = await getEquipmentLinkForAction("a1");
    expect(r).toBeNull();
  });

  it("renvoie null si externalId pas au format nc-inv-...", async () => {
    findUniqueAction.mockResolvedValue({ externalId: "manual-abc" });
    const r = await getEquipmentLinkForAction("a1");
    expect(r).toBeNull();
    expect(findUniqueObservation).not.toHaveBeenCalled();
  });

  it("renvoie null si observation supprimée", async () => {
    findUniqueAction.mockResolvedValue({ externalId: "nc-inv-obs1" });
    findUniqueObservation.mockResolvedValue(null);
    const r = await getEquipmentLinkForAction("a1");
    expect(r).toBeNull();
  });

  it("renvoie null si observation sans équipement", async () => {
    findUniqueAction.mockResolvedValue({ externalId: "nc-inv-obs1" });
    findUniqueObservation.mockResolvedValue({
      discrepancyType: "EXPIRED",
      equipment: null,
    });
    const r = await getEquipmentLinkForAction("a1");
    expect(r).toBeNull();
  });

  it("happy path — extrait toutes les infos utiles", async () => {
    findUniqueAction.mockResolvedValue({ externalId: "nc-inv-obs1" });
    findUniqueObservation.mockResolvedValue({
      discrepancyType: "EXPIRED",
      equipment: {
        id: "eq1",
        label: "Extincteur N°3",
        category: "Extincteurs",
        isPerishable: true,
        expectedQuantity: 1,
        expirationDate: new Date("2025-06-23T00:00:00.000Z"),
        site: {
          id: "s1",
          name: "Loire",
          teamId: "tA",
          memberships: [{ teamId: "tA" }, { teamId: "tB" }],
        },
      },
    });
    const r = await getEquipmentLinkForAction("a1");
    expect(r).toEqual({
      equipmentId: "eq1",
      equipmentLabel: "Extincteur N°3",
      equipmentCategory: "Extincteurs",
      isPerishable: true,
      expectedQuantity: 1,
      currentExpirationDate: "2025-06-23T00:00:00.000Z",
      discrepancyType: "EXPIRED",
      siteId: "s1",
      siteName: "Loire",
      teamIds: ["tA", "tB"],
    });
  });

  it("dédup teamIds (legacy teamId + memberships)", async () => {
    findUniqueAction.mockResolvedValue({ externalId: "nc-inv-obs1" });
    findUniqueObservation.mockResolvedValue({
      discrepancyType: "MISSING",
      equipment: {
        id: "eq1",
        label: "x",
        category: "y",
        isPerishable: false,
        expectedQuantity: null,
        expirationDate: null,
        site: {
          id: "s1",
          name: "S",
          teamId: "tA",
          memberships: [{ teamId: "tA" }, { teamId: "tB" }],
        },
      },
    });
    const r = await getEquipmentLinkForAction("a1");
    expect(r?.teamIds).toEqual(["tA", "tB"]);
    expect(r?.isPerishable).toBe(false);
    expect(r?.currentExpirationDate).toBeNull();
  });
});
