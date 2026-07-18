import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const assertTeamAccess = vi.fn();
const findUniqueIncident = vi.fn();
const findManyIntervenant = vi.fn();
const usedNumbers = vi.fn();
const findManyAutorisation = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  assertTeamAccess: (...a: unknown[]) => assertTeamAccess(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cilIncident: { findUnique: (...a: unknown[]) => findUniqueIncident(...a) },
    cilIntervenant: { findMany: (...a: unknown[]) => findManyIntervenant(...a) },
    cilAutorisation: { findMany: (...a: unknown[]) => findManyAutorisation(...a) },
  },
}));
vi.mock("@/lib/cil/repo", async () => {
  const real = await vi.importActual<typeof import("@/lib/cil/repo")>(
    "@/lib/cil/repo",
  );
  return { ...real, usedNumbers: (...a: unknown[]) => usedNumbers(...a) };
});

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/cil/inc1/depeches", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const ctx = { params: Promise.resolve({ id: "inc1" }) };
const base = {
  subtype: "PROTECTION_CIRCULATION",
  occurredAt: "2026-07-16T12:35:00.000Z",
  texte: "M. … CIL",
};

beforeEach(() => {
  for (const m of [requireUser, assertTeamAccess, findUniqueIncident, findManyIntervenant, usedNumbers, findManyAutorisation])
    m.mockReset();
  // Par défaut : aucune autorisation recueillie en amont.
  findManyAutorisation.mockResolvedValue([]);
  requireUser.mockResolvedValue({ id: "u1", name: "Obs", role: "USER", teamIds: ["tA"] });
  assertTeamAccess.mockReturnValue(true);
  findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "OPEN" });
  findManyIntervenant.mockResolvedValue([]);
});

describe("POST depeches — gardes", () => {
  it("refuse si incident CLOSED → 409", async () => {
    findUniqueIncident.mockResolvedValue({ id: "inc1", teamId: "tA", status: "CLOSED" });
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(409);
  });

  it("refuse hors périmètre → 403", async () => {
    assertTeamAccess.mockReturnValue(false);
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(403);
  });

  it("plage épuisée → 409", async () => {
    // Toute la plage protection 10-29 déjà prise.
    usedNumbers.mockResolvedValue(Array.from({ length: 20 }, (_, i) => 10 + i));
    const res = await POST(req(base), ctx);
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.error).toMatch(/épuisée/i);
  });

  it("valide le sous-type (zod) → 400", async () => {
    const res = await POST(req({ ...base, subtype: "NIMPORTE" }), ctx);
    expect(res.status).toBe(400);
  });
});

describe("POST depeches — garde-fou autorisations reprise", () => {
  const reprise = {
    subtype: "REPRISE_NORMALE",
    occurredAt: "2026-07-16T14:00:00.000Z",
    texte: "reprise",
  };
  it("COS présent sans autorisation ni signature → 409", async () => {
    findManyIntervenant.mockResolvedValue([
      { type: "COS", arrivedAt: new Date("2026-07-16T13:00:00Z"), departedAt: null },
    ]);
    const res = await POST(req(reprise), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/autorisation et signature/i);
  });

  it("autorisation SANS signature → 409 (la signature est exigée aussi)", async () => {
    findManyIntervenant.mockResolvedValue([
      { type: "COS", arrivedAt: new Date("2026-07-16T13:00:00Z"), departedAt: null },
    ]);
    const res = await POST(
      req({ ...reprise, avisCosAt: "2026-07-16T13:45:00.000Z" }),
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/COS \(signature\)/);
  });

  it("autorisation + signature du COS (recueillies en amont) → garde franchie", async () => {
    findManyIntervenant.mockResolvedValue([
      { type: "COS", arrivedAt: new Date("2026-07-16T13:00:00Z"), departedAt: null },
    ]);
    findManyAutorisation.mockResolvedValue([
      {
        role: "COS",
        grantedAt: new Date("2026-07-16T13:45:00Z"),
        signerName: null,
        imageB64: "AAA",
      },
    ]);
    // plage pleine → 409 « épuisée » (≠ garde), prouve que la garde a été franchie.
    usedNumbers.mockResolvedValue(Array.from({ length: 20 }, (_, i) => 30 + i));
    const res = await POST(
      req({
        ...reprise,
        avisCosAt: "2026-07-16T13:45:00.000Z",
        signatures: [{ role: "COS", imageB64: "AAA" }],
      }),
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/épuisée/i);
  });

  it("COS parti → pas de blocage (passe la garde, réservation ensuite)", async () => {
    findManyIntervenant.mockResolvedValue([
      { type: "COS", arrivedAt: new Date("2026-07-16T13:00:00Z"), departedAt: new Date("2026-07-16T13:30:00Z") },
    ]);
    // plage rétablissements pleine → 409 « épuisée » (≠ garde), prouve que la garde a été franchie.
    usedNumbers.mockResolvedValue(Array.from({ length: 20 }, (_, i) => 30 + i));
    const res = await POST(req(reprise), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/épuisée/i);
  });
});
