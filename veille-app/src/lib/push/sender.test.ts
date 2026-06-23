import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    sendNotification: (...a: unknown[]) => sendNotification(...a),
    setVapidDetails: (...a: unknown[]) => setVapidDetails(...a),
  },
}));

const findMany = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

const isPushEnabled = vi.fn(() => true);
vi.mock("@/lib/featureFlags", () => ({
  isPushEnabled: () => isPushEnabled(),
}));

const getOrCreatePreference = vi.fn();
vi.mock("@/lib/push/preferences", () => ({
  getOrCreatePreference: (...a: unknown[]) => getOrCreatePreference(...a),
}));

// Hash déterministe pour vérifier qu'il est bien utilisé en logs.
vi.mock("@/lib/push/subscriptions", () => ({
  hashEndpoint: () => "deadbeef00000000",
}));

import {
  _resetVapidConfigCacheForTests,
  sendPushNotification,
} from "./sender";

const NOTIF = {
  id: "n1",
  type: "ECHEANCE_CRITICAL_ON_MY_PERIMETER",
  title: "Visite trimestrielle critique",
  message: "Site Alpha — en retard de 12 j",
  targetUrl: "/sites/s1",
  dedupKey: "ECHEANCE_CRITICAL_ON_MY_PERIMETER:VISIT_QUARTERLY:s1",
};

function setVapidEnv() {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
    "BCK71A4tn6llebfb4nrFJYst0hQmZQsQFf2Y-1Uq8l3VnrYfoVcqyfu_1ihsuSBKVk1Kc9fUonQ942BL53jEgHo";
  process.env.VAPID_PRIVATE_KEY = "private-key-test";
  process.env.VAPID_SUBJECT = "mailto:test@veille.local";
}

function unsetVapidEnv() {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
}

beforeEach(() => {
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  findMany.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
  isPushEnabled.mockReset();
  isPushEnabled.mockReturnValue(true);
  getOrCreatePreference.mockReset();
  _resetVapidConfigCacheForTests();
  setVapidEnv();
});

// ─── ENABLE_PUSH=false ──────────────────────────────────────────────────────

describe("sendPushNotification — feature flag", () => {
  it("ENABLE_PUSH=false → skipped:disabled, aucun appel web-push", async () => {
    isPushEnabled.mockReturnValue(false);
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "disabled" });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(getOrCreatePreference).not.toHaveBeenCalled();
  });
});

// ─── VAPID config ──────────────────────────────────────────────────────────

describe("sendPushNotification — config VAPID", () => {
  it("variables manquantes → skipped:no-vapid", async () => {
    unsetVapidEnv();
    _resetVapidConfigCacheForTests();
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "no-vapid" });
    expect(setVapidDetails).not.toHaveBeenCalled();
  });

  it("setVapidDetails throw → skipped:no-vapid (mémoize l'échec)", async () => {
    setVapidDetails.mockImplementation(() => {
      throw new Error("bad key");
    });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "no-vapid" });
  });
});

// ─── Mapping catégorie ──────────────────────────────────────────────────────

describe("sendPushNotification — mapping catégorie", () => {
  it("type non mappé (ACTION_ASSIGNED_TO_ME) → skipped:no-category", async () => {
    const r = await sendPushNotification({
      userId: "u1",
      notification: { ...NOTIF, type: "ACTION_ASSIGNED_TO_ME" },
    });
    expect(r).toEqual({ status: "skipped", reason: "no-category" });
    expect(getOrCreatePreference).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});

// ─── Préférences ────────────────────────────────────────────────────────────

describe("sendPushNotification — préférences", () => {
  it("préférences absentes → créées lazy via getOrCreatePreference", async () => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    findMany.mockResolvedValue([]);
    await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(getOrCreatePreference).toHaveBeenCalledWith("u1");
  });

  it("pushEnabled=false → skipped:push-pref-off", async () => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: false,
      catEcheances: true,
      catEquipes: true,
    });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "push-pref-off" });
    expect(findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("catEcheances=false → skipped:category-off (échéance)", async () => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: false,
      catEquipes: true,
    });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "category-off" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("catEquipes=false → skipped:category-off (équipe)", async () => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: false,
    });
    const r = await sendPushNotification({
      userId: "u1",
      notification: { ...NOTIF, type: "TEAM_MEMBERSHIP_ADDED" },
    });
    expect(r).toEqual({ status: "skipped", reason: "category-off" });
  });
});

