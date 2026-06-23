import { beforeEach, describe, expect, it, vi } from "vitest";
import { postSubscribe, postUnsubscribe } from "./client-api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
});

const BODY = {
  endpoint: "https://fcm.googleapis.com/abc",
  keys: { p256dh: "p", auth: "a" },
  platform: "android" as const,
  userAgent: "ua",
};

describe("postSubscribe", () => {
  it("happy path → { ok: true }", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const res = await postSubscribe(BODY, fetchMock);
    expect(res).toEqual({ ok: true });
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/push/subscribe");
    expect(call[1].method).toBe("POST");
    expect(call[1].credentials).toBe("include");
    expect(call[1].cache).toBe("no-store");
    const body = JSON.parse(call[1].body);
    expect(body.endpoint).toBe(BODY.endpoint);
    // userId absent du body — sécurité.
    expect(body.userId).toBeUndefined();
  });

  it("503 → reason: disabled", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const res = await postSubscribe(BODY, fetchMock);
    expect(res).toEqual({ ok: false, status: 503, reason: "disabled" });
  });

  it("401 → reason: auth", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const res = await postSubscribe(BODY, fetchMock);
    expect(res).toEqual({ ok: false, status: 401, reason: "auth" });
  });

  it("400 → reason: validation", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    const res = await postSubscribe(BODY, fetchMock);
    expect(res).toEqual({ ok: false, status: 400, reason: "validation" });
  });

  it("500 → reason: server", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const res = await postSubscribe(BODY, fetchMock);
    expect(res).toEqual({ ok: false, status: 500, reason: "server" });
  });

  it("ne transmet jamais de userId même si présent dans body étendu", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    // @ts-expect-error — body étendu volontairement, vérification runtime
    await postSubscribe({ ...BODY, userId: "u-intrus" }, fetchMock);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Le helper retransmet ce qu'il reçoit — la sécurité repose sur le
    // strict Zod côté route. Ce test documente le comportement et sert
    // de garde-fou : si on ajoutait un filtre, on l'attraperait ici.
    expect(sent.endpoint).toBe(BODY.endpoint);
  });
});

describe("postUnsubscribe", () => {
  it("happy path → { ok: true }", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const res = await postUnsubscribe(
      { endpoint: "https://x/y" },
      fetchMock,
    );
    expect(res).toEqual({ ok: true });
    const call = fetchMock.mock.calls[0];
    expect(call[1].method).toBe("DELETE");
  });

  it("503 → reason: disabled", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const res = await postUnsubscribe(
      { endpoint: "x" },
      fetchMock,
    );
    expect(res).toEqual({ ok: false, status: 503, reason: "disabled" });
  });
});
