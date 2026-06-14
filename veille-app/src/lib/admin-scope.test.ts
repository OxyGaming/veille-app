import { describe, expect, it } from "vitest";
import {
  adminScopeAllowsTeam,
  adminScopeToTeamFilter,
  resolveAdminScope,
  type ScopeUserInput,
} from "./admin-scope";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const USER: ScopeUserInput = {
  role: "USER",
  teamIds: ["tA"],
};
const EDITOR_MONO: ScopeUserInput = {
  role: "EDITOR",
  teamIds: ["tA"],
};
const EDITOR_MULTI: ScopeUserInput = {
  role: "EDITOR",
  teamIds: ["tA", "tB"],
};
const ADMIN_DEFAULT: ScopeUserInput = {
  role: "ADMIN",
  teamIds: ["tA", "tB"],
};
const ADMIN_NOTEAM: ScopeUserInput = {
  role: "ADMIN",
  teamIds: [],
};

const TEAMS = { tA: "Rive Droite", tB: "Rive Gauche" };

// ─── resolveAdminScope — passthrough USER / EDITOR ──────────────────────────

describe("resolveAdminScope — USER / EDITOR (inchangés)", () => {
  it("USER → MY_TEAMS sur ses memberships, jamais GLOBAL", () => {
    const s = resolveAdminScope(USER);
    expect(s).toEqual({
      mode: "MY_TEAMS",
      teamIds: ["tA"],
      isGlobal: false,
      label: "Mes équipes",
      selectedTeamId: null,
    });
  });

  it("EDITOR mono-team → MY_TEAMS sur sa team", () => {
    const s = resolveAdminScope(EDITOR_MONO);
    expect(s.mode).toBe("MY_TEAMS");
    expect(s.teamIds).toEqual(["tA"]);
    expect(s.isGlobal).toBe(false);
  });

  it("EDITOR multi-team → MY_TEAMS sur toutes ses memberships", () => {
    const s = resolveAdminScope(EDITOR_MULTI);
    expect(s.teamIds).toEqual(["tA", "tB"]);
  });

  it("USER avec adminScopeMode=GLOBAL en DB → ignoré (passthrough)", () => {
    const s = resolveAdminScope({
      ...USER,
      adminScopeMode: "GLOBAL",
      adminTeamId: "tA",
    });
    expect(s.mode).toBe("MY_TEAMS");
    expect(s.isGlobal).toBe(false);
  });
});

// ─── resolveAdminScope — ADMIN GLOBAL ───────────────────────────────────────

describe("resolveAdminScope — ADMIN GLOBAL", () => {
  it("préférence GLOBAL → isGlobal=true, teamIds=[], label='Global'", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "GLOBAL",
    });
    expect(s).toEqual({
      mode: "GLOBAL",
      teamIds: [],
      isGlobal: true,
      label: "Global",
      selectedTeamId: null,
    });
  });

  it("ADMIN sans préférence (null) → GLOBAL implicite", () => {
    const s = resolveAdminScope(ADMIN_DEFAULT);
    expect(s.mode).toBe("GLOBAL");
    expect(s.isGlobal).toBe(true);
  });

  it("ADMIN avec préférence corrompue (mode inconnu) → GLOBAL", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "BOGUS",
    });
    expect(s.mode).toBe("GLOBAL");
    expect(s.isGlobal).toBe(true);
  });
});

// ─── resolveAdminScope — ADMIN MY_TEAMS ─────────────────────────────────────

describe("resolveAdminScope — ADMIN MY_TEAMS", () => {
  it("ADMIN avec 1 équipe → MY_TEAMS sur cette équipe", () => {
    const s = resolveAdminScope({
      role: "ADMIN",
      teamIds: ["tA"],
      adminScopeMode: "MY_TEAMS",
    });
    expect(s.mode).toBe("MY_TEAMS");
    expect(s.teamIds).toEqual(["tA"]);
    expect(s.isGlobal).toBe(false);
    expect(s.label).toBe("Mes équipes");
    expect(s.selectedTeamId).toBeNull();
  });

  it("ADMIN multi-équipes → union des memberships", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "MY_TEAMS",
    });
    expect(s.teamIds).toEqual(["tA", "tB"]);
  });

  it("ADMIN sans membership en mode MY_TEAMS → fallback GLOBAL", () => {
    const s = resolveAdminScope({
      ...ADMIN_NOTEAM,
      adminScopeMode: "MY_TEAMS",
    });
    expect(s.mode).toBe("GLOBAL");
    expect(s.isGlobal).toBe(true);
    expect(s.label).toBe("Global");
  });
});

// ─── resolveAdminScope — ADMIN TEAM ─────────────────────────────────────────

