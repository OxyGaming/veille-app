import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EcheanceItem } from "@/lib/echeances/types";

const findManyUser = vi.fn();
const findManyTeam = vi.fn();
const findManyUserTeam = vi.fn();
const createNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => findManyUser(...a) },
    team: { findMany: (...a: unknown[]) => findManyTeam(...a) },
    userTeam: { findMany: (...a: unknown[]) => findManyUserTeam(...a) },
  },
}));

vi.mock("./notifications", () => ({
  createNotification: (...a: unknown[]) => createNotification(...a),
}));

import {
  getNotificationRecipients,
  notifyActionAssigned,
  notifyActionValidated,
  notifyEcheancesCriticalForUser,
  notifyTeamHistoryAdded,
  notifyTeamMembershipAdded,
  notifyTeamMembershipAddedSafe,
  notifyVisitFinished,
} from "./notifications-generators";

beforeEach(() => {
  findManyUser.mockReset();
  findManyTeam.mockReset();
  findManyUserTeam.mockReset();
  createNotification.mockReset();
  createNotification.mockResolvedValue({ id: "n_fake" });
});

// ─── Recipients ─────────────────────────────────────────────────────────────

describe("getNotificationRecipients", () => {
  it("teamIds vide → renvoie [] sans requête", async () => {
    const out = await getNotificationRecipients([], null);
    expect(out).toEqual([]);
    expect(findManyUser).not.toHaveBeenCalled();
  });

  it("multi-team → filtre par OR teamId ∪ memberships", async () => {
    findManyUser.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const out = await getNotificationRecipients(["tA", "tB"], null);
    expect(out).toEqual(["u1", "u2"]);
    const arg = findManyUser.mock.calls[0][0];
    expect(arg.where.role.in).toEqual(["EDITOR", "ADMIN"]);
    expect(arg.where.OR).toEqual([
      { teamId: { in: ["tA", "tB"] } },
      { memberships: { some: { teamId: { in: ["tA", "tB"] } } } },
    ]);
    expect(arg.where.isActive).toBe(true);
  });

  it("excludeUserId propagé dans le where", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }]);
    await getNotificationRecipients(["tA"], "u1");
    const arg = findManyUser.mock.calls[0][0];
    expect(arg.where.id).toEqual({ not: "u1" });
  });

  it("rolesIn personnalisable", async () => {
    findManyUser.mockResolvedValue([]);
    await getNotificationRecipients(["tA"], null, { rolesIn: ["ADMIN"] });
    const arg = findManyUser.mock.calls[0][0];
    expect(arg.where.role.in).toEqual(["ADMIN"]);
  });

  it("erreur Prisma → renvoie [] sans throw", async () => {
    findManyUser.mockRejectedValue(new Error("boom"));
    const out = await getNotificationRecipients(["tA"], null);
    expect(out).toEqual([]);
  });
});

// ─── ACTION_ASSIGNED_TO_ME ──────────────────────────────────────────────────

describe("notifyActionAssigned", () => {
  it("1 notif par destinataire + bonne dédup + targetUrl agent", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);
    const created = await notifyActionAssigned({
      actionId: "act1",
      agentId: "ag1",
      agentName: "Dupont Jean",
      teamIds: ["tA"],
      authorId: "u1",
      actionLabel: "Refaire formation",
    });
    expect(created).toBe(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    const firstCall = createNotification.mock.calls[0][0];
    expect(firstCall).toMatchObject({
      type: "ACTION_ASSIGNED_TO_ME",
      title: "Nouvelle action",
      dedupKey: "ACTION_ASSIGNED_TO_ME:act1",
      targetUrl: "/agents/ag1?actionId=act1",
      metadata: { actionId: "act1", agentId: "ag1" },
    });
    expect(firstCall.message).toContain("Dupont Jean");
    expect(firstCall.message).toContain("Refaire formation");
  });

  it("auteur exclu côté getNotificationRecipients", async () => {
    findManyUser.mockResolvedValue([]);
    await notifyActionAssigned({
      actionId: "act1",
      agentId: "ag1",
      agentName: "x",
      teamIds: ["tA"],
      authorId: "u1",
      actionLabel: "x",
    });
    expect(findManyUser.mock.calls[0][0].where.id).toEqual({ not: "u1" });
  });

  it("createNotification retournant null (dédup) ne compte pas", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);
    createNotification
      .mockResolvedValueOnce({ id: "n1" })
      .mockResolvedValueOnce(null);
    const created = await notifyActionAssigned({
      actionId: "act1",
      agentId: "ag1",
      agentName: "x",
      teamIds: ["tA"],
      authorId: "u1",
      actionLabel: "x",
    });
    expect(created).toBe(1);
  });
});

