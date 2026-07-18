import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const assertTeamAccess = vi.fn();
const findUniqueIncident = vi.fn();
const usedNumbers = vi.fn();
const findFirstDepeche = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  assertTeamAccess: (...a: unknown[]) => assertTeamAccess(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cilIncident: { findUnique: (...a: unknown[]) => findUniqueIncident(...a) },
    cilDepeche: { findFirst: (...a: unknown[]) => findFirstDepeche(...a) },
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
// Une dépêche = un envoi : interlocuteur et n° reçu sont obligatoires.
const base = {
  kind: "ELECTRIQUE",
  interlocutor: "CRC",
  occurredAt: "2026-07-16T12:35:00.000Z",
  texte: "…",
  numeroRecu: "27",
};

beforeEach(() => {
  for (const m of [requireUser, assertTeamAccess, findUniqueIncident, usedNumbers, findFirstDepeche])
    m.mockReset();
  findFirstDepeche.mockResolvedValue(null);
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

  it("plage épuisée → 409", async () => {
    usedNumbers.mockResolvedValue(Array.from({ length: 20 }, (_, i) => 10 + i));
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/épuisée/i);
  });

  it("refuse un n° reçu absent → 400 (collationnement obligatoire)", async () => {
    const { numeroRecu: _omis, ...sansNumero } = base;
    expect((await POST(req(sansNumero), ctx)).status).toBe(400);
    expect((await POST(req({ ...base, numeroRecu: "" }), ctx)).status).toBe(400);
  });

  it("refuse un interlocuteur incohérent avec la nature → 400", async () => {
    // Protection électrique → CRC ou RSS, jamais AC.
    const res = await POST(req({ ...base, interlocutor: "AC" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/attendu CRC ou RSS/i);
  });

  it("refuse une seconde transmission au même interlocuteur → 409", async () => {
    findFirstDepeche.mockResolvedValue({ id: "d1", numeroDonne: 14 });
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/déjà été transmise au CRC/i);
  });
});
