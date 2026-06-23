import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const getOrCreatePreference = vi.fn();
const updatePreference = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));

vi.mock("@/lib/push/preferences", () => ({
  getOrCreatePreference: (...a: unknown[]) => getOrCreatePreference(...a),
  updatePreference: (...a: unknown[]) => updatePreference(...a),
}));

import { GET, PATCH } from "./route";

beforeEach(() => {
  requireUser.mockReset();
  getOrCreatePreference.mockReset();
  updatePreference.mockReset();
});

function fakeUser(role: "USER" | "EDITOR" | "ADMIN" = "USER") {
  return { id: "u1", role, teamIds: [], email: "x@y.z", name: "X" };
}

function makePatch(body: unknown, opts: { invalidJson?: boolean } = {}) {
  return new Request("http://localhost/api/me/notification-preferences", {
    method: "PATCH",
    body: opts.invalidJson ? "not-json" : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/me/notification-preferences", () => {
  it("sans auth → 401", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 401 }),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getOrCreatePreference).not.toHaveBeenCalled();
  });

  it("crée lazy et renvoie les préférences", async () => {
    requireUser.mockResolvedValue(fakeUser());
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    expect(getOrCreatePreference).toHaveBeenCalledWith("u1");
  });

  it("Cache-Control private no-store", async () => {
    requireUser.mockResolvedValue(fakeUser());
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("USER / EDITOR / ADMIN : tous les rôles fonctionnent identiquement", async () => {
    getOrCreatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    for (const role of ["USER", "EDITOR", "ADMIN"] as const) {
      requireUser.mockResolvedValueOnce(fakeUser(role));
      const res = await GET();
      expect(res.status).toBe(200);
    }
  });

  it("erreur read → 500", async () => {
    requireUser.mockResolvedValue(fakeUser());
    getOrCreatePreference.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/me/notification-preferences", () => {
  it("sans auth → 401", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 401 }),
    );
    const res = await PATCH(makePatch({ pushEnabled: false }));
    expect(res.status).toBe(401);
    expect(updatePreference).not.toHaveBeenCalled();
  });

  it("body JSON invalide → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await PATCH(makePatch(null, { invalidJson: true }));
    expect(res.status).toBe(400);
  });

  it("champ inconnu refusé (strict) → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await PATCH(makePatch({ catMateriel: true }));
    expect(res.status).toBe(400);
    expect(updatePreference).not.toHaveBeenCalled();
  });

  it("champ userId refusé (strict) → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await PATCH(
      makePatch({ pushEnabled: true, userId: "u-intrus" }),
    );
    expect(res.status).toBe(400);
    expect(updatePreference).not.toHaveBeenCalled();
  });

  it("type invalide (boolean attendu) → 400", async () => {
    requireUser.mockResolvedValue(fakeUser());
    const res = await PATCH(makePatch({ pushEnabled: "yes" }));
    expect(res.status).toBe(400);
  });

  it("patch partiel — passe le data tel quel", async () => {
    requireUser.mockResolvedValue(fakeUser());
    updatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: false,
      catEquipes: true,
    });
    const res = await PATCH(makePatch({ catEcheances: false }));
    expect(res.status).toBe(200);
    expect(updatePreference).toHaveBeenCalledWith("u1", {
      catEcheances: false,
    });
  });

  it("patch vide accepté (no-op possible) → 200", async () => {
    requireUser.mockResolvedValue(fakeUser());
    updatePreference.mockResolvedValue({
      pushEnabled: true,
      catEcheances: true,
      catEquipes: true,
    });
    const res = await PATCH(makePatch({}));
    expect(res.status).toBe(200);
  });

  it("erreur update → 500", async () => {
    requireUser.mockResolvedValue(fakeUser());
    updatePreference.mockRejectedValue(new Error("DB"));
    const res = await PATCH(makePatch({ pushEnabled: false }));
    expect(res.status).toBe(500);
  });
});
