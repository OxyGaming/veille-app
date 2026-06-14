import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks Prisma ────────────────────────────────────────────────────────────
const findFirst = vi.fn();
const update = vi.fn();
const createAudit = vi.fn();
const transaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importedAction: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...(a as [unknown[]])),
  },
}));

// `actionScope` est appelé dans le helper — on l'observe pour vérifier
// que c'est bien lui qui scope la lecture.
const actionScopeMock = vi.fn((_u: unknown) => ({ __scope: true }));
vi.mock("@/lib/auth", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...real, actionScope: (u: unknown) => actionScopeMock(u) };
});

import type { SessionUser } from "@/lib/auth";
import { obsoleteAction } from "./action-obsolete";

const EDITOR: SessionUser = {
  id: "u_editor",
  email: "editor@x",
  name: "Ed",
  role: "EDITOR",
  teamId: "tA",
  teamIds: ["tA"],
  viewAllTeams: false,
  adminScopeMode: null,
  adminTeamId: null,
};

const ADMIN: SessionUser = {
  ...EDITOR,
  id: "u_admin",
  email: "admin@x",
  role: "ADMIN",
  viewAllTeams: false,
};

const baseRow = {
  id: "act_1",
  localStatus: "ACTIVE" as const,
  agentId: "ag_1",
  siteId: null,
  teamId: "tA",
  keyPoint: "Refaire formation sécurité",
  comment: null,
  externalId: "EXT-42",
};

beforeEach(() => {
  findFirst.mockReset();
  update.mockReset();
  createAudit.mockReset();
  transaction.mockReset();
  transaction.mockImplementation(async (ops: unknown[]) => ops);
  actionScopeMock.mockClear();
});

describe("obsoleteAction — accès et scope", () => {
  it("action inexistante OU hors scope → kind=not_found", async () => {
    findFirst.mockResolvedValue(null);
    const out = await obsoleteAction(EDITOR, "act_unknown");
    expect(out).toEqual({ kind: "not_found", actionId: "act_unknown" });
    // Doit avoir appliqué le scope EDITOR via actionScope().
    expect(actionScopeMock).toHaveBeenCalledWith(EDITOR);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      id: "act_unknown",
      __scope: true,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("EDITOR hors scope (mock null) ne déclenche aucune écriture", async () => {
    findFirst.mockResolvedValue(null);
    await obsoleteAction(EDITOR, "act_x");
    expect(update).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
  });

  it("ADMIN scope appliqué (actionScope appelé avec le user ADMIN)", async () => {
    findFirst.mockResolvedValue(null);
    await obsoleteAction(ADMIN, "act_y");
    expect(actionScopeMock).toHaveBeenCalledWith(ADMIN);
  });
});

describe("obsoleteAction — statuts", () => {
  it("ACTIVE → OBSOLETE + transaction [update, auditLog]", async () => {
    findFirst.mockResolvedValue({ ...baseRow, localStatus: "ACTIVE" });
    const out = await obsoleteAction(EDITOR, "act_1");
    expect(out).toEqual({
      kind: "ok",
      actionId: "act_1",
      previousStatus: "ACTIVE",
      newStatus: "OBSOLETE",
      noop: false,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    // L'argument est un tableau de 2 promises (update, auditLog.create).
    const ops = transaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(2);
  });

  it("REPLACED → OBSOLETE (transition autorisée D4)", async () => {
    findFirst.mockResolvedValue({ ...baseRow, localStatus: "REPLACED" });
    const out = await obsoleteAction(EDITOR, "act_1");
    expect(out).toMatchObject({ kind: "ok", previousStatus: "REPLACED" });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("OBSOLETE → idempotent, pas d'écriture, pas d'audit", async () => {
    findFirst.mockResolvedValue({ ...baseRow, localStatus: "OBSOLETE" });
    const out = await obsoleteAction(EDITOR, "act_1");
    expect(out).toEqual({
      kind: "noop",
      actionId: "act_1",
      previousStatus: "OBSOLETE",
      newStatus: "OBSOLETE",
      noop: true,
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
  });

  it("VALIDATED_LOCAL → refus avec code ACTION_VALIDATED, pas d'écriture", async () => {
    findFirst.mockResolvedValue({
      ...baseRow,
      localStatus: "VALIDATED_LOCAL",
    });
    const out = await obsoleteAction(EDITOR, "act_1");
    expect(out).toEqual({
      kind: "validated",
      actionId: "act_1",
      currentStatus: "VALIDATED_LOCAL",
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("obsoleteAction — AuditLog payload", () => {
  it("audit contient previousStatus, agentId/siteId/teamId, label, userEmail", async () => {
    findFirst.mockResolvedValue({
      ...baseRow,
      localStatus: "ACTIVE",
      keyPoint: "  Refaire formation  ",
      comment: null,
      agentId: "ag_42",
      siteId: null,
      teamId: "tA",
      externalId: "EXT-1",
    });
    // Capture l'argument de auditLog.create — comme transaction reçoit
    // les deux promises déjà construites, on inspecte directement
    // l'appel à createAudit qui a déjà eu lieu au moment du push.
    await obsoleteAction(EDITOR, "act_1");
    expect(createAudit).toHaveBeenCalledTimes(1);
    const arg = createAudit.mock.calls[0][0];
    expect(arg.data.userId).toBe("u_editor");
    expect(arg.data.userEmail).toBe("editor@x");
    expect(arg.data.action).toBe("ACTION_OBSOLETE");
    expect(arg.data.entity).toBe("ImportedAction");
    expect(arg.data.entityId).toBe("act_1");
    const details = JSON.parse(arg.data.details);
    expect(details).toMatchObject({
      previousStatus: "ACTIVE",
      newStatus: "OBSOLETE",
      agentId: "ag_42",
      siteId: null,
      teamId: "tA",
      label: "Refaire formation",
    });
  });

  it("label fallback comment puis externalId si keyPoint vide", async () => {
    findFirst.mockResolvedValue({
      ...baseRow,
      localStatus: "ACTIVE",
      keyPoint: null,
      comment: "  Voir RGI  ",
      externalId: "EXT-99",
    });
    await obsoleteAction(EDITOR, "act_1");
    const details = JSON.parse(createAudit.mock.calls[0][0].data.details);
    expect(details.label).toBe("Voir RGI");
  });

  it("label = `Action <externalId>` si keyPoint et comment vides", async () => {
    findFirst.mockResolvedValue({
      ...baseRow,
      localStatus: "ACTIVE",
      keyPoint: null,
      comment: null,
      externalId: "EXT-7",
    });
    await obsoleteAction(EDITOR, "act_1");
    const details = JSON.parse(createAudit.mock.calls[0][0].data.details);
    expect(details.label).toBe("Action EXT-7");
  });

  it("OBSOLETE idempotent → 0 AuditLog (pas d'événement réel)", async () => {
    findFirst.mockResolvedValue({ ...baseRow, localStatus: "OBSOLETE" });
    await obsoleteAction(EDITOR, "act_1");
    expect(createAudit).not.toHaveBeenCalled();
  });
});
