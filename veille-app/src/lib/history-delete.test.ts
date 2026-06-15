import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks Prisma ─────────────────────────────────────────────────────────────
const findVisit = vi.fn();
const deleteVisit = vi.fn();
const findSession = vi.fn();
const deleteSession = vi.fn();
const findValidation = vi.fn();
const deleteValidation = vi.fn();
const updateAction = vi.fn();
const findAgentSighting = vi.fn();
const deleteAgentSighting = vi.fn();
const findSiteSighting = vi.fn();
const deleteSiteSighting = vi.fn();
const findPhotos = vi.fn();
const createAudit = vi.fn();

// `prisma.$transaction([...])` est utilisé uniquement sous la forme tableau
// dans ce helper — le mock se contente d'exécuter chaque "plan" déjà
// matérialisé par les appels mockés ci-dessus.
const transaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteVisit: {
      findUnique: (...a: unknown[]) => findVisit(...a),
      delete: (...a: unknown[]) => deleteVisit(...a),
    },
    veilleSession: {
      findUnique: (...a: unknown[]) => findSession(...a),
      delete: (...a: unknown[]) => deleteSession(...a),
    },
    actionValidation: {
      findUnique: (...a: unknown[]) => findValidation(...a),
      delete: (...a: unknown[]) => deleteValidation(...a),
    },
    importedAction: {
      update: (...a: unknown[]) => updateAction(...a),
    },
    agentSighting: {
      findUnique: (...a: unknown[]) => findAgentSighting(...a),
      delete: (...a: unknown[]) => deleteAgentSighting(...a),
    },
    siteSighting: {
      findUnique: (...a: unknown[]) => findSiteSighting(...a),
      delete: (...a: unknown[]) => deleteSiteSighting(...a),
    },
    photo: {
      findMany: (...a: unknown[]) => findPhotos(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
    $transaction: (arg: unknown[]) => transaction(arg),
  },
}));

import type { SessionUser } from "@/lib/auth";
import {
  deleteHistoryEntry,
  isHistoryDeleteType,
  HISTORY_DELETE_TYPES,
} from "./history-delete";

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
const ADMIN: SessionUser = { ...EDITOR, id: "u_admin", email: "admin@x", role: "ADMIN" };
const USER: SessionUser = { ...EDITOR, role: "USER" };

beforeEach(() => {
  vi.clearAllMocks();
  findPhotos.mockResolvedValue([]);
});

function readAuditDetails() {
  // Le helper appelle prisma.auditLog.create({ data: { ..., details: JSON } }).
  const arg = createAudit.mock.calls[0]?.[0] as
    | { data?: { details?: string } }
    | undefined;
  return arg?.data?.details ? JSON.parse(arg.data.details) : null;
}

describe("isHistoryDeleteType", () => {
  it("accepte les 5 types supportés", () => {
    for (const t of HISTORY_DELETE_TYPES) {
      expect(isHistoryDeleteType(t)).toBe(true);
    }
  });
  it("refuse n'importe quel autre string", () => {
    expect(isHistoryDeleteType("note")).toBe(false);
    expect(isHistoryDeleteType("")).toBe(false);
    expect(isHistoryDeleteType("VISIT")).toBe(false);
  });
});

describe("deleteHistoryEntry — gardes", () => {
  it("refuse EDITOR avec forbidden_role", async () => {
    const r = await deleteHistoryEntry(EDITOR, "visit", "v1", "OK car raison valide");
    expect(r).toEqual({ kind: "forbidden_role" });
    expect(findVisit).not.toHaveBeenCalled();
  });

  it("refuse USER avec forbidden_role", async () => {
    const r = await deleteHistoryEntry(USER, "visit", "v1", "OK car raison valide");
    expect(r).toEqual({ kind: "forbidden_role" });
  });

  it("refuse motif vide", async () => {
    const r = await deleteHistoryEntry(ADMIN, "visit", "v1", "");
    expect(r).toEqual({ kind: "invalid_reason" });
    expect(findVisit).not.toHaveBeenCalled();
  });

  it("refuse motif < 3 caractères même après trim", async () => {
    const r = await deleteHistoryEntry(ADMIN, "visit", "v1", "  ab  ");
    expect(r).toEqual({ kind: "invalid_reason" });
  });

  it("refuse motif > 500 caractères", async () => {
    const r = await deleteHistoryEntry(ADMIN, "visit", "v1", "x".repeat(501));
    expect(r).toEqual({ kind: "invalid_reason" });
  });
});

