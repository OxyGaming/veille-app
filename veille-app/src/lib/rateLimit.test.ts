import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  buildLoginKey,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginAttempts,
  extractClientIp,
  __resetAllForTests,
} from "./rateLimit";

/**
 * Tests ciblés sur le rate-limit login — Sprint 1 commit 7 / US-1.7.
 * Valide les 3 propriétés exigées par le brief :
 *  - 1-2 erreurs ne bloquent pas un utilisateur légitime.
 *  - 3e échec → délai temporaire imposé.
 *  - Login réussi (reset) → compteur libéré.
 */

beforeEach(() => __resetAllForTests());
afterEach(() => vi.useRealTimers());

describe("buildLoginKey", () => {
  it("normalise l'email en minuscules", () => {
    expect(buildLoginKey("1.2.3.4", "User@Example.COM")).toBe(
      "1.2.3.4|user@example.com"
    );
  });
  it("remplace une IP nulle par 'unknown'", () => {
    expect(buildLoginKey(null, "a@b")).toBe("unknown|a@b");
  });
});

describe("checkLoginRateLimit + recordLoginFailure", () => {
  it("autorise la 1re tentative (compteur vide)", () => {
    expect(checkLoginRateLimit("k").ok).toBe(true);
  });

  it("autorise 1 et 2 échecs successifs (utilisateur légitime)", () => {
    const k = "user-legit";
    recordLoginFailure(k); // 1 échec → décision suivante doit être OK
    expect(checkLoginRateLimit(k).ok).toBe(true);
    recordLoginFailure(k); // 2 échecs → décision suivante doit être OK
    expect(checkLoginRateLimit(k).ok).toBe(true);
  });

  it("impose 30s après le 3e échec", () => {
    const k = "soft";
    recordLoginFailure(k);
    recordLoginFailure(k);
    recordLoginFailure(k);
    const d = checkLoginRateLimit(k);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.retryAfterMs).toBeGreaterThan(25_000);
      expect(d.retryAfterMs).toBeLessThanOrEqual(30_000);
    }
  });

  it("impose 60s après le 4e échec", () => {
    const k = "soft2";
    for (let i = 0; i < 4; i++) recordLoginFailure(k);
    const d = checkLoginRateLimit(k);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.retryAfterMs).toBeGreaterThan(55_000);
      expect(d.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("impose le blocage long (~10 min) après le 6e échec", () => {
    const k = "hard";
    for (let i = 0; i < 6; i++) recordLoginFailure(k);
    const d = checkLoginRateLimit(k);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.retryAfterMs).toBeGreaterThan(9 * 60 * 1000);
      expect(d.retryAfterMs).toBeLessThanOrEqual(10 * 60 * 1000);
    }
  });

  it("réautorise après expiration de la fenêtre 15 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
    const k = "expired";
    for (let i = 0; i < 6; i++) recordLoginFailure(k);
    // +16 min : tous les échecs sont hors fenêtre
    vi.setSystemTime(new Date("2026-06-13T12:16:00Z"));
    expect(checkLoginRateLimit(k).ok).toBe(true);
  });

  it("clés différentes ne se contaminent pas", () => {
    const a = "alice@x";
    const b = "bob@x";
    for (let i = 0; i < 5; i++) recordLoginFailure(a);
    expect(checkLoginRateLimit(a).ok).toBe(false);
    expect(checkLoginRateLimit(b).ok).toBe(true);
  });
});

describe("resetLoginAttempts", () => {
  it("libère le compteur après succès", () => {
    const k = "ok-flow";
    for (let i = 0; i < 4; i++) recordLoginFailure(k);
    expect(checkLoginRateLimit(k).ok).toBe(false);
    resetLoginAttempts(k);
    expect(checkLoginRateLimit(k).ok).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("lit x-forwarded-for en priorité (premier hop)", () => {
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });
  it("tombe sur x-real-ip si pas de x-forwarded-for", () => {
    const req = new Request("https://x", {
      headers: { "x-real-ip": "5.6.7.8" },
    });
    expect(extractClientIp(req)).toBe("5.6.7.8");
  });
  it("renvoie null si aucun header IP n'est présent", () => {
    const req = new Request("https://x");
    expect(extractClientIp(req)).toBeNull();
  });
});
