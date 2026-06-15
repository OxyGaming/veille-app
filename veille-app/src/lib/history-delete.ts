/**
 * Hard-delete d'entrées de l'historique (Sprint historique C1).
 *
 * Sécurité — ADMIN only, vérifié à l'entrée du helper. Le rôle EDITOR
 * et USER reçoivent `forbidden_role`. La route appelante n'a pas à
 * dupliquer le check (mais elle le fait quand même, pour fail-fast).
 *
 * Types supportés (`HistoryDeleteType`) — 5 entités distinctes :
 *  - `visit`            → `SiteVisit`         (cascade : participants,
 *                                              observations, non-conformités,
 *                                              reports, photos)
 *  - `session`          → `VeilleSession`     (cascade : procedure observations,
 *                                              observation items, photos, reports)
 *  - `validation`       → `ActionValidation`  + reset de l'action liée
 *                                              à ACTIVE si elle était
 *                                              VALIDATED_LOCAL.
 *  - `agent-sighting`   → `AgentSighting`     (cascade : photos)
 *  - `site-sighting`    → `SiteSighting`      (cascade : photos)
 *
 * AuditLog — UN seul enregistrement par suppression, `action =
 * "HISTORY_DELETED"`, `entity` = nom du modèle Prisma. `details`
 * contient un snapshot complet en JSON :
 *  - identifiants et libellés humains (siteName, agentName, observerName)
 *  - compteurs des enfants supprimés en cascade
 *  - pour `validation` : `revert` { actionId, previousStatus, newStatus }
 *  - liste `photos[]` (id + storagePath) — utilisée pour repérer les
 *    fichiers orphelins sur disque (dette V1, cf. limite plus bas).
 *  - `reason` saisie par l'admin (3 caractères min., validée en amont)
 *
 * Limites connues V1 :
 *  - Photos : Prisma cascade supprime les lignes `Photo`, mais les
 *    fichiers physiques restent sur disque (`storagePath`). Le snapshot
 *    audit liste les chemins pour permettre une purge manuelle ou un
 *    job de nettoyage ultérieur.
 *  - Pas de soft-delete : la suppression est irréversible côté données.
 *    L'AuditLog est la seule trace.
 */

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export const HISTORY_DELETE_TYPES = [
  "visit",
  "session",
  "validation",
  "agent-sighting",
  "site-sighting",
] as const;

export type HistoryDeleteType = (typeof HISTORY_DELETE_TYPES)[number];

export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;

export function isHistoryDeleteType(s: string): s is HistoryDeleteType {
  return (HISTORY_DELETE_TYPES as readonly string[]).includes(s);
}

export type HistoryDeleteOutcome =
  | {
      kind: "ok";
      type: HistoryDeleteType;
      entityId: string;
      /** Pour `validation` uniquement, si un revert sur ImportedAction a eu lieu. */
      revertedAction?: {
        actionId: string;
        previousStatus: string;
        newStatus: string;
      };
    }
  | { kind: "not_found"; type: HistoryDeleteType; entityId: string }
  | { kind: "forbidden_role" }
  | { kind: "invalid_reason" };

/**
 * Supprime une entrée d'historique en hard-delete.
 *
 * Préconditions vérifiées par le helper :
 *  - `user.role === "ADMIN"` (sinon `forbidden_role`)
 *  - `reason` ≥ {@link REASON_MIN_LENGTH} (sinon `invalid_reason`)
 *  - Entité existante (sinon `not_found` — pas de fuite d'existence)
 */
export async function deleteHistoryEntry(
  user: SessionUser,
  type: HistoryDeleteType,
  entityId: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  if (user.role !== "ADMIN") return { kind: "forbidden_role" };
  const cleanReason = reason.trim();
  if (
    cleanReason.length < REASON_MIN_LENGTH ||
    cleanReason.length > REASON_MAX_LENGTH
  ) {
    return { kind: "invalid_reason" };
  }

  switch (type) {
    case "visit":
      return deleteVisit(user, entityId, cleanReason);
    case "session":
      return deleteSession(user, entityId, cleanReason);
    case "validation":
      return deleteValidation(user, entityId, cleanReason);
    case "agent-sighting":
      return deleteAgentSighting(user, entityId, cleanReason);
    case "site-sighting":
      return deleteSiteSighting(user, entityId, cleanReason);
  }
}

// ─── visit ──────────────────────────────────────────────────────────────────