// ─── ACTION_VALIDATED_ON_MY_ACTION ──────────────────────────────────────────

describe("notifyActionValidated", () => {
  it("dédup par actionId + targetUrl agent si agentId présent", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }]);
    await notifyActionValidated({
      actionId: "act1",
      agentId: "ag1",
      siteId: null,
      teamIds: ["tA"],
      validatorId: "u1",
      validatorName: "Marie",
      actionLabel: "Refaire formation",
    });
    const call = createNotification.mock.calls[0][0];
    expect(call.dedupKey).toBe("ACTION_VALIDATED_ON_MY_ACTION:act1");
    expect(call.targetUrl).toBe("/agents/ag1?actionId=act1");
    expect(call.message).toContain("Marie");
  });

  it("targetUrl site si agentId null mais siteId présent", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }]);
    await notifyActionValidated({
      actionId: "act2",
      agentId: null,
      siteId: "s1",
      teamIds: ["tA"],
      validatorId: "u1",
      validatorName: "x",
      actionLabel: "x",
    });
    expect(createNotification.mock.calls[0][0].targetUrl).toBe("/sites/s1");
  });

  it("targetUrl fallback /today si ni agent ni site", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }]);
    await notifyActionValidated({
      actionId: "act3",
      agentId: null,
      siteId: null,
      teamIds: ["tA"],
      validatorId: "u1",
      validatorName: "x",
      actionLabel: "x",
    });
    expect(createNotification.mock.calls[0][0].targetUrl).toBe("/today");
  });
});

// ─── VISIT_FINISHED_ON_MY_SITE ───────────────────────────────────────────────

describe("notifyVisitFinished", () => {
  it("dédup par visitId + targetUrl rapport visite", async () => {
    findManyUser.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);
    const created = await notifyVisitFinished({
      visitId: "v1",
      siteId: "s1",
      siteName: "Alpha",
      teamIds: ["tA", "tB"],
      observerId: "u1",
      observerName: "Marie",
    });
    expect(created).toBe(2);
    const call = createNotification.mock.calls[0][0];
    expect(call.dedupKey).toBe("VISIT_FINISHED_ON_MY_SITE:v1");
    expect(call.targetUrl).toBe("/visits/v1/report");
    expect(call.message).toContain("Marie");
    expect(call.message).toContain("Alpha");
    expect(call.metadata).toEqual({ visitId: "v1", siteId: "s1" });
  });

  it("observer exclu", async () => {
    findManyUser.mockResolvedValue([]);
    await notifyVisitFinished({
      visitId: "v1",
      siteId: "s1",
      siteName: "x",
      teamIds: ["tA"],
      observerId: "u1",
      observerName: "x",
    });
    expect(findManyUser.mock.calls[0][0].where.id).toEqual({ not: "u1" });
  });
});

// ─── ECHEANCE_CRITICAL_ON_MY_PERIMETER ───────────────────────────────────────

function mkItem(
  partial: Partial<EcheanceItem> & Pick<EcheanceItem, "id" | "kind">,
): EcheanceItem {
  return {
    title: "x",
    dueAt: null,
    daysToDue: null,
    urgency: "late",
    isCritical: true,
    context: { teamIds: [] },
    cta: { label: "Ouvrir", href: "/x" },
    ...partial,
  };
}

