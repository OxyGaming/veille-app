import { describe, it, expect } from "vitest";
import {
  actionScope,
  assertTeamAccess,
  canActOnAnyTeam,
  canActOnTeam,
  resolveOwningTeam,
  teamScope,
  userScope,
  type SessionUser,
} from "./auth";

/**
 * Tests ciblés sur `assertTeamAccess` — Sprint 1 commit 4 / US-1.3.
 *
 * Garantit la non-régression du bug AUDIT.md §C2 où les utilisateurs
 * multi-équipes étaient systématiquement bloqués (403) sur les routes
 * `PATCH /api/observations/:id` et `POST /api/actions/:id/validate`.
 */

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user-1",
    email: "u@test",
    name: "Test User",
    role: "USER",
    teamId: null,
    teamIds: [],
    viewAllTeams: false,
    adminScopeMode: null,
    adminTeamId: null,
    ...overrides,
  };
}

describe("assertTeamAccess", () => {
  it("ADMIN : accès global à n'importe quelle équipe", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(assertTeamAccess(admin, "team-A")).toBe(true);
    expect(assertTeamAccess(admin, "team-Z")).toBe(true);
  });

  it("viewAllTeams : accès global même si teamIds non vide", () => {
    const u = makeUser({ viewAllTeams: true, teamIds: ["team-X"] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
    expect(assertTeamAccess(u, "team-X")).toBe(true);
  });

  it("USER mono-équipe : accès uniquement à sa team", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
    expect(assertTeamAccess(u, "team-B")).toBe(false);
  });

  it("USER multi-équipes : accès aux équipes autorisées (régression bug §C2)", () => {
    const u = makeUser({ teamIds: ["team-A", "team-B", "team-C"] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
    expect(assertTeamAccess(u, "team-B")).toBe(true);
    expect(assertTeamAccess(u, "team-C")).toBe(true);
    expect(assertTeamAccess(u, "team-D")).toBe(false);
  });

  it("USER sans équipe : refus systématique", () => {
    const u = makeUser({ teamIds: [] });
    expect(assertTeamAccess(u, "team-A")).toBe(false);
    expect(assertTeamAccess(u, "team-Z")).toBe(false);
  });

  it("EDITOR mono-équipe : accès uniquement à sa team", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A"] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
    expect(assertTeamAccess(u, "team-B")).toBe(false);
  });

  it("EDITOR multi-équipes : accès aux équipes autorisées", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A", "team-B"] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
    expect(assertTeamAccess(u, "team-B")).toBe(true);
    expect(assertTeamAccess(u, "team-C")).toBe(false);
  });

  it("EDITOR sans équipe : refus systématique", () => {
    const u = makeUser({ role: "EDITOR", teamIds: [] });
    expect(assertTeamAccess(u, "team-A")).toBe(false);
  });

  it("USER avec viewAllTeams=true et 0 team : accès global (cas limite)", () => {
    const u = makeUser({ viewAllTeams: true, teamIds: [] });
    expect(assertTeamAccess(u, "team-A")).toBe(true);
  });
});

/**
 * Décision cloisonnement §1 (2026-06) : `actionScope` est désormais STRICT par
 * teamId — il ne doit plus jamais renvoyer le `OR` large via agent/site partagé.
 * Régression à empêcher : une action d'une équipe redevenant visible/mutable par
 * une autre équipe via un agent ou un site partagé.
 */
