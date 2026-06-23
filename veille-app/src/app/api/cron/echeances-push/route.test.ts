import { beforeEach, describe, expect, it, vi } from "vitest";

const runEcheancesPushCron = vi.fn();
vi.mock("@/lib/push/cron-echeances", () => ({
  runEcheancesPushCron: (...a: unknown[]) => runEcheancesPushCron(...a),
}));

import { POST } from "./route";

const SECRET = "test-secret-32chars-must-match-env-x";

function makeReq(secret?: string | null) {
  const headers: Record<string, string> = {};
  if (secret !== undefined && secret !== null) {
    headers["x-cron-secret"] = secret;
  }
  return new Request("http://localhost/api/cron/echeances-push", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  runEcheancesPushCron.mockReset();
  process.env.CRON_SECRET = SECRET;
});

describe("POST /api/cron/echeances-push — sécurité", () => {
  it("header absent → 401, run jamais déclenché", async () => {
    const res = await POST(makeReq(undefined));
    expect(res.status).toBe(401);
    expect(runEcheancesPushCron).not.toHaveBeenCalled();
  });

  it("header vide → 401", async () => {
    const res = await POST(makeReq(""));
    expect(res.status).toBe(401);
    expect(runEcheancesPushCron).not.toHaveBeenCalled();
  });

  it("header invalide → 401", async () => {
    const res = await POST(makeReq("wrong-secret"));
    expect(res.status).toBe(401);
    expect(runEcheancesPushCron).not.toHaveBeenCalled();
  });

  it("CRON_SECRET non configuré → 401 même si header fourni (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeReq("any-value"));
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET vide → 401", async () => {
    process.env.CRON_SECRET = "";
    const res = await POST(makeReq(""));
    expect(res.status).toBe(401);
  });

  it("secret valide → 200 + report JSON", async () => {
    runEcheancesPushCron.mockResolvedValue({
      usersScanned: 12,
      usersWithCriticalItems: 5,
      notificationsAttempted: 18,
      notificationsCreated: 6,
      notificationsDeduped: 12,
      errors: 0,
      elapsedMs: 234,
    });
    const res = await POST(makeReq(SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usersScanned).toBe(12);
    expect(body.notificationsCreated).toBe(6);
    expect(body.errors).toBe(0);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/cron/echeances-push — robustesse", () => {
  it("crash interne → 500", async () => {
    runEcheancesPushCron.mockRejectedValue(new Error("DB total down"));
    const res = await POST(makeReq(SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("aucun userId dans la requête (sécurité — pas de body lu)", async () => {
    // Sanity check : la route ne tente même pas de parser le body.
    // Si elle le faisait, un body { userId: ... } pourrait corrompre le run.
    runEcheancesPushCron.mockResolvedValue({
      usersScanned: 0,
      usersWithCriticalItems: 0,
      notificationsAttempted: 0,
      notificationsCreated: 0,
      notificationsDeduped: 0,
      errors: 0,
      elapsedMs: 0,
    });
    const req = new Request("http://localhost/api/cron/echeances-push", {
      method: "POST",
      headers: { "x-cron-secret": SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u-intrus", roles: ["USER"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // runEcheancesPushCron est appelé sans argument extra venant du body.
    const callArgs = runEcheancesPushCron.mock.calls[0];
    expect(callArgs.length).toBe(1);
    expect(callArgs[0]).toBeInstanceOf(Date);
  });
});