describe("notifyEcheancesCriticalForUser", () => {
  it("filtre isCritical → ignore les items non critiques", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "VISIT_QUARTERLY:s1",
        kind: "VISIT_QUARTERLY",
        isCritical: true,
        cta: { label: "Ouvrir le site", href: "/sites/s1" },
      }),
      mkItem({
        id: "VISIT_PLANNED:s2",
        kind: "VISIT_PLANNED",
        isCritical: false,
      }),
    ];
    const n = await notifyEcheancesCriticalForUser("u1", items);
    expect(n).toBe(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("aucun item critique → 0 notifs, pas d'appel", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "ACTION_OVERDUE:a1",
        kind: "ACTION_OVERDUE",
        isCritical: false,
      }),
    ];
    const n = await notifyEcheancesCriticalForUser("u1", items);
    expect(n).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("dedupKey = TYPE:KIND:sourceId (1 notif par item à vie)", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "VISIT_QUARTERLY:s1",
        kind: "VISIT_QUARTERLY",
        isCritical: true,
        cta: { label: "Ouvrir le site", href: "/sites/s1" },
      }),
    ];
    await notifyEcheancesCriticalForUser("u1", items);
    expect(createNotification.mock.calls[0][0].dedupKey).toBe(
      "ECHEANCE_CRITICAL_ON_MY_PERIMETER:VISIT_QUARTERLY:s1",
    );
    expect(createNotification.mock.calls[0][0].targetUrl).toBe("/sites/s1");
  });

  it("targetUrl = item.cta.href (réutilise C9 Sprint 4)", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "ACTION_OVERDUE:act1",
        kind: "ACTION_OVERDUE",
        isCritical: true,
        cta: { label: "Valider", href: "/agents/ag1?actionId=act1" },
      }),
    ];
    await notifyEcheancesCriticalForUser("u1", items);
    expect(createNotification.mock.calls[0][0].targetUrl).toBe(
      "/agents/ag1?actionId=act1",
    );
  });

  it("message inclut « jamais effectué » si daysToDue=null", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "VISIT_QUARTERLY:s1",
        kind: "VISIT_QUARTERLY",
        title: "Visite trimestrielle",
        subtitle: "Site Alpha",
        isCritical: true,
        daysToDue: null,
      }),
    ];
    await notifyEcheancesCriticalForUser("u1", items);
    const msg = createNotification.mock.calls[0][0].message;
    expect(msg).toContain("Visite trimestrielle");
    expect(msg).toContain("Site Alpha");
    expect(msg).toContain("jamais effectué");
  });

  it("message inclut « en retard de N j » si daysToDue<0", async () => {
    const items: EcheanceItem[] = [
      mkItem({
        id: "ACTION_OVERDUE:a1",
        kind: "ACTION_OVERDUE",
        title: "Refaire formation",
        isCritical: true,
        daysToDue: -42,
      }),
    ];
    await notifyEcheancesCriticalForUser("u1", items);
    expect(createNotification.mock.calls[0][0].message).toContain(
      "en retard de 42 j",
    );
  });
});

// ─── notifyTeamMembershipAdded (Sprint Push V1 — C9) ────────────────────────

