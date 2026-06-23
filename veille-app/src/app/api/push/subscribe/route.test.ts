import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const upsertSubscription = vi.fn();
const removeSubscriptionForUser = vi.fn();
const getOrCreatePreference = vi.fn();
const isPushEnabled = vi.fn(() => true);

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));

vi.mock("@/lib/featureFlags", () => ({
  isPushEnabled: () => isPushEnabled(),
}));

vi.mock("@/lib/push/subscriptions", () => ({
  upsertSubscription: (...a: unknown[]) => upsertSubscription(...a),
  removeSubscriptionForUser: (...a: unknown[]) =>
    removeSubscriptionForUser(...a),
  hashEndpoint: () => "deadbeef00000000",
}));

vi.mock("@/lib/push/preferences", () => ({
  getOrCreatePreference: (...a: unknown[]) => getOrCreatePreference(...a),
}));

import { DELETE, POST } from "./route";

beforeEach(() => {
  requireUser.mockReset();
  upsertSubscription.mockReset();
  removeSubscriptionForUser.mockReset();
  getOrCreatePreference.mockReset();
  isPushEnabled.mockReset();
  isPushEnabled.mockReturnValue(true);
});

function makeReq(body: unknown, opts: { invalidJson?: boolean } = {}) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    body: opts.invalidJson ? "not-json" : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function fakeUser(role: "USER" | "EDITOR" | "ADMIN" = "USER") {
  return { id: "u1", role, teamIds: [], email: "x@y.z", name: "X" };
}

const VALID_BODY = {
  endpoint: "https://fcm.googleapis.com/abc",
  keys: { p256dh: "p256-base64url", auth: "auth-base64url" },
  platform: "android",
  userAgent: "Mozilla/5.0 Android",
};

describe("POST /api/push/subscribe", () => {
  it("sans auth → 401", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 401 }),
    );
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(401);
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("ENABLE_PUSH=false → 503", async () => {
    isPushEnabled.mockReturnValue(false);
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(503);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("body JSON invalide → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await POST(makeReq(null, { invalidJson: true }));
    expect(res.status).toBe(400);
  });

  it("body sans endpoint → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await POST(
      makeReq({ keys: { p256dh: "x", auth: "y" } }),
    );
    expect(res.status).toBe(400);
  });

  it("body avec userId fake → 400 (strict refuse les clés inconnues)", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await POST(
      makeReq({ ...VALID_BODY, userId: "u-intrus" }),
    );
    expect(res.status).toBe(400);
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("happy path → 200 ok + helper appelé avec userId de la session", async () => {
    requireUser.mockResolvedValue(fakeUser());
    upsertSubscription.mockResolvedValue(undefined);
    getOrCreatePreference.mockResolvedValue({});
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(upsertSubscription).toHaveBeenCalledWith({
      userId: "u1",
      endpoint: VALID_BODY.endpoint,
      p256dh: VALID_BODY.keys.p256dh,
      auth: VALID_BODY.keys.auth,
      platform: "android",
      userAgent: VALID_BODY.userAgent,
    });
    expect(getOrCreatePreference).toHaveBeenCalledWith("u1");
  });

  it("USER / EDITOR / ADMIN : tous les rôles fonctionnent", async () => {
    upsertSubscription.mockResolvedValue(undefined);
    getOrCreatePreference.mockResolvedValue({});
    for (const role of ["USER", "EDITOR", "ADMIN"] as const) {
      requireUser.mockResolvedValueOnce(fakeUser(role));
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(200);
    }
  });

  it("erreur upsert → 500", async () => {
    requireUser.mockResolvedValue(fakeUser());
    upsertSubscription.mockRejectedValue(new Error("DB down"));
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it("Cache-Control private no-store sur réponse OK", async () => {
    requireUser.mockResolvedValue(fakeUser());
    upsertSubscription.mockResolvedValue(undefined);
    getOrCreatePreference.mockResolvedValue({});
    const res = await POST(makeReq(VALID_BODY));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

function makeDelReq(body: unknown, opts: { invalidJson?: boolean } = {}) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "DELETE",
    body: opts.invalidJson ? "not-json" : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("DELETE /api/push/subscribe", () => {
  it("sans auth → 401", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 401 }),
    );
    const res = await DELETE(
      makeDelReq({ endpoint: "https://x/y" }),
    );
    expect(res.status).toBe(401);
  });

  it("body invalide → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await DELETE(makeDelReq({}));
    expect(res.status).toBe(400);
  });

  it("happy path → 200 + helper appelé avec userId session", async () => {
    requireUser.mockResolvedValue(fakeUser());
    removeSubscriptionForUser.mockResolvedValue(true);
    const res = await DELETE(
      makeDelReq({ endpoint: "https://x/y" }),
    );
    expect(res.status).toBe(200);
    expect(removeSubscriptionForUser).toHaveBeenCalledWith(
      "u1",
      "https://x/y",
    );
  });

  it("idempotent — count 0 renvoie quand même 200 ok:true", async () => {
    requireUser.mockResolvedValue(fakeUser());
    removeSubscriptionForUser.mockResolvedValue(false);
    const res = await DELETE(
      makeDelReq({ endpoint: "absent" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
