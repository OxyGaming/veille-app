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
});

// ─── Types constants ────────────────────────────────────────────────────────

describe("NOTIFICATION_TYPES + isKnownNotificationType", () => {
  it("expose exactement les 4 types V1", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "ACTION_ASSIGNED_TO_ME",
      "ACTION_VALIDATED_ON_MY_ACTION",
      "VISIT_FINISHED_ON_MY_SITE",
      "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
    ]);
  });

  it("reconnaît les 4 types valides", () => {
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