async function deleteVisit(
  user: SessionUser,
  id: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  const visit = await prisma.siteVisit.findUnique({
    where: { id },
    select: {
      id: true,
      siteId: true,
      teamId: true,
      observerId: true,
      templateId: true,
      visitDate: true,
      status: true,
      finishedAt: true,
      generalComment: true,
      createdAt: true,
      site: { select: { name: true } },
      observer: { select: { name: true } },
      template: { select: { name: true } },
      _count: {
        select: {
          participants: true,
          observations: true,
          nonConformities: true,
          reports: true,
        },
      },
    },
  });
  if (!visit) return { kind: "not_found", type: "visit", entityId: id };

  // Le modèle Photo n'a aucune relation directe avec SiteVisit /
  // SiteVisitObservation en V1 — donc pas de fichier orphelin lié à la
  // suppression d'une visite. Si le modèle évolue (champ visitObservationId
  // ajouté à Photo), il faudra étendre le snapshot ici.

  const snapshot = {
    type: "visit" as const,
    entity: "SiteVisit" as const,
    id: visit.id,
    siteId: visit.siteId,
    siteName: visit.site?.name ?? null,
    teamId: visit.teamId,
    observerId: visit.observerId,
    observerName: visit.observer?.name ?? null,
    templateId: visit.templateId,
    templateName: visit.template?.name ?? null,
    visitDate: visit.visitDate.toISOString(),
    status: visit.status,
    finishedAt: visit.finishedAt?.toISOString() ?? null,
    generalComment: visit.generalComment,
    counts: visit._count,
    reason,
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "SiteVisit", visit.id, snapshot),
    }),
    prisma.siteVisit.delete({ where: { id: visit.id } }),
  ]);

  return { kind: "ok", type: "visit", entityId: visit.id };
}

// ─── session ────────────────────────────────────────────────────────────────

async function deleteSession(
  user: SessionUser,
  id: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  const session = await prisma.veilleSession.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      observerId: true,
      agentId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      generalComment: true,
      createdAt: true,
      observer: { select: { name: true } },
      agent: { select: { firstName: true, lastName: true, matricule: true } },
      _count: {
        select: {
          procedures: true,
          comments: true,
          photos: true,
          reports: true,
        },
      },
    },
  });
  if (!session) return { kind: "not_found", type: "session", entityId: id };

  // Photos cascadées : directement attachées à la session OU à un
  // ObservationItem appartenant à la session.
  const photos = await prisma.photo.findMany({
    where: {
      OR: [
        { sessionId: id },
        { observation: { procedureObservation: { sessionId: id } } },
      ],
    },
    select: { id: true, storagePath: true },
  });

  const snapshot = {
    type: "session" as const,
    entity: "VeilleSession" as const,
    id: session.id,
    teamId: session.teamId,
    observerId: session.observerId,
    observerName: session.observer?.name ?? null,
    agentId: session.agentId,
    agentName: session.agent
      ? `${session.agent.lastName} ${session.agent.firstName}`.trim()
      : null,
    agentMatricule: session.agent?.matricule ?? null,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    generalComment: session.generalComment,
    counts: session._count,
    photos,
    reason,
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "VeilleSession", session.id, snapshot),
    }),
    prisma.veilleSession.delete({ where: { id: session.id } }),
  ]);

  return { kind: "ok", type: "session", entityId: session.id };
}

// ─── validation ─────────────────────────────────────────────────────────────

async function deleteValidation(
  user: SessionUser,
  id: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  const validation = await prisma.actionValidation.findUnique({
    where: { id },
    select: {
      id: true,
      actionId: true,
      agentId: true,
      siteId: true,
      validatedById: true,
      teamId: true,
      realizedAt: true,
      comment: true,
      createdAt: true,
      validatedBy: { select: { name: true } },
      agent: { select: { firstName: true, lastName: true, matricule: true } },
      site: { select: { name: true } },
      action: {
        select: {
          id: true,
          externalId: true,
          keyPoint: true,
          localStatus: true,
        },
      },
    },
  });
  if (!validation) {
    return { kind: "not_found", type: "validation", entityId: id };
  }

  // Si l'action liée est VALIDATED_LOCAL, on la repasse à ACTIVE pour
  // qu'elle réapparaisse dans les listes "à faire" — la suppression de
  // la validation a logiquement annulé l'effet de la validation.
  const previousActionStatus = validation.action.localStatus;
  const shouldRevert = previousActionStatus === "VALIDATED_LOCAL";
  const newActionStatus = shouldRevert ? "ACTIVE" : previousActionStatus;
  const revert = shouldRevert
    ? {
        actionId: validation.action.id,
        previousStatus: previousActionStatus,
        newStatus: newActionStatus,
      }
    : null;

  const snapshot = {
    type: "validation" as const,
    entity: "ActionValidation" as const,
    id: validation.id,
    actionId: validation.action.id,
    actionExternalId: validation.action.externalId,
    actionKeyPoint: validation.action.keyPoint,
    agentId: validation.agentId,
    agentName: validation.agent
      ? `${validation.agent.lastName} ${validation.agent.firstName}`.trim()
      : null,
    agentMatricule: validation.agent?.matricule ?? null,
    siteId: validation.siteId,
    siteName: validation.site?.name ?? null,
    validatedById: validation.validatedById,
    validatedByName: validation.validatedBy?.name ?? null,
    teamId: validation.teamId,
    realizedAt: validation.realizedAt.toISOString(),
    comment: validation.comment,
    revert,
    reason,
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "ActionValidation", validation.id, snapshot),
    }),
    prisma.actionValidation.delete({ where: { id: validation.id } }),
    ...(shouldRevert
      ? [
          prisma.importedAction.update({
            where: { id: validation.action.id },
            data: { localStatus: "ACTIVE" },
          }),
        ]
      : []),
  ]);

  return {
    kind: "ok",
    type: "validation",
    entityId: validation.id,
    revertedAction: revert ?? undefined,
  };
}

