import { beforeEach, describe, expect, it, vi } from "vitest";

const findManySiteVisit = vi.fn();
const findManyVeilleSession = vi.fn();
const findManyActionValidation = vi.fn();
const findManyAgentSighting = vi.fn();
const findManySiteSighting = vi.fn();
const findManyVehicleRound = vi.fn();
const findManyIcareEntry = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteVisit: { findMany: (...a: unknown[]) => findManySiteVisit(...a) },
    veilleSession: { findMany: (...a: unknown[]) => findManyVeilleSession(...a) },
    actionValidation: {
      findMany: (...a: unknown[]) => findManyActionValidation(...a),
    },
    agentSighting: { findMany: (...a: unknown[]) => findManyAgentSighting(...a) },
    siteSighting: { findMany: (...a: unknown[]) => findManySiteSighting(...a) },
    vehicleRound: { findMany: (...a: unknown[]) => findManyVehicleRound(...a) },
    icareEntry: { findMany: (...a: unknown[]) => findManyIcareEntry(...a) },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u1", role: "USER", teamIds: ["tA"] })),
  teamScope: () => ({ teamId: { in: ["tA"] } }),
}));

import { GET } from "./route";

function req(qs: string) {
  return new Request(`http://localhost/api/history?${qs}`);
}

beforeEach(() => {
  for (const fn of [
    findManySiteVisit,
    findManyVeilleSession,
    findManyActionValidation,
    findManyAgentSighting,
    findManySiteSighting,
    findManyVehicleRound,
    findManyIcareEntry,
  ]) {
    fn.mockReset();
    fn.mockResolvedValue([]);
  }
});

function siteVisitRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: over.id ?? "v1",
    visitDate: over.visitDate ?? new Date("2026-07-10T10:00:00Z"),
    siteId: "s1",
    status: "completed",
    observer: { name: "Alice" },
    template: { name: "Trimestrielle" },
    site: { id: "s1", name: "Site A", code: "A1" },
    _count: { nonConformities: 0 },
    ...over,
  };
}

describe("GET /api/history — filtre Icare poussé en SQL", () => {
  it("icare=true : id IN [...] pour visit (SiteVisit + VehicleRound partagent le refType)", async () => {
    findManyIcareEntry.mockResolvedValue([
      { refType: "visit", refId: "v1" },
      { refType: "visit", refId: "v2" },
    ]);
    await GET(req("type=visit&icare=true"));

    const visitArgs = findManySiteVisit.mock.calls[0][0];
    expect(visitArgs.where.id).toEqual({ in: ["v1", "v2"] });
    const roundArgs = findManyVehicleRound.mock.calls[0][0];
    expect(roundArgs.where.id).toEqual({ in: ["v1", "v2"] });
  });

  it("icare=false : id NOT IN [...]", async () => {
    findManyIcareEntry.mockResolvedValue([{ refType: "visit", refId: "v1" }]);
    await GET(req("type=visit&icare=false"));

    const visitArgs = findManySiteVisit.mock.calls[0][0];
    expect(visitArgs.where.id).toEqual({ notIn: ["v1"] });
  });

  it("icare=all : aucun filtre id, et IcareEntry n'est pas interrogé pour le préfiltrage", async () => {
    await GET(req("type=visit&icare=all"));
    const visitArgs = findManySiteVisit.mock.calls[0][0];
    expect(visitArgs.where.id).toBeUndefined();
    expect(findManyIcareEntry).not.toHaveBeenCalled();
  });

  it("sighting : sépare les refType 'sighting' et 'note' selon `kind`", async () => {
    findManyIcareEntry.mockResolvedValue([
      { refType: "sighting", refId: "sg-done" },
      { refType: "note", refId: "note-done" },
    ]);
    await GET(req("type=sighting&icare=true"));

    const args = findManyAgentSighting.mock.calls[0][0];
    expect(args.where.AND).toContainEqual({
      OR: [
        { kind: "NOTE", id: { in: ["note-done"] } },
        { kind: { not: "NOTE" }, id: { in: ["sg-done"] } },
      ],
    });
  });

  it("hydrate icareDone sur la page retournée même quand icare=all", async () => {
    findManySiteVisit.mockResolvedValue([siteVisitRow()]);
    findManyIcareEntry.mockResolvedValue([{ refType: "visit", refId: "v1" }]);
    const res = await GET(req("type=visit&icare=all"));
    const json = await res.json();
    expect(json.entries[0].icareDone).toBe(true);
  });
});

