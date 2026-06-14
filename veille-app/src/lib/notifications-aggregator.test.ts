import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

import {
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_LIMIT,
  aggregateNotifications,
} from "./notifications-aggregator";

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
});

function mkRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "n1",
    userId: "u1",
    type: "ACTION_ASSIGNED_TO_ME",
    title: "Titre",
    message: "Msg",
    targetUrl: "/agents/x",
    readAt: null,
    createdAt: new Date("2026-06-14T10:00:00Z"),
    dedupKey: null,
    metadata: null,
    ...over,
  };
}

describe("aggregateNotifications — assemblage", () => {
  it("fan-out parallèle findMany + count", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(3);
    const out = await aggregateNotifications("u1");
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    expect(out).toEqual({
      unreadCount: 3,
      items: [],
      nextCursor: null,
      filtersApplied: { filter: "all" },
    });
  });

  it("scope strict par userId sur les deux requêtes", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await aggregateNotifications("u1");
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(count.mock.calls[0][0].where).toEqual({
      userId: "u1",
      readAt: null,
    });
  });
});

describe("aggregateNotifications — filtres", () => {
  beforeEach(() => count.mockResolvedValue(0));

  it("filter=unread → where.readAt: null", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1", { filter: "unread" });
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: "u1",
      readAt: null,
    });
  });

  it("filter=read → where.readAt: { not: null }", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1", { filter: "read" });
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: "u1",
      readAt: { not: null },
    });
  });

  it("filter=all (défaut) → pas de filtre readAt", async () => {
    findMany.mockResolvedValue([]);
    const out = await aggregateNotifications("u1", { filter: "all" });
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(out.filtersApplied).toEqual({ filter: "all" });
  });
});

describe("aggregateNotifications — pagination cursor", () => {
  beforeEach(() => count.mockResolvedValue(0));

  it("sans cursor : pas de skip ni cursor passé à Prisma", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1");
    const arg = findMany.mock.calls[0][0];
    expect(arg.skip).toBeUndefined();
    expect(arg.cursor).toBeUndefined();
  });

  it("avec cursor : cursor + skip:1 passés à Prisma", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1", { cursor: "n42" });
    const arg = findMany.mock.calls[0][0];
    expect(arg.cursor).toEqual({ id: "n42" });
    expect(arg.skip).toBe(1);
  });

  it("hasMore=false → nextCursor=null", async () => {
    findMany.mockResolvedValue([mkRow({ id: "a" }), mkRow({ id: "b" })]);
    const out = await aggregateNotifications("u1", { limit: 5 });
    expect(out.nextCursor).toBeNull();
    expect(out.items).toHaveLength(2);
  });

  it("hasMore=true → nextCursor = dernier id de la slice", async () => {
    // limit=2, on retourne 3 rows pour simuler `take=3 (limit+1)`.
    findMany.mockResolvedValue([
      mkRow({ id: "a" }),
      mkRow({ id: "b" }),
      mkRow({ id: "c" }),
    ]);
    const out = await aggregateNotifications("u1", { limit: 2 });
    expect(out.items).toHaveLength(2);
    expect(out.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.nextCursor).toBe("b");
  });

  it("limit clampé à [1, MAX]", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1", { limit: 0 });
    expect(findMany.mock.calls[0][0].take).toBe(1 + 1); // limit=1 → take=2
    findMany.mockClear();
    await aggregateNotifications("u1", { limit: 999 });
    expect(findMany.mock.calls[0][0].take).toBe(
      MAX_NOTIFICATION_LIMIT + 1,
    );
  });

  it("limit non fourni → DEFAULT_NOTIFICATION_LIMIT", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1");
    expect(findMany.mock.calls[0][0].take).toBe(
      DEFAULT_NOTIFICATION_LIMIT + 1,
    );
  });
});

describe("aggregateNotifications — tri", () => {
  beforeEach(() => count.mockResolvedValue(0));

  it("orderBy createdAt desc puis id desc (stabilité)", async () => {
    findMany.mockResolvedValue([]);
    await aggregateNotifications("u1");
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });
});

describe("aggregateNotifications — mapping item", () => {
  it("createdAt et readAt formatés en ISO", async () => {
    const at = new Date("2026-06-14T10:00:00.000Z");
    findMany.mockResolvedValue([
      mkRow({
        id: "a",
        createdAt: at,
        readAt: new Date("2026-06-14T12:00:00.000Z"),
      }),
    ]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].createdAt).toBe(at.toISOString());
    expect(out.items[0].readAt).toBe("2026-06-14T12:00:00.000Z");
  });

  it("readAt null reste null", async () => {
    findMany.mockResolvedValue([mkRow({ readAt: null })]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].readAt).toBeNull();
  });

  it("metadata JSON parsé en objet", async () => {
    findMany.mockResolvedValue([
      mkRow({ metadata: JSON.stringify({ foo: "bar", n: 1 }) }),
    ]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].metadata).toEqual({ foo: "bar", n: 1 });
  });

  it("metadata invalide → null sans throw", async () => {
    findMany.mockResolvedValue([mkRow({ metadata: "{not json" })]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].metadata).toBeNull();
  });

  it("metadata est un array → null (forme attendue = objet)", async () => {
    findMany.mockResolvedValue([
      mkRow({ metadata: JSON.stringify([1, 2, 3]) }),
    ]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].metadata).toBeNull();
  });

  it("metadata absent → null", async () => {
    findMany.mockResolvedValue([mkRow({ metadata: null })]);
    count.mockResolvedValue(0);
    const out = await aggregateNotifications("u1");
    expect(out.items[0].metadata).toBeNull();
  });
});

describe("aggregateNotifications — unreadCount", () => {
  it("reflète le total non-lues du user, indépendant du filtre", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(7);
    const out = await aggregateNotifications("u1", { filter: "read" });
    // filter=read mais unreadCount = total non-lues
    expect(out.unreadCount).toBe(7);
    expect(count.mock.calls[0][0].where).toEqual({
      userId: "u1",
      readAt: null,
    });
  });
});