// ─── agent-sighting ─────────────────────────────────────────────────────────

async function deleteAgentSighting(
  user: SessionUser,
  id: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  const sighting = await prisma.agentSighting.findUnique({
    where: { id },
    select: {
      id: true,
      agentId: true,
      teamId: true,
      observerId: true,
      kind: true,
      comment: true,
      sightedAt: true,
      createdAt: true,
      externalRef: true,
      agent: { select: { firstName: true, lastName: true, matricule: true } },
      observer: { select: { name: true } },
      _count: { select: { photos: true } },
    },
  });
  if (!sighting) {
    return { kind: "not_found", type: "agent-sighting", entityId: id };
  }

  const photos = await prisma.photo.findMany({
    where: { agentSightingId: id },
    select: { id: true, storagePath: true },
  });

  const snapshot = {
    type: "agent-sighting" as const,
    entity: "AgentSighting" as const,
    id: sighting.id,
    agentId: sighting.agentId,
    agentName: sighting.agent
      ? `${sighting.agent.lastName} ${sighting.agent.firstName}`.trim()
      : null,
    agentMatricule: sighting.agent?.matricule ?? null,
    teamId: sighting.teamId,
    observerId: sighting.observerId,
    observerName: sighting.observer?.name ?? null,
    kind: sighting.kind,
    comment: sighting.comment,
    sightedAt: sighting.sightedAt.toISOString(),
    externalRef: sighting.externalRef,
    counts: sighting._count,
    photos,
    reason,
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "AgentSighting", sighting.id, snapshot),
    }),
    prisma.agentSighting.delete({ where: { id: sighting.id } }),
  ]);

  return { kind: "ok", type: "agent-sighting", entityId: sighting.id };
}

// ─── site-sighting ──────────────────────────────────────────────────────────

async function deleteSiteSighting(
  user: SessionUser,
  id: string,
  reason: string,
): Promise<HistoryDeleteOutcome> {
  const sighting = await prisma.siteSighting.findUnique({
    where: { id },
    select: {
      id: true,
      siteId: true,
      teamId: true,
      observerId: true,
      kind: true,
      comment: true,
      sightedAt: true,
      createdAt: true,
      externalRef: true,
      site: { select: { name: true } },
      observer: { select: { name: true } },
      _count: { select: { photos: true } },
    },
  });
  if (!sighting) {
    return { kind: "not_found", type: "site-sighting", entityId: id };
  }

  const photos = await prisma.photo.findMany({
    where: { siteSightingId: id },
    select: { id: true, storagePath: true },
  });

  const snapshot = {
    type: "site-sighting" as const,
    entity: "SiteSighting" as const,
    id: sighting.id,
    siteId: sighting.siteId,
    siteName: sighting.site?.name ?? null,
    teamId: sighting.teamId,
    observerId: sighting.observerId,
    observerName: sighting.observer?.name ?? null,
    kind: sighting.kind,
    comment: sighting.comment,
    sightedAt: sighting.sightedAt.toISOString(),
    externalRef: sighting.externalRef,
    counts: sighting._count,
    photos,
    reason,
  };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "SiteSighting", sighting.id, snapshot),
    }),
    prisma.siteSighting.delete({ where: { id: sighting.id } }),
  ]);

  return { kind: "ok", type: "site-sighting", entityId: sighting.id };
}

// ─── audit helper ───────────────────────────────────────────────────────────

function auditPayload(
  user: SessionUser,
  entity: string,
  entityId: string,
  details: object,
) {
  return {
    userId: user.id,
    userEmail: user.email,
    action: "HISTORY_DELETED",
    entity,
    entityId,
    details: JSON.stringify(details),
  };
}
