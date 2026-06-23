import { describe, expect, it } from "vitest";
import {
  buildSubscribePayload,
  detectPlatform,
  probePushSupport,
  urlBase64ToUint8Array,
} from "./client-utils";

describe("urlBase64ToUint8Array", () => {
  it("convertit une clé VAPID base64url valide", () => {
    // Clé VAPID dev générée en C1 — 65 bytes après decode.
    const key =
      "BCK71A4tn6llebfb4nrFJYst0hQmZQsQFf2Y-1Uq8l3VnrYfoVcqyfu_1ihsuSBKVk1Kc9fUonQ942BL53jEgHo";
    const out = urlBase64ToUint8Array(key);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(65);
    // P-256 uncompressed point — premier byte = 0x04.
    expect(out[0]).toBe(0x04);
  });

  it("gère le padding manquant (base64url)", () => {
    const noPad = "TWFuIQ"; // "Man!" en base64 sans padding
    const out = urlBase64ToUint8Array(noPad);
    expect(Array.from(out)).toEqual([0x4d, 0x61, 0x6e, 0x21]);
  });

  it("supporte les caractères - et _ (base64url vs base64)", () => {
    // base64url : - = + ; _ = /. On vérifie la translation.
    const url = "a-_b";
    const out = urlBase64ToUint8Array(url);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(3);
  });
});

describe("detectPlatform", () => {
  it("détecte iOS (iPhone)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(detectPlatform(ua)).toBe("ios");
  });

  it("détecte iOS (iPad)", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
    expect(detectPlatform(ua)).toBe("ios");
  });

  it("détecte Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
    expect(detectPlatform(ua)).toBe("android");
  });

  it("détecte desktop Chrome (Windows)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(detectPlatform(ua)).toBe("desktop");
  });

  it("détecte desktop macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
    expect(detectPlatform(ua)).toBe("desktop");
  });

  it("renvoie 'other' pour un UA exotique", () => {
    expect(detectPlatform("")).toBe("other");
    expect(detectPlatform("curl/8.0")).toBe("other");
  });
});

describe("buildSubscribePayload", () => {
  const context = {
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/120.0",
    platform: "android" as const,
  };

  it("happy path — compose le body attendu", () => {
    const raw = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p256-base64url", auth: "auth-base64url" },
    };
    const out = buildSubscribePayload(raw, context);
    expect(out).toEqual({
      endpoint: raw.endpoint,
      keys: { p256dh: "p256-base64url", auth: "auth-base64url" },
      platform: "android",
      userAgent: context.userAgent,
    });
  });

  it("renvoie null si endpoint manquant", () => {
    expect(
      buildSubscribePayload(
        { keys: { p256dh: "x", auth: "y" } },
        context,
      ),
    ).toBeNull();
  });

  it("renvoie null si p256dh manquant", () => {
    expect(
      buildSubscribePayload(
        { endpoint: "x", keys: { auth: "y" } },
        context,
      ),
    ).toBeNull();
  });

  it("renvoie null si auth manquant", () => {
    expect(
      buildSubscribePayload(
        { endpoint: "x", keys: { p256dh: "y" } },
        context,
      ),
    ).toBeNull();
  });

  it("tronque le userAgent à 500 chars", () => {
    const longUA = "x".repeat(1000);
    const out = buildSubscribePayload(
      {
        endpoint: "e",
        keys: { p256dh: "p", auth: "a" },
      },
      { userAgent: longUA, platform: "android" },
    );
    expect(out?.userAgent?.length).toBe(500);
  });
});

describe("probePushSupport", () => {
  const baseOk = {
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    isSecureContext: true,
    hasVapidKey: true,
  };

  it("supported quand tout est présent", () => {
    expect(probePushSupport(baseOk)).toEqual({ status: "supported" });
  });

  it("unsupported si PushManager manque", () => {
    expect(
      probePushSupport({ ...baseOk, hasPushManager: false }),
    ).toEqual({ status: "unsupported" });
  });

  it("unsupported si Notification manque", () => {
    expect(
      probePushSupport({ ...baseOk, hasNotification: false }),
    ).toEqual({ status: "unsupported" });
  });

  it("unsupported si serviceWorker manque (Safari sans SW)", () => {
    expect(
      probePushSupport({ ...baseOk, hasServiceWorker: false }),
    ).toEqual({ status: "unsupported" });
  });

  it("insecure si tout OK sauf isSecureContext", () => {
    expect(
      probePushSupport({ ...baseOk, isSecureContext: false }),
    ).toEqual({ status: "insecure" });
  });

  it("vapid-missing si tout OK sauf hasVapidKey", () => {
    expect(
      probePushSupport({ ...baseOk, hasVapidKey: false }),
    ).toEqual({ status: "vapid-missing" });
  });

  it("priorité : support manquant > insecure > vapid-missing", () => {
    // Browser non supporté ET pas en HTTPS ET pas de clé → unsupported gagne
    expect(
      probePushSupport({
        hasPushManager: false,
        hasNotification: false,
        hasServiceWorker: false,
        isSecureContext: false,
        hasVapidKey: false,
      }),
    ).toEqual({ status: "unsupported" });
  });
});