// ─── Abonnements ────────────────────────────────────────────────────────────

describe("sendPushNotification — abonnements", () => {
  beforeEach(() => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
  });

  it("aucun abonnement → skipped:no-subscription", async () => {
    findMany.mockResolvedValue([]);
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "no-subscription" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("succès sur 1 abonnement → sent:1, met à jour lastSuccessAt", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    sendNotification.mockResolvedValue({ statusCode: 201 });
    updateMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 1, failed: 0, removed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    // Vérifie le payload envoyé
    const call = sendNotification.mock.calls[0];
    expect(call[0]).toEqual({
      endpoint: "e1",
      keys: { p256dh: "p1", auth: "a1" },
    });
    const payload = JSON.parse(call[1]);
    expect(payload).toEqual({
      notificationId: "n1",
      title: NOTIF.title,
      body: NOTIF.message,
      targetUrl: "/sites/s1",
      tag: NOTIF.dedupKey,
    });
    // updateMany pour le succès
    const updateArgs = updateMany.mock.calls.find(
      (c) => c[0].where.id === "s1",
    );
    expect(updateArgs).toBeDefined();
    expect(updateArgs![0].data.lastSuccessAt).toBeInstanceOf(Date);
    expect(updateArgs![0].data.lastErrorAt).toBeNull();
    expect(updateArgs![0].data.lastErrorCode).toBeNull();
  });

  it("succès sur 3 abonnements → sent:3 (Promise.allSettled parallèle)", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
      { id: "s3", endpoint: "e3", p256dh: "p3", auth: "a3" },
    ]);
    sendNotification.mockResolvedValue({ statusCode: 201 });
    updateMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 3, failed: 0, removed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(3);
  });

  it("404 → supprime l'abonnement (removed)", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    const err = Object.assign(new Error("Not Found"), { statusCode: 404 });
    sendNotification.mockRejectedValue(err);
    deleteMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 0, failed: 0, removed: 1 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
    // updateMany NE doit PAS être appelé sur cette row (row déjà supprimée)
    expect(
      updateMany.mock.calls.find((c) => c[0].where.id === "s1"),
    ).toBeUndefined();
  });

  it("410 → supprime l'abonnement (removed)", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    sendNotification.mockRejectedValue(err);
    deleteMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 0, failed: 0, removed: 1 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("500 → conserve l'abonnement + écrit lastErrorAt/Code (failed)", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    const err = Object.assign(new Error("Server Error"), { statusCode: 500 });
    sendNotification.mockRejectedValue(err);
    updateMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 0, failed: 1, removed: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
    const updateArgs = updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "s1" });
    expect(updateArgs.data.lastErrorAt).toBeInstanceOf(Date);
    expect(updateArgs.data.lastErrorCode).toBe(500);
  });

  it("erreur sans statusCode → fallback 500 dans lastErrorCode", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    sendNotification.mockRejectedValue(new Error("ECONNRESET"));
    updateMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 0, failed: 1, removed: 0 });
    const updateArgs = updateMany.mock.calls[0][0];
    expect(updateArgs.data.lastErrorCode).toBe(500);
  });

  it("mix succès / 410 / 500 sur 3 abonnements", async () => {
    findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
      { id: "s3", endpoint: "e3", p256dh: "p3", auth: "a3" },
    ]);
    sendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error("g"), { statusCode: 410 }))
      .mockRejectedValueOnce(
        Object.assign(new Error("e"), { statusCode: 500 }),
      );
    updateMany.mockResolvedValue({ count: 1 });
    deleteMany.mockResolvedValue({ count: 1 });
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "sent", sent: 1, failed: 1, removed: 1 });
  });
});

// ─── Robustesse ─────────────────────────────────────────────────────────────

describe("sendPushNotification — robustesse", () => {
  beforeEach(() => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
  });

  it("erreur findMany inattendue → skipped:internal, jamais de throw", async () => {
    findMany.mockRejectedValue(new Error("DB down"));
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "internal" });
  });

  it("erreur getOrCreatePreference → skipped:internal", async () => {
    getOrCreatePreference.mockReset();
    getOrCreatePreference.mockRejectedValue(new Error("pref crash"));
    const r = await sendPushNotification({ userId: "u1", notification: NOTIF });
    expect(r).toEqual({ status: "skipped", reason: "internal" });
  });
});