describe("deleteHistoryEntry — visit", () => {
  it("renvoie not_found si la visite n'existe pas", async () => {
    findVisit.mockResolvedValue(null);
    const r = await deleteHistoryEntry(ADMIN, "visit", "v404", "motif valide");
    expect(r).toEqual({ kind: "not_found", type: "visit", entityId: "v404" });
    expect(createAudit).not.toHaveBeenCalled();
    expect(deleteVisit).not.toHaveBeenCalled();
  });

  it("écrit audit + delete dans une transaction", async () => {
    findVisit.mockResolvedValue({
      id: "v1",
      siteId: "s1",
      teamId: "tA",
      observerId: "u1",
      templateId: "tpl1",
      visitDate: new Date("2026-05-01T10:00:00Z"),
      status: "completed",
      finishedAt: new Date("2026-05-01T12:00:00Z"),
      generalComment: "RAS",
      createdAt: new Date("2026-05-01T10:00:00Z"),
      site: { name: "POSTE A" },
      observer: { name: "obs" },
      template: { name: "Trimestrielle" },
      _count: {
        participants: 2,
        observations: 10,
        nonConformities: 1,
        reports: 1,
      },
    });
    const r = await deleteHistoryEntry(ADMIN, "visit", "v1", "Doublon import");
    expect(r).toEqual({ kind: "ok", type: "visit", entityId: "v1" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledTimes(1);
    expect(deleteVisit).toHaveBeenCalledWith({ where: { id: "v1" } });

    const details = readAuditDetails();
    expect(details.type).toBe("visit");
    expect(details.entity).toBe("SiteVisit");
    expect(details.id).toBe("v1");
    expect(details.siteName).toBe("POSTE A");
    expect(details.templateName).toBe("Trimestrielle");
    expect(details.counts.observations).toBe(10);
    expect(details.reason).toBe("Doublon import");
    // visite n'a pas de photos directement attachées en V1 — le helper
    // ne doit pas exposer un champ `photos` qui ferait croire à une dette.
    expect(details.photos).toBeUndefined();
  });

  it("audit utilise userId/userEmail de l'admin", async () => {
    findVisit.mockResolvedValue({
      id: "v1",
      siteId: "s1",
      teamId: "tA",
      observerId: "u1",
      templateId: "tpl1",
      visitDate: new Date(),
      status: "completed",
      finishedAt: null,
      generalComment: null,
      createdAt: new Date(),
      site: { name: "x" },
      observer: { name: "x" },
      template: { name: "x" },
      _count: { participants: 0, observations: 0, nonConformities: 0, reports: 0 },
    });
    await deleteHistoryEntry(ADMIN, "visit", "v1", "motif valide");
    const data = createAudit.mock.calls[0][0].data;
    expect(data.userId).toBe("u_admin");
    expect(data.userEmail).toBe("admin@x");
    expect(data.action).toBe("HISTORY_DELETED");
    expect(data.entity).toBe("SiteVisit");
  });
});

describe("deleteHistoryEntry — session", () => {
  it("snapshot inclut le nom de l'agent et la liste des photos", async () => {
    findSession.mockResolvedValue({
      id: "se1",
      teamId: "tA",
      observerId: "u1",
      agentId: "a1",
      status: "completed",
      startedAt: new Date("2026-04-01"),
      finishedAt: new Date("2026-04-01"),
      generalComment: null,
      createdAt: new Date("2026-04-01"),
      observer: { name: "Pierre" },
      agent: { firstName: "Marie", lastName: "Curie", matricule: "M001" },
      _count: { procedures: 3, comments: 0, photos: 2, reports: 1 },
    });
    findPhotos.mockResolvedValue([
      { id: "p1", storagePath: "photos/se1/a.jpg" },
      { id: "p2", storagePath: "photos/se1/b.jpg" },
    ]);
    const r = await deleteHistoryEntry(ADMIN, "session", "se1", "annulation manuelle");
    expect(r.kind).toBe("ok");
    const details = readAuditDetails();
    expect(details.agentName).toBe("Curie Marie");
    expect(details.agentMatricule).toBe("M001");
    expect(details.photos).toHaveLength(2);
    expect(details.photos[0].storagePath).toBe("photos/se1/a.jpg");
    expect(details.counts.procedures).toBe(3);
  });
});

describe("deleteHistoryEntry — validation", () => {
  it("revert action vers ACTIVE si VALIDATED_LOCAL", async () => {
    findValidation.mockResolvedValue({
      id: "val1",
      actionId: "act1",
      agentId: "a1",
      siteId: null,
      validatedById: "u_admin",
      teamId: "tA",
      realizedAt: new Date("2026-05-15"),
      comment: null,
      createdAt: new Date("2026-05-15"),
      validatedBy: { name: "Pierre" },
      agent: { firstName: "Marie", lastName: "Curie", matricule: "M001" },
      site: null,
      action: {
        id: "act1",
        externalId: "EXT-42",
        keyPoint: "Acheminement transport",
        localStatus: "VALIDATED_LOCAL",
      },
    });
    const r = await deleteHistoryEntry(ADMIN, "validation", "val1", "erreur saisie");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.revertedAction).toEqual({
        actionId: "act1",
        previousStatus: "VALIDATED_LOCAL",
        newStatus: "ACTIVE",
      });
    }
    // La transaction comporte 3 opérations : audit, delete validation, update action.
    expect(updateAction).toHaveBeenCalledWith({
      where: { id: "act1" },
      data: { localStatus: "ACTIVE" },
    });
    const details = readAuditDetails();
    expect(details.revert).toEqual({
      actionId: "act1",
      previousStatus: "VALIDATED_LOCAL",
      newStatus: "ACTIVE",
    });
  });

  it("ne touche pas l'action si statut différent de VALIDATED_LOCAL", async () => {
    findValidation.mockResolvedValue({
      id: "val2",
      actionId: "act2",
      agentId: null,
      siteId: "s1",
      validatedById: "u_admin",
      teamId: "tA",
      realizedAt: new Date(),
      comment: null,
      createdAt: new Date(),
      validatedBy: { name: "Pierre" },
      agent: null,
      site: { name: "POSTE B" },
      action: {
        id: "act2",
        externalId: "EXT-43",
        keyPoint: "Inspection",
        localStatus: "ACTIVE",
      },
    });
    const r = await deleteHistoryEntry(ADMIN, "validation", "val2", "doublon");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.revertedAction).toBeUndefined();
    }
    expect(updateAction).not.toHaveBeenCalled();
    const details = readAuditDetails();
    expect(details.revert).toBeNull();
  });

  it("audit contient validationId + actionId + ancien/nouveau statut + acteur", async () => {
    findValidation.mockResolvedValue({
      id: "valX",
      actionId: "actX",
      agentId: "a1",
      siteId: null,
      validatedById: "u1",
      teamId: "tA",
      realizedAt: new Date(),
      comment: "ok",
      createdAt: new Date(),
      validatedBy: { name: "Pierre" },
      agent: { firstName: "Marie", lastName: "Curie", matricule: "M001" },
      site: null,
      action: {
        id: "actX",
        externalId: "EXT-99",
        keyPoint: "K",
        localStatus: "VALIDATED_LOCAL",
      },
    });
    await deleteHistoryEntry(ADMIN, "validation", "valX", "test traçabilité");
    const data = createAudit.mock.calls[0][0].data;
    expect(data.userId).toBe("u_admin");
    expect(data.entity).toBe("ActionValidation");
    expect(data.entityId).toBe("valX");
    const details = JSON.parse(data.details);
    expect(details.id).toBe("valX");
    expect(details.actionId).toBe("actX");
    expect(details.revert.previousStatus).toBe("VALIDATED_LOCAL");
    expect(details.revert.newStatus).toBe("ACTIVE");
    expect(details.reason).toBe("test traçabilité");
  });
});

