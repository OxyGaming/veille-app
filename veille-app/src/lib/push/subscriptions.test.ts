import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const del = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
      delete: (...a: unknown[]) => del(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import {
  hashEndpoint,
  removeSubscriptionForUser,
  upsertSubscription,
} from "./subscriptions";

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  del.mockReset();
  deleteMany.mockReset();
});

describe("upsertSubscription", () => {
  const base = {
    userId: "u1",
    endpoint: "https://fcm.googleapis.com/abc",
    p256dh: "p256",
    auth: "auth",
    platform: "android",
    userAgent: "Mozilla/5.0",
  };

  it("crée si endpoint inconnu", async () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
    await upsertSubscription(base);
    expect(del).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ endpoint: base.endpoint });
    expect(arg.create.userId).toBe("u1");
    expect(arg.create.endpoint).toBe(base.endpoint);
    expect(arg.create.p256dh).toBe("p256");
    expect(arg.create.auth).toBe("auth");
    expect(arg.create.platform).toBe("android");
  });

  it("update si endpoint existe pour le même user — userId absent du payload update", async () => {
    findUnique.mockResolvedValue({ id: "s1", userId: "u1" });
    upsert.mockResolvedValue({});
    await upsertSubscription(base);
    expect(del).not.toHaveBeenCalled();
    const arg = upsert.mock.calls[0][0];
    expect(arg.update.userId).toBeUndefined();
    expect(arg.update.p256dh).toBe("p256");
    expect(arg.update.lastErrorAt).toBeNull();
    expect(arg.update.lastErrorCode).toBeNull();
  });

  it("réassigne (delete + create) si endpoint appartenait à un autre user", async () => {
    findUnique.mockResolvedValue({ id: "s1", userId: "u2" });
    upsert.mockResolvedValue({});
    await upsertSubscription(base);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.mock.calls[0][0].where).toEqual({ id: "s1" });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].create.userId).toBe("u1");
  });

  it("platform et userAgent null si absents", async () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
    await upsertSubscription({
      userId: "u1",
      endpoint: "x",
      p256dh: "p",
      auth: "a",
    });
    const arg = upsert.mock.calls[0][0];
    expect(arg.create.platform).toBeNull();
    expect(arg.create.userAgent).toBeNull();
  });
});

describe("removeSubscriptionForUser", () => {
  it("delete scope strict — where contient userId et endpoint", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const ok = await removeSubscriptionForUser("u1", "https://x/y");
    expect(ok).toBe(true);
    expect(deleteMany.mock.calls[0][0].where).toEqual({
      endpoint: "https://x/y",
      userId: "u1",
    });
  });

  it("idempotent — count 0 → false (pas de throw)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const ok = await removeSubscriptionForUser("u1", "absent");
    expect(ok).toBe(false);
  });

  it("ne supprime pas l'abonnement d'un autre user (filtré par where)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const ok = await removeSubscriptionForUser("u-intrus", "endpoint-de-u1");
    expect(ok).toBe(false);
    expect(deleteMany.mock.calls[0][0].where.userId).toBe("u-intrus");
  });
});

describe("hashEndpoint", () => {
  it("déterministe — même input → même output", () => {
    expect(hashEndpoint("abc")).toBe(hashEndpoint("abc"));
  });

  it("16 chars hex tronqué", () => {
    const h = hashEndpoint("https://fcm.googleapis.com/abc");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("ne contient pas l'endpoint en clair", () => {
    const endpoint = "https://fcm.googleapis.com/super-secret-abc-123";
    const h = hashEndpoint(endpoint);
    expect(h).not.toContain("super-secret");
    expect(h).not.toContain("googleapis");
  });
});
