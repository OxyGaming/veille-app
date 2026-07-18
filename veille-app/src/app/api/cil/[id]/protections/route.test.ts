import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const assertTeamAccess = vi.fn();
const findUniqueIncident = vi.fn();
const usedNumbers = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  assertTeamAccess: (...a: unknown[]) => assertTeamAccess(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cilIncident: { findUnique: (...a: unknown[]) => findUniqueIncident(...a) },
  },
}));
vi.mock("@/lib/cil/repo", async () => {
  const real = await vi.importActual<typeof import("@/lib/cil/repo")>("@/lib/cil/repo");
  return { ...real, usedNumbers: (...a: unknown[]) => usedNumbers(...a) };
});

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/cil/inc1/protections", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const ctx = { params: Promise.resolve({ id: "inc1" }) };
const base = { kind: "ELECTRIQUE", occurredAt: "2026-07-16T12:35:00.000Z", texte: "…" };

beforeEach(() => {
  for (const m of [requireUser, assertTeamAccess, findUniqueIncident, usedNumbers]) m.mockReset();
  requireUser.mockResolvedValue({ id: "u1", name: "Obs", role: "USER", teamIds: ["tA"] });
  assertTeamAccess.mockReturnValue(true);
  findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "OPEN" });
});

describe("POST protections — gardes", () => {
  it("refuse si incident CLOSED → 409", async () => {
    findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "CLOSED" });
    expect((await POST(req(base), ctx)).status).toBe(409);
  });

  it("refuse hors périmètre → 403", async () => {
    assertTeamAccess.mockReturnValue(false);
    expect((await POST(req(base), ctx)).status).toBe(403);
  });

  it("valide le kind (zod) → 400", async () => {
    expect((await POST(req({ ...base, kind: "AUTRE" }), ctx)).status).toBe(400);
  });

  it("pas assez de numéros (1 seul libre) → 409", async () => {
    // 10-28 pris → il ne reste que 29 : impossible de réserver 2 numéros.
    usedNumbers.mockResolvedValue(Array.from({ length: 19 }, (_, i) => 10 + i));
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/numéros disponibles/i);
  });
});
