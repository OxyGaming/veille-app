import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EcheanceItem } from "@/lib/echeances/types";

const findManyUser = vi.fn();
const createNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => findManyUser(...a) },
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
  notifyVisitFinished,
} from "./notifications-generators";

beforeEach(() => {
  findManyUser.mockReset();
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