describe("actionScope (strict par teamId)", () => {
  it("est identique à teamScope pour un USER mono-équipe", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(actionScope(u)).toEqual(teamScope(u));
    expect(actionScope(u)).toEqual({ teamId: { in: ["team-A"] } });
  });

  it("ne contient JAMAIS de clause OR (plus de fuite agent/site partagé)", () => {
    const mono = makeUser({ teamIds: ["team-A"] });
    const multi = makeUser({ teamIds: ["team-A", "team-B"] });
    expect(actionScope(mono)).not.toHaveProperty("OR");
    expect(actionScope(multi)).not.toHaveProperty("OR");
  });

  it("ADMIN global : aucun filtre", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(actionScope(admin)).toEqual({});
  });

  it("USER multi-équipes : restreint à ses équipes", () => {
    const u = makeUser({ teamIds: ["team-A", "team-B"] });
    expect(actionScope(u)).toEqual({ teamId: { in: ["team-A", "team-B"] } });
  });

  it("USER sans équipe : filtre impossible (__none__)", () => {
    const u = makeUser({ teamIds: [] });
    expect(actionScope(u)).toEqual({ teamId: "__none__" });
  });
});

/**
 * Décision cloisonnement : `canActOnTeam` garde les routes admin mutantes en
 * honorant le périmètre effectif (contrairement à `requireRole`).
 */
describe("canActOnTeam", () => {
  it("ADMIN global : peut agir sur n'importe quelle équipe", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(canActOnTeam(admin, "team-A")).toBe(true);
    expect(canActOnTeam(admin, "team-Z")).toBe(true);
  });

  it("viewAllTeams : global", () => {
    const u = makeUser({ viewAllTeams: true, teamIds: ["team-X"] });
    expect(canActOnTeam(u, "team-A")).toBe(true);
  });

  it("EDITOR mono-équipe : uniquement sa team", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A"] });
    expect(canActOnTeam(u, "team-A")).toBe(true);
    expect(canActOnTeam(u, "team-B")).toBe(false);
  });

  it("EDITOR : refus sur une donnée sans équipe (teamId null)", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A"] });
    expect(canActOnTeam(u, null)).toBe(false);
    expect(canActOnTeam(u, undefined)).toBe(false);
  });

  it("ADMIN scopé TEAM : restreint à l'équipe choisie (pas d'action hors périmètre)", () => {
    const u = makeUser({
      role: "ADMIN",
      teamIds: ["team-A", "team-B"],
      adminScopeMode: "TEAM",
      adminTeamId: "team-A",
    });
    expect(canActOnTeam(u, "team-A")).toBe(true);
    expect(canActOnTeam(u, "team-B")).toBe(false);
    expect(canActOnTeam(u, "team-Z")).toBe(false);
  });

  it("ADMIN scopé MY_TEAMS : restreint à ses memberships", () => {
    const u = makeUser({
      role: "ADMIN",
      teamIds: ["team-A"],
      adminScopeMode: "MY_TEAMS",
    });
    expect(canActOnTeam(u, "team-A")).toBe(true);
    expect(canActOnTeam(u, "team-B")).toBe(false);
  });

  it("ADMIN global (teamId null sur la donnée) : autorisé car non scopé", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(canActOnTeam(admin, null)).toBe(true);
  });
});

/**
 * `canActOnAnyTeam` — entités multi-équipes (Agent / Site / User). L'acteur
 * peut agir s'il partage AU MOINS une équipe.
 */
describe("canActOnAnyTeam", () => {
  it("ADMIN global : toujours autorisé", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(canActOnAnyTeam(admin, ["team-A", "team-B"])).toBe(true);
    expect(canActOnAnyTeam(admin, [null])).toBe(true);
  });

  it("EDITOR : autorisé si une équipe est partagée", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A"] });
    expect(canActOnAnyTeam(u, ["team-B", "team-A"])).toBe(true); // partage A
    expect(canActOnAnyTeam(u, ["team-B", "team-C"])).toBe(false); // aucune commune
  });

  it("refus sur une entité sans aucune équipe (toutes null)", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A"] });
    expect(canActOnAnyTeam(u, [null, undefined])).toBe(false);
  });

  it("ADMIN scopé TEAM : limité à l'équipe choisie", () => {
    const u = makeUser({
      role: "ADMIN",
      teamIds: ["team-A", "team-B"],
      adminScopeMode: "TEAM",
      adminTeamId: "team-A",
    });
    expect(canActOnAnyTeam(u, ["team-B"])).toBe(false); // B hors scope TEAM=A
    expect(canActOnAnyTeam(u, ["team-A", "team-B"])).toBe(true);
  });
});

