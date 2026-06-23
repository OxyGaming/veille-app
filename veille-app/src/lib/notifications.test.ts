import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const create = vi.fn();
const updateMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

// Sprint Push V1 (C6) — createNotification déclenche sendPushNotification
// en fire-and-forget. On le mock pour ne pas embarquer la chaîne
// web-push + prisma.pushSubscription + featureFlags dans ces tests-ci.
const sendPushNotification = vi.fn().mockResolvedValue({
  status: "skipped",
  reason: "no-subscription",
});
vi.mock("@/lib/push/sender", () => ({
  sendPushNotification: (...a: unknown[]) => sendPushNotification(...a),
}));

vi.mock("@prisma/client", async () => {
  // On simule juste la classe d'erreur dont on a besoin
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { Prisma } from "@prisma/client";
import {
  NOTIFICATION_TYPES,
  createNotification,
  getUnreadNotificationCount,
  isKnownNotificationType,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";

beforeEach(() => {
  create.mockReset();
  updateMany.mockReset();
  count.mockReset();
  sendPushNotification.mockReset();
  sendPushNotification.mockResolvedValue({
    status: "skipped",
    reason: "no-subscription",
  });
});

// ─── Types constants ────────────────────────────────────────────────────────

describe("NOTIFICATION_TYPES + isKnownNotificationType", () => {
  it("expose les 6 types V1 (4 + 2 ajoutés Sprint Push C9)", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "ACTION_ASSIGNED_TO_ME",
      "ACTION_VALIDATED_ON_MY_ACTION",
      "VISIT_FINISHED_ON_MY_SITE",
      "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
      "TEAM_MEMBERSHIP_ADDED",
      "TEAM_HISTORY_ADDED",
    ]);
  });

  it("reconnaît les types valides", () => {
    for (const t of NOTIFICATION_TYPES) {
      expect(isKnownNotificationType(t)).toBe(true);
    }
  });

  it("refuse les types inconnus", () => {
    expect(isKnownNotificationType("FOO")).toBe(false);
    expect(isKnownNotificationType("")).toBe(false);
    expect(isKnownNotificationType("action_assigned_to_me")).toBe(false);
  });
});

// ─── createNotification ─────────────────────────────────────────────────────

