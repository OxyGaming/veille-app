import { beforeEach, describe, expect, it, vi } from "vitest";

const notifCount = vi.fn();
const notifDelete = vi.fn();
const taCount = vi.fn();
const taDelete = vi.fn();
const auditCount = vi.fn();
const auditDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      count: (...a: unknown[]) => notifCount(...a),
      deleteMany: (...a: unknown[]) => notifDelete(...a),
    },
    teamActivity: {
      count: (...a: unknown[]) => taCount(...a),
      deleteMany: (...a: unknown[]) => taDelete(...a),
    },
    auditLog: {
      count: (...a: unknown[]) => auditCount(...a),
      deleteMany: (...a: unknown[]) => auditDelete(...a),
    },
  },
}));

import { RETENTION_THRESHOLDS, runRetention } from "./retention";

const NOW = new Date("2026-06-14T12:00:00.000Z");

beforeEach(() => {
  notifCount.mockReset();
  notifDelete.mockReset();
  taCount.mockReset();
  taDelete.mockReset();
  auditCount.mockReset();
  auditDelete.mockReset();
});

describe("RETENTION_THRESHOLDS", () => {
  it("seuils PO D6 figés", () => {
    expect(RETENTION_THRESHOLDS).toEqual({
      notificationsRead: 90,
      notificationsUnread: 180,
      teamActivity: 180,
      auditLog: 365,
    });
  });
});

describe("runRetention — dry-run (par défaut)", () => {
  it("count les 4 scopes, ne supprime rien, deleted=0", async () => {
    notifCount
      .mockResolvedValueOnce(10) // read old
      .mockResolvedValueOnce(5); // unread old
    taCount.mockResolvedValue(20);
    auditCount.mockResolvedValue(30);

    const r = await runRetention(NOW, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.detected).toEqual({
      notificationsRead: 10,
      notificationsUnread: 5,
      teamActivity: 20,
      auditLog: 30,
    });
    expect(r.deleted).toEqual({
      notificationsRead: 0,
      notificationsUnread: 0,
      teamActivity: 0,
      auditLog: 0,
    });
    expect(notifDelete).not.toHaveBeenCalled();
    expect(taDelete).not.toHaveBeenCalled();
    expect(auditDelete).not.toHaveBeenCalled();
  });

  it("expose les cutoffs ISO + executedAt", async () => {
    notifCount.mockResolvedValue(0);
    taCount.mockResolvedValue(0);
    auditCount.mockResolvedValue(0);
    const r = await runRetention(NOW, { dryRun: true });
    expect(r.executedAt).toBe(NOW.toISOString());
    // 90 jours avant NOW
    expect(r.cutoffs.notificationsRead).toBe(
      new Date(NOW.getTime() - 90 * 86_400_000).toISOString(),
    );
    expect(r.cutoffs.notificationsUnread).toBe(
      new Date(NOW.getTime() - 180 * 86_400_000).toISOString(),
    );
    expect(r.cutoffs.teamActivity).toBe(
      new Date(NOW.getTime() - 180 * 86_400_000).toISOString(),
    );
    expect(r.cutoffs.auditLog).toBe(
      new Date(NOW.getTime() - 365 * 86_400_000).toISOString(),
    );
  });

  it("`where` notif read old = { readAt: { not: null, lt: cutoff } }", async () => {
    notifCount.mockResolvedValue(0);
    taCount.mockResolvedValue(0);
    auditCount.mockResolvedValue(0);
    await runRetention(NOW, { dryRun: true });
    const readCall = notifCount.mock.calls[0][0];
    const unreadCall = notifCount.mock.calls[1][0];
    expect(readCall.where.readAt).toMatchObject({ not: null });
    expect(readCall.where.readAt.lt).toBeInstanceOf(Date);
    expect(unreadCall.where).toEqual({
      readAt: null,
      createdAt: { lt: expect.any(Date) },
    });
  });
});

describe("runRetention — apply (dryRun=false)", () => {
  it("supprime + remonte `deleted.count`", async () => {
    notifCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    taCount.mockResolvedValue(15);
    auditCount.mockResolvedValue(8);
    notifDelete
      .mockResolvedValueOnce({ count: 7 })
      .mockResolvedValueOnce({ count: 3 });
    taDelete.mockResolvedValue({ count: 15 });
    auditDelete.mockResolvedValue({ count: 8 });

    const r = await runRetention(NOW, { dryRun: false });
    expect(r.dryRun).toBe(false);
    expect(r.detected).toEqual({
      notificationsRead: 7,
      notificationsUnread: 3,
      teamActivity: 15,
      auditLog: 8,
    });
    expect(r.deleted).toEqual({
      notificationsRead: 7,
      notificationsUnread: 3,
      teamActivity: 15,
      auditLog: 8,
    });
    expect(notifDelete).toHaveBeenCalledTimes(2);
    expect(taDelete).toHaveBeenCalledTimes(1);
    expect(auditDelete).toHaveBeenCalledTimes(1);
  });

  it("idempotent : 2e appel sur DB déjà purgée → detected=0, deleted=0", async () => {
    notifCount.mockResolvedValue(0);
    taCount.mockResolvedValue(0);
    auditCount.mockResolvedValue(0);
    notifDelete.mockResolvedValue({ count: 0 });
    taDelete.mockResolvedValue({ count: 0 });
    auditDelete.mockResolvedValue({ count: 0 });
    const r = await runRetention(NOW, { dryRun: false });
    expect(r.detected).toEqual({
      notificationsRead: 0,
      notificationsUnread: 0,
      teamActivity: 0,
      auditLog: 0,
    });
    expect(r.deleted).toEqual({
      notificationsRead: 0,
      notificationsUnread: 0,
      teamActivity: 0,
      auditLog: 0,
    });
  });

  it("deleted.count peut différer marginalement de detected (concurrence)", async () => {
    // Simulation : 5 détectées, 6 supprimées (1 insertion entre temps)
    notifCount.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    taCount.mockResolvedValue(0);
    auditCount.mockResolvedValue(0);
    notifDelete
      .mockResolvedValueOnce({ count: 6 })
      .mockResolvedValueOnce({ count: 0 });
    taDelete.mockResolvedValue({ count: 0 });
    auditDelete.mockResolvedValue({ count: 0 });
    const r = await runRetention(NOW, { dryRun: false });
    expect(r.detected.notificationsRead).toBe(5);
    expect(r.deleted.notificationsRead).toBe(6); // source de vérité opérationnelle
  });
});