/**
 * `userScope` — un EDITOR / ADMIN scopé ne liste que les users de ses équipes.
 */
describe("userScope", () => {
  it("ADMIN global : aucun filtre", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(userScope(admin)).toEqual({});
  });

  it("EDITOR : filtre membership OR teamId legacy sur ses équipes", () => {
    const u = makeUser({ role: "EDITOR", teamIds: ["team-A", "team-B"] });
    expect(userScope(u)).toEqual({
      OR: [
        { memberships: { some: { teamId: { in: ["team-A", "team-B"] } } } },
        { teamId: { in: ["team-A", "team-B"] } },
      ],
    });
  });

  it("acteur sans équipe : filtre impossible", () => {
    const u = makeUser({ role: "EDITOR", teamIds: [] });
    expect(userScope(u)).toEqual({ id: "__none__" });
  });
});

/**
 * `resolveOwningTeam` — désambiguïsation de l'équipe propriétaire lors d'une
 * création sur agent/site/véhicule partagé (décision cloisonnement §2-créations).
 */
describe("resolveOwningTeam", () => {
  it("entité mono-équipe : choisie automatiquement", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(resolveOwningTeam(u, ["team-A"])).toEqual({ ok: true, teamId: "team-A" });
  });

  it("entité sans équipe : NO_TEAM", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(resolveOwningTeam(u, [null, undefined])).toEqual({
      ok: false,
      code: "NO_TEAM",
    });
  });

  it("USER mono-équipe, entité partagée A+B : auto sur l'unique commune (A)", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(resolveOwningTeam(u, ["team-A", "team-B"])).toEqual({
      ok: true,
      teamId: "team-A",
    });
  });

  it("USER hors de toutes les équipes de l'entité : NO_TEAM", () => {
    const u = makeUser({ teamIds: ["team-A"] });
    expect(resolveOwningTeam(u, ["team-B", "team-C"])).toEqual({
      ok: false,
      code: "NO_TEAM",
    });
  });

  it("USER multi-équipes, plusieurs communes, pas de choix : TEAM_REQUIRED", () => {
    const u = makeUser({ teamIds: ["team-A", "team-B"] });
    expect(resolveOwningTeam(u, ["team-A", "team-B"])).toEqual({
      ok: false,
      code: "TEAM_REQUIRED",
    });
  });

  it("USER multi-équipes avec choix valide : accepté", () => {
    const u = makeUser({ teamIds: ["team-A", "team-B"] });
    expect(resolveOwningTeam(u, ["team-A", "team-B"], "team-A")).toEqual({
      ok: true,
      teamId: "team-A",
    });
  });

  it("choix hors des candidats : TEAM_FORBIDDEN", () => {
    const u = makeUser({ teamIds: ["team-A", "team-B"] });
    expect(resolveOwningTeam(u, ["team-A", "team-B"], "team-Z")).toEqual({
      ok: false,
      code: "TEAM_FORBIDDEN",
    });
  });

  it("ADMIN global, entité partagée sans choix : TEAM_REQUIRED (doit choisir)", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(resolveOwningTeam(admin, ["team-A", "team-B"])).toEqual({
      ok: false,
      code: "TEAM_REQUIRED",
    });
  });

  it("ADMIN global peut choisir n'importe quelle équipe DE L'ENTITÉ", () => {
    const admin = makeUser({ role: "ADMIN", teamIds: [] });
    expect(resolveOwningTeam(admin, ["team-A", "team-B"], "team-B")).toEqual({
      ok: true,
      teamId: "team-B",
    });
    // mais pas une équipe qui n'est pas rattachée à l'entité.
    expect(resolveOwningTeam(admin, ["team-A"], "team-Z")).toEqual({
      ok: false,
      code: "TEAM_FORBIDDEN",
    });
  });
});