describe("createNotification", () => {
  const baseInput = {
    userId: "u1",
    type: "ACTION_ASSIGNED_TO_ME" as const,
    title: "Action assignée",
    message: "Une action vous a été assignée",
  };

  it("happy path — appelle prisma.create avec les bons champs", async () => {
    const fakeRow = { id: "n1", ...baseInput, readAt: null };
    create.mockResolvedValue(fakeRow);
    const res = await createNotification({
      ...baseInput,
      targetUrl: "/agents/a1",
      dedupKey: "ACTION_ASSIGNED_TO_ME:a1",
      metadata: { actionId: "a1" },
    });
    expect(res).toBe(fakeRow);
    const arg = create.mock.calls[0][0];
    expect(arg.data).toEqual({
      userId: "u1",
      type: "ACTION_ASSIGNED_TO_ME",
      title: "Action assignée",
      message: "Une action vous a été assignée",
      targetUrl: "/agents/a1",
      dedupKey: "ACTION_ASSIGNED_TO_ME:a1",
      metadata: JSON.stringify({ actionId: "a1" }),
    });
  });

  it("sans dedupKey ni targetUrl — null par défaut", async () => {
    create.mockResolvedValue({ id: "n2" });
    await createNotification(baseInput);
    const arg = create.mock.calls[0][0];
    expect(arg.data.targetUrl).toBeNull();
    expect(arg.data.dedupKey).toBeNull();
    expect(arg.data.metadata).toBeNull();
  });

  it("dédup P2002 → renvoie null sans throw", async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await createNotification({
      ...baseInput,
      dedupKey: "ACTION_ASSIGNED_TO_ME:a1",
    });
    expect(res).toBeNull();
  });

  it("erreur Prisma autre que P2002 → renvoie null + log, pas de throw", async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Disk full", {
        code: "P9999",
        clientVersion: "test",
      }),
    );
    const res = await createNotification(baseInput);
    expect(res).toBeNull();
  });

  it("erreur générique non-Prisma → renvoie null", async () => {
    create.mockRejectedValue(new Error("Network down"));
    const res = await createNotification(baseInput);
    expect(res).toBeNull();
  });

  it("metadata est JSON.stringify(d) côté DB", async () => {
    create.mockResolvedValue({ id: "n3" });
    await createNotification({
      ...baseInput,
      metadata: { foo: "bar", nested: { x: 1 } },
    });
    const arg = create.mock.calls[0][0];
    expect(arg.data.metadata).toBe(
      JSON.stringify({ foo: "bar", nested: { x: 1 } }),
    );
  });

  // ─── Branchement push (Sprint Push V1 — C6) ─────────────────────────────

  it("succès → déclenche sendPushNotification avec les bons champs", async () => {
    const fakeRow = {
      id: "n42",
      userId: "u1",
      type: "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
      title: "T",
      message: "M",
      targetUrl: "/sites/s1",
      dedupKey: "ECHEANCE_CRITICAL_ON_MY_PERIMETER:VISIT_QUARTERLY:s1",
      readAt: null,
      createdAt: new Date(),
      metadata: null,
    };
    create.mockResolvedValue(fakeRow);
    await createNotification({
      userId: "u1",
      type: "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
      title: "T",
      message: "M",
      targetUrl: "/sites/s1",
      dedupKey: fakeRow.dedupKey,
    });
    // Permettre au fire-and-forget de tourner
    await new Promise((r) => setImmediate(r));
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification.mock.calls[0][0]).toEqual({
      userId: "u1",
      notification: {
        id: "n42",
        type: "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
        title: "T",
        message: "M",
        targetUrl: "/sites/s1",
        dedupKey: fakeRow.dedupKey,
      },
    });
  });

  it("échec dédup P2002 → ne déclenche PAS sendPushNotification", async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await createNotification(baseInput);
    await new Promise((r) => setImmediate(r));
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("erreur Prisma autre → ne déclenche PAS sendPushNotification", async () => {
    create.mockRejectedValue(new Error("DB down"));
    await createNotification(baseInput);
    await new Promise((r) => setImmediate(r));
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("createNotification ne throw PAS si sendPushNotification rejette", async () => {
    const fakeRow = { id: "n1", userId: "u1", type: "X", title: "T", message: "M", targetUrl: null, dedupKey: null, readAt: null, createdAt: new Date(), metadata: null };
    create.mockResolvedValue(fakeRow);
    sendPushNotification.mockRejectedValue(new Error("push crashed"));
    const res = await createNotification(baseInput);
    expect(res).toBe(fakeRow);
    // Laisse le fire-and-forget se résoudre (le .catch absorbe l'erreur)
    await new Promise((r) => setImmediate(r));
    // Pas d'erreur remontée — le test ne plante pas.
  });
});

// ─── markNotificationRead ───────────────────────────────────────────────────

describe("markNotificationRead", () => {
  it("happy path → updateMany(where userId+id+readAt=null), true si count=1", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const res = await markNotificationRead("u1", "n1");
    expect(res).toBe(true);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "n1", userId: "u1", readAt: null });
    expect(arg.data.readAt).toBeInstanceOf(Date);
  });

  it("renvoie false si déjà lue ou inexistante (count=0)", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const res = await markNotificationRead("u1", "n1");
    expect(res).toBe(false);
  });

  it("renvoie false si user pas destinataire (filtré par updateMany)", async () => {
    // En pratique, le where exclut les notifs des autres users → count 0
    updateMany.mockResolvedValue({ count: 0 });
    const res = await markNotificationRead("intrus", "n1");
    expect(res).toBe(false);
  });
});

// ─── markAllNotificationsRead ───────────────────────────────────────────────

describe("markAllNotificationsRead", () => {
  it("retourne le count de rows mises à jour", async () => {
    updateMany.mockResolvedValue({ count: 7 });
    const res = await markAllNotificationsRead("u1");
    expect(res).toBe(7);
  });

  it("scope par userId — pas d'effet de bord cross-user", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await markAllNotificationsRead("u1");
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: "u1", readAt: null });
    expect(arg.data.readAt).toBeInstanceOf(Date);
  });
});

// ─── getUnreadNotificationCount ─────────────────────────────────────────────

describe("getUnreadNotificationCount", () => {
  it("compte les non lues du user", async () => {
    count.mockResolvedValue(3);
    const n = await getUnreadNotificationCount("u1");
    expect(n).toBe(3);
    expect(count.mock.calls[0][0].where).toEqual({
      userId: "u1",
      readAt: null,
    });
  });
});
