import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import { getOrCreatePreference, updatePreference } from "./preferences";

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
});

describe("getOrCreatePreference", () => {
  it("renvoie l'existante si trouvée", async () => {
    findUnique.mockResolvedValue({
      pushEnabled: true,
      catEcheances: false,
      catEquipes: true,
    });
    const pref = await getOrCreatePreference("u1");
    expect(pref).toEqual({
      pushEnabled: true,
      catEcheances: false,
      catEquipes: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("crée lazy avec les défauts du schéma si absente", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    const pref = await getOrCreatePreference("u1");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual({ userId: "u1" });
    expect(pref).toEqual({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
  });

  it("select n'expose que les 3 champs publics", async () => {
    findUnique.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    await getOrCreatePreference("u1");
    expect(findUnique.mock.calls[0][0].select).toEqual({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
  });
});

describe("updatePreference", () => {
  it("garantit l'existence puis applique le patch", async () => {
    findUnique.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    update.mockResolvedValue({
      pushEnabled: false,
      catEcheances: true,
      catEquipes: true,
    });
    const pref = await updatePreference("u1", { pushEnabled: false });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(update.mock.calls[0][0].data).toEqual({ pushEnabled: false });
    expect(pref.pushEnabled).toBe(false);
  });

  it("crée d'abord la row si absente, puis update", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    update.mockResolvedValue({
      pushEnabled: true,
      catEcheances: false,
      catEquipes: true,
    });
    await updatePreference("u1", { catEcheances: false });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("patch vide → update appelé avec data:{}", async () => {
    findUnique.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    update.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    await updatePreference("u1", {});
    expect(update.mock.calls[0][0].data).toEqual({});
  });
});
