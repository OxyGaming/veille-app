import { describe, it, expect } from "vitest";
import { assertTeamAccess, type SessionUser } from "./auth";

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
