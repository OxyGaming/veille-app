import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks Prisma ────────────────────────────────────────────────────────────
const findMany = vi.fn();
const count = vi.fn();
const teamFindMany = vi.fn(
  async (..._a: unknown[]) => [] as { id: string; name: string }[],
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importedAction: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
    team: { findMany: (...a: unknown[]) => teamFindMany(...a) },
  },
}));

// teamScope neutralisé (= admin global, aucune restriction) pour isoler la
// logique de dédup ; son comportement de scope est couvert ailleurs.
vi.mock("@/lib/auth", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...real, teamScope: () => ({}) };
});

import type { SessionUser } from "@/lib/auth";
import {
  aggregateAdminActions,
  type AdminActionsFilters,
} from "./admin-actions-aggregator";

const ADMIN: SessionUser = {
  id: "u_admin",
  email: "admin@x",
  name: "Admin",
  role: "ADMIN",
  teamId: "t1",
  teamIds: ["t1"],
  viewAllTeams: true,
  adminScopeMode: "GLOBAL",
  adminTeamId: null,
};

const ALL_FILTERS: AdminActionsFilters = {
  status: "all",
  teamId: null,
  agentId: null,
  siteId: null,
  late: false,
  q: null,
};

// Périmètre filtré : 5 occurrences → 3 actions logiques.
//  - Groupe A : agent ag1 / t1 / hash h1 → 3 occurrences (a1,a2,a3)
//  - Groupe B : agent ag2 / t1 / hash h2 → 1 occurrence  (b1)
//  - Groupe C : site s1 / t1 / dedupHash null → 1 occurrence (c1, seule)
const keyRows = [
  { id: "a1", teamId: "t1", agentId: "ag1", siteId: null, vehicleId: null, dedupHash: "h1", localStatus: "ACTIVE" },
  { id: "a2", teamId: "t1", agentId: "ag1", siteId: null, vehicleId: null, dedupHash: "h1", localStatus: "ACTIVE" },
  { id: "a3", teamId: "t1", agentId: "ag1", siteId: null, vehicleId: null, dedupHash: "h1", localStatus: "ACTIVE" },
  { id: "b1", teamId: "t1", agentId: "ag2", siteId: null, vehicleId: null, dedupHash: "h2", localStatus: "ACTIVE" },
  { id: "c1", teamId: "t1", agentId: null, siteId: "s1", vehicleId: null, dedupHash: null, localStatus: "ACTIVE" },
];

// Page affichée : 1 représentant par groupe (occurrences brutes, non fusionnées).
function listRow(over: Partial<Record<string, unknown>>) {
  return {
    id: "a1",
    externalId: "EXT-a1",
    localStatus: "ACTIVE",
    keyPoint: null,
    comment: "Action a1",
    dueAt: null as Date | null,
    teamId: "t1",
    agentId: "ag1",
    siteId: null,
    vehicleId: null,
    dedupHash: "h1",
    tags: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    team: { name: "Équipe 1" },
    agent: { firstName: "Jean", lastName: "Dupont" },
    site: null,
    ...over,
  };
}

const listRows = [
  listRow({ id: "a1", externalId: "EXT-a1", agentId: "ag1", dedupHash: "h1" }),
  listRow({ id: "b1", externalId: "EXT-b1", agentId: "ag2", dedupHash: "h2", comment: "Action b1" }),
  listRow({
    id: "c1",
    externalId: "EXT-c1",
    agentId: null,
    siteId: "s1",
    dedupHash: null,
    comment: "Action c1",
    agent: null,
    site: { name: "Site 1" },
  }),
];

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  teamFindMany.mockClear();
  // La requête LISTE porte un orderBy ; la requête CLÉ (périmètre) n'en a pas.
  findMany.mockImplementation(async (arg: { orderBy?: unknown }) =>
    arg.orderBy ? listRows : keyRows,
  );
  count.mockResolvedValue(5);
});

