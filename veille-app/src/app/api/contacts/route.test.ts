import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createContact = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));

vi.mock("@/lib/contacts", async () => {
  const real = await vi.importActual<typeof import("@/lib/contacts")>(
    "@/lib/contacts",
  );
  return { ...real, createContact: (...a: unknown[]) => createContact(...a) };
});

import { POST } from "./route";

beforeEach(() => {
  requireUser.mockReset();
  createContact.mockReset();
});

function makeReq(body: unknown) {
  return new Request("http://localhost/api/contacts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function fakeUser(teamIds: string[] = ["tA"]) {
  return {
    id: "u1",
    role: "USER",
    teamIds,
    teamId: teamIds[0] ?? null,
    email: "x@y.z",
    name: "X",
    viewAllTeams: false,
    adminScopeMode: null,
    adminTeamId: null,
  };
}

describe("POST /api/contacts", () => {
  it("401 si non authentifié", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
      }),
    );
    const res = await POST(makeReq({ name: "X", teamId: "tA" }));
    expect(res.status).toBe(401);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("400 si le nom est manquant (validation)", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await POST(makeReq({ teamId: "tA" }));
    expect(res.status).toBe(400);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("400 si aucune équipe n'est fournie (jamais de contact commun depuis le front)", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await POST(makeReq({ name: "Jean Dupont" }));
    expect(res.status).toBe(400);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("délègue à createContact() et renvoie le contact créé", async () => {
    requireUser.mockResolvedValue(fakeUser(["tA"]));
    createContact.mockResolvedValue({
      ok: true,
      contact: { id: "c1", name: "Jean Dupont", teamId: "tA" },
    });
    const res = await POST(
      makeReq({ name: "Jean Dupont", teamId: "tA" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ id: "c1", name: "Jean Dupont" });
  });

  it("propage le statut d'erreur de createContact() (ex. 409 doublon)", async () => {
    requireUser.mockResolvedValue(fakeUser(["tA"]));
    createContact.mockResolvedValue({
      ok: false,
      status: 409,
      message: "Un contact similaire existe déjà.",
    });
    const res = await POST(makeReq({ name: "Jean Dupont", teamId: "tA" }));
    expect(res.status).toBe(409);
  });
});