describe("notifyTeamMembershipAdded", () => {
  const baseInput = {
    userId: "u1",
    teamId: "tA",
    teamName: "Rive Droite Nord",
    actorId: "admin1",
  };

  it("happy path — Notification créée avec bons champs", async () => {
    createNotification.mockResolvedValue({ id: "n1" });
    const n = await notifyTeamMembershipAdded(baseInput);
    expect(n).toBe(1);
    const arg = createNotification.mock.calls[0][0];
    expect(arg.userId).toBe("u1");
    expect(arg.type).toBe("TEAM_MEMBERSHIP_ADDED");
    expect(arg.title).toBe("Nouvelle équipe");
    expect(arg.message).toBe(
      "Vous avez été ajouté à l'équipe Rive Droite Nord.",
    );
    expect(arg.targetUrl).toBe("/today");
    expect(arg.dedupKey).toBe("TEAM_MEMBERSHIP_ADDED:tA:u1");
    expect(arg.metadata).toEqual({ teamId: "tA", actorId: "admin1" });
  });

  it("dédup → renvoie 0 si createNotification renvoie null (P2002)", async () => {
    createNotification.mockResolvedValue(null);
    const n = await notifyTeamMembershipAdded(baseInput);
    expect(n).toBe(0);
  });

  it("dedupKey stable — 2 appels avec (teamId, userId) identiques → même clé", async () => {
    createNotification.mockResolvedValue({ id: "n1" });
    await notifyTeamMembershipAdded(baseInput);
    await notifyTeamMembershipAdded(baseInput);
    const k1 = createNotification.mock.calls[0][0].dedupKey;
    const k2 = createNotification.mock.calls[1][0].dedupKey;
    expect(k1).toBe(k2);
  });

  it("actor self-add — admin s'ajoute lui-même → notif créée quand même", async () => {
    createNotification.mockResolvedValue({ id: "n1" });
    const n = await notifyTeamMembershipAdded({
      userId: "admin1",
      teamId: "tA",
      teamName: "X",
      actorId: "admin1",
    });
    expect(n).toBe(1);
    expect(createNotification.mock.calls[0][0].userId).toBe("admin1");
  });

  it("Safe — catch en silence si createNotification throw", async () => {
    createNotification.mockRejectedValue(new Error("boom"));
    const n = await notifyTeamMembershipAddedSafe(baseInput);
    expect(n).toBe(0);
  });
});

// ─── notifyTeamHistoryAdded (Sprint Push V1 — C9) ───────────────────────────