describe("GET /api/history — pagination par curseur", () => {
  it("hasMore=true et nextCursor défini quand une source renvoie plus que `take`", async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      siteVisitRow({
        id: `v${21 - i}`,
        visitDate: new Date(2026, 6, 21 - i, 10, 0, 0),
      }),
    );
    findManySiteVisit.mockResolvedValue(rows);
    const res = await GET(req("type=visit&take=20"));
    const json = await res.json();
    expect(json.entries).toHaveLength(20);
    expect(json.hasMore).toBe(true);
    expect(typeof json.nextCursor).toBe("string");
    // Requête chacune des sources avec take+1.
    expect(findManySiteVisit.mock.calls[0][0].take).toBe(21);
  });

  it("take en dessous du minimum autorisé (20) est clampé", async () => {
    await GET(req("type=visit&take=5"));
    expect(findManySiteVisit.mock.calls[0][0].take).toBe(21); // (20 + 1)
  });

  it("hasMore=false quand le total fusionné est ≤ take", async () => {
    findManySiteVisit.mockResolvedValue([siteVisitRow()]);
    const res = await GET(req("type=visit&take=20"));
    const json = await res.json();
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("le curseur de page 2 filtre bien sur (at, id) < dernier élément de page 1", async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      siteVisitRow({
        id: `v${21 - i}`,
        visitDate: new Date(2026, 6, 21 - i, 10, 0, 0),
      }),
    );
    findManySiteVisit.mockResolvedValue(rows);
    const page1 = await (await GET(req("type=visit&take=20"))).json();
    const lastOfPage1 = page1.entries[page1.entries.length - 1];

    findManySiteVisit.mockClear();
    findManySiteVisit.mockResolvedValue([]);
    await GET(req(`type=visit&take=20&cursor=${page1.nextCursor}`));

    const args = findManySiteVisit.mock.calls[0][0];
    expect(args.where.AND).toContainEqual({
      OR: [
        { visitDate: { lt: new Date(lastOfPage1.at) } },
        { visitDate: new Date(lastOfPage1.at), id: { lt: lastOfPage1.id } },
      ],
    });
  });

  it("pas de doublon entre page 1 et page 2 sur un jeu de données réel", async () => {
    const all = Array.from({ length: 25 }, (_, i) =>
      siteVisitRow({
        id: `v${25 - i}`,
        visitDate: new Date(2026, 6, 25 - i, 10, 0, 0),
      }),
    );
    findManySiteVisit.mockImplementation(async (args: { where: { AND?: unknown[] } }) => {
      const cursorAnd = args.where.AND?.find(
        (c): c is { OR: [{ visitDate: { lt: Date } }, unknown] } =>
          !!c &&
          typeof c === "object" &&
          "OR" in c &&
          Array.isArray((c as { OR: unknown[] }).OR) &&
          "visitDate" in (c as { OR: [{ visitDate?: unknown }] }).OR[0],
      );
      if (!cursorAnd) return all;
      const cutoff = cursorAnd.OR[0].visitDate.lt as Date;
      return all.filter((r) => r.visitDate < cutoff);
    });

    const page1 = await (await GET(req("type=visit&take=20"))).json();
    expect(page1.entries).toHaveLength(20);
    expect(page1.hasMore).toBe(true);

    const page2 = await (
      await GET(req(`type=visit&take=20&cursor=${page1.nextCursor}`))
    ).json();
    expect(page2.entries).toHaveLength(5);
    expect(page2.hasMore).toBe(false);

    const ids1 = page1.entries.map((e: { id: string }) => e.id);
    const ids2 = page2.entries.map((e: { id: string }) => e.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(25);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });
});

describe("GET /api/history — cloisonnement", () => {
  it("teamScope(u) est appliqué à chaque source active", async () => {
    await GET(req("type=visit,session,validation,sighting"));
    for (const spy of [
      findManySiteVisit,
      findManyVeilleSession,
      findManyActionValidation,
      findManyAgentSighting,
      findManySiteSighting,
      findManyVehicleRound,
    ]) {
      const args = spy.mock.calls[0][0];
      expect(args.where.teamId).toEqual({ in: ["tA"] });
    }
  });
});
