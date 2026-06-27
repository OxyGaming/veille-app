import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/auth";
import {
  expandActiveSiblingIds,
  type ActionKeyRow,
  type ExpandClient,
} from "./group-expansion";

// ── Utilisateurs de test ────────────────────────────────────────────────────
const EDITOR: SessionUser = {
  id: "u_editor",
  email: "editor@x",
  name: "Ed",
  role: "EDITOR",
  teamId: "tA",
  teamIds: ["tA"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const ADMIN_ALL: SessionUser = {
  ...EDITOR,
  id: "u_admin",
  email: "admin@x",
  role: "ADMIN",
  viewAllTeams: true,
};

const NO_TEAM: SessionUser = {
  ...EDITOR,
  id: "u_noteam",
  email: "noteam@x",
  role: "EDITOR",
  teamIds: [],
  viewAllTeams: false,
};

// ── Fabrique de client Prisma factice ───────────────────────────────────────
function makeClient(rows: ActionKeyRow[]) {
  const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => rows);
  const client = {
    importedAction: { findMany },
  } as unknown as ExpandClient;
  return { client, findMany };
}

// Ligne ACTIVE de base, agent ag1, équipe tA, hash h1.
const anchor: ActionKeyRow = {
  id: "a1",
  teamId: "tA",
  agentId: "ag1",
  siteId: null,
  vehicleId: null,
  dedupHash: "h1",
  localStatus: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expandActiveSiblingIds — expansion du groupe", () => {
  it("ancre ACTIVE + siblings même clé → groupe complet (inclut l'ancre)", async () => {
    const siblings: ActionKeyRow[] = [
      { ...anchor, id: "a1" },
      { ...anchor, id: "a2" },
      { ...anchor, id: "a3" },
    ];
    const { client, findMany } = makeClient(siblings);
    const ids = await expandActiveSiblingIds(client, [anchor], EDITOR);
    expect(ids.sort()).toEqual(["a1", "a2", "a3"]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("dedupHash null → pas d'expansion, aucune requête siblings", async () => {
    const { client, findMany } = makeClient([]);
    const lone = { ...anchor, dedupHash: null };
    const ids = await expandActiveSiblingIds(client, [lone], EDITOR);
    expect(ids).toEqual(["a1"]);
    // Aucune clé voulue → pas de findMany.
    expect(findMany).not.toHaveBeenCalled();
  });

  it("statut non ACTIVE (REPLACED/OBSOLETE) → pas d'expansion, ancre exclue", async () => {
    const { client, findMany } = makeClient([]);
    const replaced = { ...anchor, localStatus: "REPLACED" };
    const obsolete = { ...anchor, id: "a2", localStatus: "OBSOLETE" };
    const ids = await expandActiveSiblingIds(
      client,
      [replaced, obsolete],
      EDITOR,
    );
    expect(ids).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("même dedupHash mais AUTRE équipe → exclu (clé de groupe distincte)", async () => {
    // La requête superset peut remonter une ligne d'une autre équipe partageant
    // le hash ; le re-filtrage par clé EXACTE (qui inclut teamId) l'exclut.
    const otherTeam: ActionKeyRow = {
      ...anchor,
      id: "a2",
      teamId: "tB",
    };
    const { client } = makeClient([anchor, otherTeam]);
    const ids = await expandActiveSiblingIds(client, [anchor], EDITOR);
    expect(ids).toEqual(["a1"]);
  });

  it("même dedupHash mais AUTRE agent → exclu (cible distincte)", async () => {
    const otherAgent: ActionKeyRow = {
      ...anchor,
      id: "a2",
      agentId: "ag2",
    };
    const { client } = makeClient([anchor, otherAgent]);
    const ids = await expandActiveSiblingIds(client, [anchor], EDITOR);
    expect(ids).toEqual(["a1"]);
  });

  it("même dedupHash mais AUTRE site → exclu (cible distincte)", async () => {
    const siteAnchor: ActionKeyRow = {
      ...anchor,
      id: "s1",
      agentId: null,
      siteId: "site1",
    };
    const otherSite: ActionKeyRow = {
      ...siteAnchor,
      id: "s2",
      siteId: "site2",
    };
    const { client } = makeClient([siteAnchor, otherSite]);
    const ids = await expandActiveSiblingIds(client, [siteAnchor], EDITOR);
    expect(ids).toEqual(["s1"]);
  });

  it("siblings remontés mais non-ACTIVE filtrés par la requête (where ACTIVE)", async () => {
    // La requête impose localStatus ACTIVE ; on vérifie le where.
    const { client, findMany } = makeClient([anchor]);
    await expandActiveSiblingIds(client, [anchor], EDITOR);
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where;
    expect(where.localStatus).toBe("ACTIVE");
    expect(where.dedupHash).toEqual({ in: ["h1"] });
    expect(where.teamId).toEqual({ in: ["tA"] });
  });
});

describe("expandActiveSiblingIds — scope utilisateur", () => {
  it("EDITOR : teamScope strict appliqué à la requête siblings", async () => {
    const { client, findMany } = makeClient([anchor]);
    await expandActiveSiblingIds(client, [anchor], EDITOR);
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where;
    // teamScope(EDITOR) = { teamId: { in: ["tA"] } } — fusionné dans le where.
    // (Ici teamId du superset coïncide avec le scope ; la garde reste présente.)
    expect(where.teamId).toEqual({ in: ["tA"] });
  });

  it("utilisateur sans équipe → scope __none__ fusionné (aucun sibling)", async () => {
    // teamScope(NO_TEAM) = { teamId: "__none__" } écrase le filtre superset :
    // la requête ne peut remonter aucune ligne.
    const { client, findMany } = makeClient([]);
    const ids = await expandActiveSiblingIds(client, [anchor], NO_TEAM);
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where;
    expect(where.teamId).toBe("__none__");
    // L'ancre elle-même reste présente (déjà chargée + scopée par l'appelant).
    expect(ids).toEqual(["a1"]);
  });

  it("ADMIN viewAllTeams : teamScope vide, expansion par (équipe+hash+clé)", async () => {
    const siblings: ActionKeyRow[] = [anchor, { ...anchor, id: "a2" }];
    const { client, findMany } = makeClient(siblings);
    const ids = await expandActiveSiblingIds(client, [anchor], ADMIN_ALL);
    expect(ids.sort()).toEqual(["a1", "a2"]);
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where;
    // teamScope(ADMIN viewAllTeams) = {} → pas de surcharge teamId hors superset.
    expect(where.teamId).toEqual({ in: ["tA"] });
  });
});

describe("expandActiveSiblingIds — multi-ancres", () => {
  it("plusieurs ancres de groupes distincts → union des deux groupes", async () => {
    const anchorB: ActionKeyRow = {
      id: "b1",
      teamId: "tA",
      agentId: "ag9",
      siteId: null,
      vehicleId: null,
      dedupHash: "h9",
      localStatus: "ACTIVE",
    };
    const rows: ActionKeyRow[] = [
      anchor,
      { ...anchor, id: "a2" },
      anchorB,
      { ...anchorB, id: "b2" },
    ];
    const { client, findMany } = makeClient(rows);
    const ids = await expandActiveSiblingIds(client, [anchor, anchorB], EDITOR);
    expect(ids.sort()).toEqual(["a1", "a2", "b1", "b2"]);
    // Requête superset bornée aux 2 hash et l'équipe commune.
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where;
    expect((where.dedupHash as { in: string[] }).in.sort()).toEqual(["h1", "h9"]);
  });

  it("ancre ACTIVE sans hash + ancre ACTIVE avec hash → la 1re reste seule", async () => {
    const lone = { ...anchor, id: "x1", dedupHash: null };
    const rows: ActionKeyRow[] = [anchor, { ...anchor, id: "a2" }];
    const { client } = makeClient(rows);
    const ids = await expandActiveSiblingIds(client, [lone, anchor], EDITOR);
    expect(ids.sort()).toEqual(["a1", "a2", "x1"]);
  });
});