describe("aggregateAdminActions — option B (Lot 4B-4)", () => {
  it("total reste BRUT (count d'occurrences), logicalTotal = nb de groupes", async () => {
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS);
    expect(payload.total).toBe(5); // total brut inchangé
    expect(payload.logicalTotal).toBe(3); // A + B + C
  });

  it("occurrenceCount par ligne = taille du groupe sur le PÉRIMÈTRE (pas la page)", async () => {
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS);
    const byId = new Map(payload.items.map((i) => [i.id, i.occurrenceCount]));
    // a1 n'apparaît qu'une fois dans la page, mais son groupe a 3 occurrences.
    expect(byId.get("a1")).toBe(3);
    expect(byId.get("b1")).toBe(1);
    expect(byId.get("c1")).toBe(1); // dedupHash null → toujours seule
  });

  it("la liste reste en occurrences brutes (1 ligne par item, pas de fusion)", async () => {
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS);
    expect(payload.items).toHaveLength(3);
    expect(payload.items.map((i) => i.id)).toEqual(["a1", "b1", "c1"]);
  });

  it("dedupHash null → reste une action logique distincte (jamais regroupée)", async () => {
    // c1 (hash null) ne doit jamais fusionner avec une autre, même cible/équipe.
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS);
    expect(payload.items.find((i) => i.id === "c1")?.occurrenceCount).toBe(1);
  });

  it("aucun doublon (1 occurrence/groupe) → logicalTotal == total", async () => {
    const singles = [
      { id: "x1", teamId: "t1", agentId: "ag1", siteId: null, vehicleId: null, dedupHash: "hx", localStatus: "ACTIVE" },
      { id: "y1", teamId: "t1", agentId: "ag2", siteId: null, vehicleId: null, dedupHash: "hy", localStatus: "ACTIVE" },
    ];
    findMany.mockImplementation(async (arg: { orderBy?: unknown }) =>
      arg.orderBy ? [listRow({ id: "x1", externalId: "EXT-x1", dedupHash: "hx" })] : singles,
    );
    count.mockResolvedValue(2);
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS);
    expect(payload.total).toBe(2);
    expect(payload.logicalTotal).toBe(2);
    expect(payload.items[0].occurrenceCount).toBe(1);
  });
});

describe("aggregateAdminActions — pagination inchangée", () => {
  it("take = limit + 1 et nextCursor dérivé du dernier item de la page", async () => {
    // 3 lignes renvoyées avec limit 2 → hasMore, nextCursor = id de la 2e.
    findMany.mockImplementation(async (arg: { orderBy?: unknown }) =>
      arg.orderBy
        ? [
            listRow({ id: "a1", externalId: "EXT-a1" }),
            listRow({ id: "b1", externalId: "EXT-b1", agentId: "ag2", dedupHash: "h2" }),
            listRow({ id: "a2", externalId: "EXT-a2" }),
          ]
        : keyRows,
    );
    const payload = await aggregateAdminActions(ADMIN, ALL_FILTERS, { limit: 2 });
    // take demandé = limit + 1.
    const listCall = findMany.mock.calls.find(
      (c) => (c[0] as { orderBy?: unknown }).orderBy,
    );
    expect((listCall![0] as { take: number }).take).toBe(3);
    // Page tronquée à limit, nextCursor = dernier visible.
    expect(payload.items.map((i) => i.id)).toEqual(["a1", "b1"]);
    expect(payload.nextCursor).toBe("b1");
  });

  it("cursor passé → cursor + skip:1 dans la requête liste (périmètre clé sans cursor)", async () => {
    await aggregateAdminActions(ADMIN, ALL_FILTERS, { cursor: "a1" });
    const calls = findMany.mock.calls;
    const listCall = calls.find((c) => (c[0] as { orderBy?: unknown }).orderBy);
    const keyCall = calls.find((c) => !(c[0] as { orderBy?: unknown }).orderBy);
    expect(listCall![0]).toMatchObject({ cursor: { id: "a1" }, skip: 1 });
    // La requête de périmètre logique n'est PAS paginée (compte tout le filtré).
    expect((keyCall![0] as Record<string, unknown>).cursor).toBeUndefined();
    expect((keyCall![0] as Record<string, unknown>).take).toBeUndefined();
  });

  it("liste et périmètre logique partagent le MÊME where (cohérence du filtre)", async () => {
    await aggregateAdminActions(ADMIN, { ...ALL_FILTERS, status: "ACTIVE" });
    const calls = findMany.mock.calls;
    const listWhere = (calls.find((c) => (c[0] as { orderBy?: unknown }).orderBy)![0] as { where: unknown }).where;
    const keyWhere = (calls.find((c) => !(c[0] as { orderBy?: unknown }).orderBy)![0] as { where: unknown }).where;
    expect(keyWhere).toEqual(listWhere);
    expect(listWhere).toMatchObject({ localStatus: "ACTIVE" });
  });
});
