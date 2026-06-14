import { beforeEach, describe, expect, it, vi } from "vitest";

const userUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...a: unknown[]) => userUpdate(...a),
    },
  },
}));

import {
  ADMIN_SCOPE_MODES,
  getAdminScopePreference,
  isAdminScoped,
  isAdminScopeMode,
  updateAdminScopePreference,
} from "./admin-scope-preference";

beforeEach(() => {
  userUpdate.mockReset();
  userUpdate.mockResolvedValue({});
});

// ─── Const + guard ──────────────────────────────────────────────────────────

describe("ADMIN_SCOPE_MODES + isAdminScopeMode", () => {
  it("expose exactement les 3 modes V1", () => {
    expect(ADMIN_SCOPE_MODES).toEqual(["GLOBAL", "MY_TEAMS", "TEAM"]);
  });

  it("accepte GLOBAL", () => {
    expect(isAdminScopeMode("GLOBAL")).toBe(true);
  });

  it("accepte MY_TEAMS", () => {
    expect(isAdminScopeMode("MY_TEAMS")).toBe(true);
  });

  it("accepte TEAM", () => {
    expect(isAdminScopeMode("TEAM")).toBe(true);
  });

  it("refuse une valeur inconnue", () => {
    expect(isAdminScopeMode("FOO")).toBe(false);
    expect(isAdminScopeMode("global")).toBe(false); // sensible à la casse
    expect(isAdminScopeMode("")).toBe(false);
  });
});

// ─── getAdminScopePreference ────────────────────────────────────────────────

describe("getAdminScopePreference — lecture normalisée", () => {
  it("user sans préférence (rétro-compat) → fallback GLOBAL", () => {
    const out = getAdminScopePreference({});
    expect(out).toEqual({ mode: "GLOBAL", teamId: null, updatedAt: null });
  });

  it("mode GLOBAL explicite préservé, teamId forcé à null", () => {
    const out = getAdminScopePreference({
      adminScopeMode: "GLOBAL",
      adminTeamId: "t1", // résidu volontaire
    });
    expect(out.mode).toBe("GLOBAL");
    expect(out.teamId).toBeNull();
  });

  it("mode MY_TEAMS préservé, teamId forcé à null", () => {
    const out = getAdminScopePreference({
      adminScopeMode: "MY_TEAMS",
      adminTeamId: "t1",
    });
    expect(out.mode).toBe("MY_TEAMS");
    expect(out.teamId).toBeNull();
  });

  it("mode TEAM préservé avec teamId valide", () => {
    const out = getAdminScopePreference({
      adminScopeMode: "TEAM",
      adminTeamId: "t1",
    });
    expect(out).toEqual({
      mode: "TEAM",
      teamId: "t1",
      updatedAt: null,
    });
  });

  it("mode inconnu (corruption) → fallback GLOBAL", () => {
    const out = getAdminScopePreference({
      adminScopeMode: "WHATEVER",
      adminTeamId: "t1",
    });
    expect(out.mode).toBe("GLOBAL");
    expect(out.teamId).toBeNull();
  });

  it("updatedAt remonté tel quel quand présent", () => {
    const at = new Date("2026-06-14T10:00:00Z");
    const out = getAdminScopePreference({
      adminScopeMode: "GLOBAL",
      adminScopeUpdatedAt: at,
    });
    expect(out.updatedAt).toBe(at);
  });
});

// ─── updateAdminScopePreference ─────────────────────────────────────────────

describe("updateAdminScopePreference — écriture + validation", () => {
  it("TEAM avec teamId → update DB + finalTeamId préservé", async () => {
    const out = await updateAdminScopePreference("u1", "TEAM", "t1");
    expect(out.mode).toBe("TEAM");
    expect(out.teamId).toBe("t1");
    expect(out.updatedAt).toBeInstanceOf(Date);
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const arg = userUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "u1" });
    expect(arg.data.adminScopeMode).toBe("TEAM");
    expect(arg.data.adminTeamId).toBe("t1");
    expect(arg.data.adminScopeUpdatedAt).toBeInstanceOf(Date);
  });

  it("TEAM sans teamId → throw, pas d'écriture DB", async () => {
    await expect(updateAdminScopePreference("u1", "TEAM")).rejects.toThrow(
      /TEAM requires/,
    );
    await expect(
      updateAdminScopePreference("u1", "TEAM", ""),
    ).rejects.toThrow(/TEAM requires/);
    await expect(
      updateAdminScopePreference("u1", "TEAM", null),
    ).rejects.toThrow(/TEAM requires/);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("GLOBAL ignore le teamId fourni et force null en DB", async () => {
    const out = await updateAdminScopePreference("u1", "GLOBAL", "t1");
    expect(out.teamId).toBeNull();
    expect(userUpdate.mock.calls[0][0].data.adminTeamId).toBeNull();
  });

  it("MY_TEAMS ignore le teamId fourni et force null en DB", async () => {
    const out = await updateAdminScopePreference("u1", "MY_TEAMS", "t1");
    expect(out.teamId).toBeNull();
    expect(userUpdate.mock.calls[0][0].data.adminTeamId).toBeNull();
  });

  it("mode invalide → throw runtime, pas d'écriture DB", async () => {
    await expect(
      // @ts-expect-error — test explicite d'une valeur runtime invalide
      updateAdminScopePreference("u1", "BOGUS"),
    ).rejects.toThrow(/Invalid AdminScopeMode/);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("met à jour adminScopeUpdatedAt à chaque appel (même mode identique)", async () => {
    const first = await updateAdminScopePreference("u1", "GLOBAL");
    const second = await updateAdminScopePreference("u1", "GLOBAL");
    expect(first.updatedAt).toBeInstanceOf(Date);
    expect(second.updatedAt).toBeInstanceOf(Date);
    // Les 2 calls Prisma ont chacun un adminScopeUpdatedAt Date.
    expect(userUpdate.mock.calls[0][0].data.adminScopeUpdatedAt).toBeInstanceOf(
      Date,
    );
    expect(userUpdate.mock.calls[1][0].data.adminScopeUpdatedAt).toBeInstanceOf(
      Date,
    );
  });
});

// ─── isAdminScoped ──────────────────────────────────────────────────────────

describe("isAdminScoped", () => {
  it("GLOBAL → false", () => {
    expect(isAdminScoped({ adminScopeMode: "GLOBAL" })).toBe(false);
  });

  it("MY_TEAMS → true", () => {
    expect(isAdminScoped({ adminScopeMode: "MY_TEAMS" })).toBe(true);
  });

  it("TEAM → true", () => {
    expect(
      isAdminScoped({ adminScopeMode: "TEAM", adminTeamId: "t1" }),
    ).toBe(true);
  });

  it("préférence absente → false (= GLOBAL implicite)", () => {
    expect(isAdminScoped({})).toBe(false);
    expect(isAdminScoped({ adminScopeMode: null })).toBe(false);
  });

  it("mode corrompu → false (fallback GLOBAL via getAdminScopePreference)", () => {
    expect(isAdminScoped({ adminScopeMode: "BOGUS" })).toBe(false);
  });
});