describe("resolveAdminScope — ADMIN TEAM", () => {
  it("ADMIN TEAM valide avec teamsMap → label nominatif", () => {
    const s = resolveAdminScope(
      {
        ...ADMIN_DEFAULT,
        adminScopeMode: "TEAM",
        adminTeamId: "tA",
      },
      { teamsMap: TEAMS },
    );
    expect(s.mode).toBe("TEAM");
    expect(s.teamIds).toEqual(["tA"]);
    expect(s.isGlobal).toBe(false);
    expect(s.label).toBe("Équipe Rive Droite");
    expect(s.selectedTeamId).toBe("tA");
  });

  it("ADMIN TEAM valide sans teamsMap → label générique 'Équipe'", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: "tA",
    });
    expect(s.mode).toBe("TEAM");
    expect(s.label).toBe("Équipe");
    expect(s.selectedTeamId).toBe("tA");
  });

  it("ADMIN TEAM sans teamId → fallback GLOBAL", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: null,
    });
    expect(s.mode).toBe("GLOBAL");
    expect(s.selectedTeamId).toBeNull();
  });

  it("ADMIN TEAM avec teamId absent du teamsMap → fallback GLOBAL", () => {
    const s = resolveAdminScope(
      {
        ...ADMIN_DEFAULT,
        adminScopeMode: "TEAM",
        adminTeamId: "tDISPARUE",
      },
      { teamsMap: TEAMS },
    );
    expect(s.mode).toBe("GLOBAL");
    expect(s.label).toBe("Global");
  });

  it("ADMIN TEAM sans teamsMap fourni → accepte tout teamId non vide", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: "tINCONNUE",
    });
    expect(s.mode).toBe("TEAM");
    expect(s.teamIds).toEqual(["tINCONNUE"]);
  });
});

// ─── isGlobal & selectedTeamId — cohérence ───────────────────────────────────

describe("ResolvedAdminScope — invariants", () => {
  it("isGlobal=true ↔ teamIds=[] et selectedTeamId=null", () => {
    const cases: ScopeUserInput[] = [
      { role: "ADMIN", teamIds: [], adminScopeMode: "GLOBAL" },
      { role: "ADMIN", teamIds: [], adminScopeMode: "MY_TEAMS" }, // fallback
      { role: "ADMIN", teamIds: [], adminScopeMode: "TEAM", adminTeamId: null }, // fallback
    ];
    for (const u of cases) {
      const s = resolveAdminScope(u);
      expect(s.isGlobal).toBe(true);
      expect(s.teamIds).toEqual([]);
      expect(s.selectedTeamId).toBeNull();
    }
  });

  it("selectedTeamId non null implique mode=TEAM", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: "tA",
    });
    expect(s.selectedTeamId).toBe("tA");
    expect(s.mode).toBe("TEAM");
  });
});

// ─── adminScopeToTeamFilter ──────────────────────────────────────────────────

describe("adminScopeToTeamFilter", () => {
  it("GLOBAL → {} (pas de contrainte)", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "GLOBAL",
    });
    expect(adminScopeToTeamFilter(s)).toEqual({});
  });

  it("MY_TEAMS → { in: memberships }", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "MY_TEAMS",
    });
    expect(adminScopeToTeamFilter(s)).toEqual({ in: ["tA", "tB"] });
  });

  it("TEAM → { in: [teamId] }", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: "tA",
    });
    expect(adminScopeToTeamFilter(s)).toEqual({ in: ["tA"] });
  });

  it("EDITOR multi-team → { in: [memberships] }", () => {
    const s = resolveAdminScope(EDITOR_MULTI);
    expect(adminScopeToTeamFilter(s)).toEqual({ in: ["tA", "tB"] });
  });
});

// ─── adminScopeAllowsTeam ────────────────────────────────────────────────────

describe("adminScopeAllowsTeam", () => {
  it("GLOBAL → true pour n'importe quelle équipe", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "GLOBAL",
    });
    expect(adminScopeAllowsTeam(s, "tA")).toBe(true);
    expect(adminScopeAllowsTeam(s, "tINCONNUE")).toBe(true);
  });

  it("MY_TEAMS → true seulement pour les équipes du périmètre", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "MY_TEAMS",
    });
    expect(adminScopeAllowsTeam(s, "tA")).toBe(true);
    expect(adminScopeAllowsTeam(s, "tB")).toBe(true);
    expect(adminScopeAllowsTeam(s, "tC")).toBe(false);
  });

  it("TEAM → true uniquement pour le teamId sélectionné", () => {
    const s = resolveAdminScope({
      ...ADMIN_DEFAULT,
      adminScopeMode: "TEAM",
      adminTeamId: "tA",
    });
    expect(adminScopeAllowsTeam(s, "tA")).toBe(true);
    expect(adminScopeAllowsTeam(s, "tB")).toBe(false);
  });
});
