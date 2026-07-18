import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const assertTeamAccess = vi.fn();
const findUniqueIncident = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  assertTeamAccess: (...a: unknown[]) => assertTeamAccess(...a),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cilIncident: { findUnique: (...a: unknown[]) => findUniqueIncident(...a) },
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/cil/inc1/intervenants", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const ctx = { params: Promise.resolve({ id: "inc1" }) };

beforeEach(() => {
  requireUser.mockReset();
  assertTeamAccess.mockReset();
  findUniqueIncident.mockReset();
  requireUser.mockResolvedValue({ id: "u1", name: "Obs", role: "USER", teamIds: ["tA"] });
  assertTeamAccess.mockReturnValue(true);
  findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "OPEN" });
});

describe("POST intervenants — règles métier & gardes", () => {
  it("Pompes Funèbres sans heure de départ → 400", async () => {
    const res = await POST(
      req({ type: "POMPES_FUNEBRES", arrivedAt: "2026-07-16T12:00:00.000Z" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("refuse si incident hors périmètre (assertTeamAccess=false) → 403", async () => {
    assertTeamAccess.mockReturnValue(false);
    const res = await POST(req({ type: "COS", arrivedAt: "2026-07-16T12:00:00.000Z" }), ctx);
    expect(res.status).toBe(403);
  });

  it("refuse l'écriture si incident CLOSED → 409", async () => {
    findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "CLOSED" });
    const res = await POST(req({ type: "COS", arrivedAt: "2026-07-16T12:00:00.000Z" }), ctx);
    expect(res.status).toBe(409);
  });

  it("404 si incident inconnu", async () => {
    findUniqueIncident.mockResolvedValue(null);
    const res = await POST(req({ type: "COS" }), ctx);
    expect(res.status).toBe(404);
  });

  it("401 si non authentifié", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 401 }),
    );
    const res = await POST(req({ type: "COS" }), ctx);
    expect(res.status).toBe(401);
  });
});