describe("deleteHistoryEntry — agent-sighting / site-sighting", () => {
  it("agent-sighting : snapshot inclut kind, comment, photos", async () => {
    findAgentSighting.mockResolvedValue({
      id: "sg1",
      agentId: "a1",
      teamId: "tA",
      observerId: "u1",
      kind: "NOTE",
      comment: "test note",
      sightedAt: new Date("2026-06-01"),
      createdAt: new Date("2026-06-01"),
      externalRef: null,
      agent: { firstName: "Marie", lastName: "Curie", matricule: "M001" },
      observer: { name: "Pierre" },
      _count: { photos: 1 },
    });
    findPhotos.mockResolvedValue([
      { id: "p1", storagePath: "photos/sg1/note.jpg" },
    ]);
    const r = await deleteHistoryEntry(ADMIN, "agent-sighting", "sg1", "erreur");
    expect(r.kind).toBe("ok");
    expect(deleteAgentSighting).toHaveBeenCalledWith({ where: { id: "sg1" } });
    const details = readAuditDetails();
    expect(details.kind).toBe("NOTE");
    expect(details.comment).toBe("test note");
    expect(details.photos[0].storagePath).toBe("photos/sg1/note.jpg");
  });

  it("site-sighting : snapshot inclut siteName et kind", async () => {
    findSiteSighting.mockResolvedValue({
      id: "ss1",
      siteId: "s1",
      teamId: "tA",
      observerId: "u1",
      kind: "SIGHT",
      comment: null,
      sightedAt: new Date(),
      createdAt: new Date(),
      externalRef: null,
      site: { name: "POSTE A" },
      observer: { name: "Pierre" },
      _count: { photos: 0 },
    });
    const r = await deleteHistoryEntry(ADMIN, "site-sighting", "ss1", "doublon import");
    expect(r.kind).toBe("ok");
    expect(deleteSiteSighting).toHaveBeenCalledWith({ where: { id: "ss1" } });
    const details = readAuditDetails();
    expect(details.entity).toBe("SiteSighting");
    expect(details.siteName).toBe("POSTE A");
    expect(details.kind).toBe("SIGHT");
  });

  it("not_found si l'agent-sighting n'existe pas", async () => {
    findAgentSighting.mockResolvedValue(null);
    const r = await deleteHistoryEntry(ADMIN, "agent-sighting", "ghost", "test");
    expect(r).toEqual({
      kind: "not_found",
      type: "agent-sighting",
      entityId: "ghost",
    });
    expect(createAudit).not.toHaveBeenCalled();
  });
});
