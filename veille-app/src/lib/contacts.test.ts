import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findMany: (...a: unknown[]) => findMany(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));

import { contactCreateSchema, createContact } from "./contacts";

beforeEach(() => {
  findMany.mockReset();
  create.mockReset();
  findMany.mockResolvedValue([]);
  create.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: "c-new",
    ...(data as object),
  }));
});

const USER_TEAM_A: SessionUser = {
  id: "u1",
  email: "u@x",
  name: "User",
  role: "USER",
  teamId: "tA",
  teamIds: ["tA"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const ADMIN_GLOBAL: SessionUser = {
  ...USER_TEAM_A,
  id: "u-admin",
  role: "ADMIN",
  teamIds: [],
};

describe("createContact — autorisation", () => {
  it("autorise la création pour une équipe du périmètre de l'utilisateur", async () => {
    const result = await createContact(
      USER_TEAM_A,
      contactCreateSchema.parse({ name: "Jean Dupont", teamId: "tA" }),
    );
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });

  it("refuse la création pour une équipe hors périmètre (403)", async () => {
    const result = await createContact(
      USER_TEAM_A,
      contactCreateSchema.parse({ name: "Jean Dupont", teamId: "tB" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("un ADMIN global peut créer pour n'importe quelle équipe", async () => {
    const result = await createContact(
      ADMIN_GLOBAL,
      contactCreateSchema.parse({ name: "Jean Dupont", teamId: "tZ" }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("createContact — détection de doublon", () => {
  it("bloque (409) un doublon exact : même nom + équipe + téléphone", async () => {
    findMany.mockResolvedValue([{ id: "existing", name: "Jean Dupont" }]);
    const result = await createContact(
      USER_TEAM_A,
      contactCreateSchema.parse({
        name: "  Jean   Dupont ",
        teamId: "tA",
        phone: "0600000000",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("n'empêche pas deux homonymes avec des coordonnées différentes", async () => {
    // findMany ne retourne aucun candidat car le téléphone ne matche pas.
    findMany.mockResolvedValue([]);
    const result = await createContact(
      USER_TEAM_A,
      contactCreateSchema.parse({
        name: "Jean Dupont",
        teamId: "tA",
        phone: "0611111111",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("ne fait aucune vérification de doublon si ni téléphone ni email ne sont renseignés", async () => {
    const result = await createContact(
      USER_TEAM_A,
      contactCreateSchema.parse({ name: "Jean Dupont", teamId: "tA" }),
    );
    expect(result.ok).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });
});