describe("notifyTeamHistoryAdded", () => {
  const baseInput = {
    teamIds: ["tA"],
    entityType: "session",
    entityId: "s1",
    actorId: "u-actor",
    targetUrl: "/sessions/s1",
  };

  function setupTeams(teams: { id: string; name: string }[]) {
    findManyTeam.mockResolvedValue(teams);
  }

  function setupMemberships(rows: { userId: string; teamId: string }[]) {
    findManyUserTeam.mockResolvedValue(rows);
  }

  it("teamIds vide → 0, aucune requête", async () => {
    const n = await notifyTeamHistoryAdded({ ...baseInput, teamIds: [] });
    expect(n).toBe(0);
    expect(findManyTeam).not.toHaveBeenCalled();
    expect(findManyUserTeam).not.toHaveBeenCalled();
  });

  it("teamIds dédupliqués (set+filter)", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([]);
    await notifyTeamHistoryAdded({
      ...baseInput,
      teamIds: ["tA", "tA", "", null as unknown as string],
    });
    expect(findManyTeam.mock.calls[0][0].where.id.in).toEqual(["tA"]);
  });

  it("acteur exclu du fetch memberships", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([]);
    await notifyTeamHistoryAdded(baseInput);
    const where = findManyUserTeam.mock.calls[0][0].where;
    expect(where.userId).toEqual({ not: "u-actor" });
    expect(where.user).toEqual({ isActive: true });
  });

  it("sans actorId → où.userId absent", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([]);
    await notifyTeamHistoryAdded({ ...baseInput, actorId: null });
    const where = findManyUserTeam.mock.calls[0][0].where;
    expect(where.userId).toBeUndefined();
  });

  it("happy path SANS detailMessage — title/message génériques (compat C9 initial)", async () => {
    setupTeams([{ id: "tA", name: "Rive Droite Nord" }]);
    setupMemberships([{ userId: "u1", teamId: "tA" }]);
    createNotification.mockResolvedValue({ id: "n1" });
    const n = await notifyTeamHistoryAdded(baseInput);
    expect(n).toBe(1);
    const arg = createNotification.mock.calls[0][0];
    expect(arg.userId).toBe("u1");
    expect(arg.type).toBe("TEAM_HISTORY_ADDED");
    expect(arg.title).toBe("Nouvel élément d'historique");
    expect(arg.message).toBe(
      "Un nouvel élément a été ajouté dans l'historique de l'équipe Rive Droite Nord.",
    );
    expect(arg.targetUrl).toBe("/sessions/s1");
    expect(arg.dedupKey).toBe("TEAM_HISTORY_ADDED:session:s1:u1");
    expect(arg.metadata.teamName).toBe("Rive Droite Nord");
  });

  it("AVEC detailMessage — title = Équipe X, message = détail métier (C9.1)", async () => {
    setupTeams([{ id: "tA", name: "Rive Droite Nord" }]);
    setupMemberships([{ userId: "u1", teamId: "tA" }]);
    createNotification.mockResolvedValue({ id: "n1" });
    const n = await notifyTeamHistoryAdded({
      ...baseInput,
      detailMessage: "Marie a terminé une visite — POS-LYON.",
    });
    expect(n).toBe(1);
    const arg = createNotification.mock.calls[0][0];
    expect(arg.title).toBe("Équipe Rive Droite Nord");
    expect(arg.message).toBe("Marie a terminé une visite — POS-LYON.");
    expect(arg.metadata.teamName).toBe("Rive Droite Nord");
  });

  it("detailMessage trim — string vide ou whitespace → fallback générique", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([{ userId: "u1", teamId: "tA" }]);
    createNotification.mockResolvedValue({ id: "n1" });
    await notifyTeamHistoryAdded({ ...baseInput, detailMessage: "   " });
    expect(createNotification.mock.calls[0][0].title).toBe(
      "Nouvel élément d'historique",
    );
  });

  it("targetUrl fallback /history si non fourni", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([{ userId: "u1", teamId: "tA" }]);
    createNotification.mockResolvedValue({ id: "n1" });
    await notifyTeamHistoryAdded({ ...baseInput, targetUrl: null });
    expect(createNotification.mock.calls[0][0].targetUrl).toBe("/history");
  });

  it("multi-équipes — user dédupliqué (1 notif même s'il appartient à 2 équipes)", async () => {
    setupTeams([
      { id: "tA", name: "Alpha" },
      { id: "tB", name: "Beta" },
    ]);
    // u1 dans tA ET tB ; u2 uniquement dans tB
    setupMemberships([
      { userId: "u1", teamId: "tA" },
      { userId: "u1", teamId: "tB" },
      { userId: "u2", teamId: "tB" },
    ]);
    createNotification.mockResolvedValue({ id: "n" });
    const n = await notifyTeamHistoryAdded({
      ...baseInput,
      teamIds: ["tA", "tB"],
    });
    expect(n).toBe(2);
    // 1 createNotification par destinataire, pas 3
    expect(createNotification).toHaveBeenCalledTimes(2);
    const userIds = createNotification.mock.calls.map((c) => c[0].userId);
    expect(userIds.sort()).toEqual(["u1", "u2"]);
  });

  it("dedupKey contient userId — 2 users → 2 dedupKeys distincts", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([
      { userId: "u1", teamId: "tA" },
      { userId: "u2", teamId: "tA" },
    ]);
    createNotification.mockResolvedValue({ id: "n" });
    await notifyTeamHistoryAdded(baseInput);
    const keys = createNotification.mock.calls.map((c) => c[0].dedupKey);
    expect(keys).toEqual([
      "TEAM_HISTORY_ADDED:session:s1:u1",
      "TEAM_HISTORY_ADDED:session:s1:u2",
    ]);
  });

  it("aucun membre éligible → 0", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([]);
    const n = await notifyTeamHistoryAdded(baseInput);
    expect(n).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("doublon — createNotification renvoie null pour 1 user → compte juste les créés", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([
      { userId: "u1", teamId: "tA" },
      { userId: "u2", teamId: "tA" },
    ]);
    createNotification
      .mockResolvedValueOnce({ id: "n1" })
      .mockResolvedValueOnce(null); // u2 déjà notifié
    const n = await notifyTeamHistoryAdded(baseInput);
    expect(n).toBe(1);
  });

  it("isActive=true exigé dans le where memberships (cloisonnement strict)", async () => {
    setupTeams([{ id: "tA", name: "RDN" }]);
    setupMemberships([]);
    await notifyTeamHistoryAdded(baseInput);
    expect(findManyUserTeam.mock.calls[0][0].where.user.isActive).toBe(true);
  });

  it("erreur Prisma → catch + 0 (jamais de throw)", async () => {
    findManyTeam.mockRejectedValue(new Error("DB down"));
    const n = await notifyTeamHistoryAdded(baseInput);
    expect(n).toBe(0);
  });
});
