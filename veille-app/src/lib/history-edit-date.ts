/**
 * Édition de la date d'une entrée d'historique.
 *
 * Pendant « lecture-écriture » de {@link ./history-delete.ts} : mêmes 5 types,
 * même mapping vers les modèles Prisma, même cloisonnement (`canActOnTeam`),
 * même stratégie d'audit — mais au lieu de supprimer, on met à jour le champ
 * de date qui sert de tri/regroupement dans l'historique.
 *
 * Rôle — ADMIN **ou** EDITOR (aligné sur l'édition de commentaire, une
 * correction et non une destruction). Le USER reçoit `forbidden_role`. La
 * route revérifie le rôle (défense en profondeur).
 *
 * Champ de date par type :
 *  - `visit`          → `SiteVisit.visitDate`  OU  `VehicleRound.roundDate`
 *  - `session`        → `VeilleSession.startedAt`
 *  - `validation`     → `ActionValidation.realizedAt`
 *  - `agent-sighting` → `AgentSighting.sightedAt`
 *  - `site-sighting`  → `SiteSighting.sightedAt`
 *
 * AuditLog — un enregistrement `action = "HISTORY_DATE_EDITED"`, `entity` =
 * nom du modèle, `details` = { id, field, previous, next, libellés }.
 */

import { prisma } from "@/lib/prisma";
import { canActOnTeam, type SessionUser } from "@/lib/auth";

export const HISTORY_EDIT_DATE_TYPES = [
  "visit",
  "session",
  "validation",
  "agent-sighting",
  "site-sighting",
] as const;

export type HistoryEditDateType = (typeof HISTORY_EDIT_DATE_TYPES)[number];

export function isHistoryEditDateType(s: string): s is HistoryEditDateType {
  return (HISTORY_EDIT_DATE_TYPES as readonly string[]).includes(s);
}

export type HistoryEditDateOutcome =
  | {
      kind: "ok";
      type: HistoryEditDateType;
      entityId: string;
      /** Date effectivement enregistrée (ISO). */
      at: string;
    }
  | { kind: "not_found"; type: HistoryEditDateType; entityId: string }
  | { kind: "forbidden_role" }
  | { kind: "forbidden_scope" }
  | { kind: "invalid_date" };

/** Borne de validité : une date d'événement plausible (ni avant 2000, ni loin dans le futur). */
function parseValidDate(input: string): Date | null {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  // On tolère l'avenir proche (fuseaux, saisie « aujourd'hui »), pas au-delà d'un an.
  if (d.getTime() > Date.now() + 366 * 24 * 3600 * 1000) return null;
  return d;
}

export async function editHistoryEntryDate(
  user: SessionUser,
  type: HistoryEditDateType,
  entityId: string,
  isoDate: string,
): Promise<HistoryEditDateOutcome> {
  if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    return { kind: "forbidden_role" };
  }
  const date = parseValidDate(isoDate);
  if (!date) return { kind: "invalid_date" };

  switch (type) {
    case "visit":
      return editVisit(user, entityId, date);
    case "session":
      return editSession(user, entityId, date);
    case "validation":
      return editValidation(user, entityId, date);
    case "agent-sighting":
      return editAgentSighting(user, entityId, date);
    case "site-sighting":
      return editSiteSighting(user, entityId, date);
  }
}

// ─── visit (SiteVisit → repli VehicleRound) ───────────────────────────────────

async function editVisit(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const visit = await prisma.siteVisit.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      visitDate: true,
      site: { select: { name: true } },
    },
  });
  // L'historique range aussi les tournées véhicule sous `visit`.
  if (!visit) return editVehicleRound(user, id, date);
  if (!canActOnTeam(user, visit.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "SiteVisit", visit.id, {
        type: "visit",
        field: "visitDate",
        previous: visit.visitDate.toISOString(),
        next: date.toISOString(),
        siteName: visit.site?.name ?? null,
      }),
    }),
    prisma.siteVisit.update({ where: { id: visit.id }, data: { visitDate: date } }),
  ]);
  return { kind: "ok", type: "visit", entityId: visit.id, at: date.toISOString() };
}

async function editVehicleRound(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const round = await prisma.vehicleRound.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      roundDate: true,
      immatriculation: true,
    },
  });
  if (!round) return { kind: "not_found", type: "visit", entityId: id };
  if (!canActOnTeam(user, round.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "VehicleRound", round.id, {
        type: "visit",
        field: "roundDate",
        previous: round.roundDate.toISOString(),
        next: date.toISOString(),
        immatriculation: round.immatriculation,
      }),
    }),
    prisma.vehicleRound.update({ where: { id: round.id }, data: { roundDate: date } }),
  ]);
  return { kind: "ok", type: "visit", entityId: round.id, at: date.toISOString() };
}

// ─── session ──────────────────────────────────────────────────────────────────

async function editSession(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const session = await prisma.veilleSession.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      startedAt: true,
      agent: { select: { firstName: true, lastName: true } },
    },
  });
  if (!session) return { kind: "not_found", type: "session", entityId: id };
  if (!canActOnTeam(user, session.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "VeilleSession", session.id, {
        type: "session",
        field: "startedAt",
        previous: session.startedAt.toISOString(),
        next: date.toISOString(),
        agentName: session.agent
          ? `${session.agent.lastName} ${session.agent.firstName}`.trim()
          : null,
      }),
    }),
    prisma.veilleSession.update({ where: { id: session.id }, data: { startedAt: date } }),
  ]);
  return { kind: "ok", type: "session", entityId: session.id, at: date.toISOString() };
}

// ─── validation ───────────────────────────────────────────────────────────────

async function editValidation(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const validation = await prisma.actionValidation.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      realizedAt: true,
      action: { select: { keyPoint: true } },
    },
  });
  if (!validation) return { kind: "not_found", type: "validation", entityId: id };
  if (!canActOnTeam(user, validation.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "ActionValidation", validation.id, {
        type: "validation",
        field: "realizedAt",
        previous: validation.realizedAt.toISOString(),
        next: date.toISOString(),
        actionKeyPoint: validation.action?.keyPoint ?? null,
      }),
    }),
    prisma.actionValidation.update({
      where: { id: validation.id },
      data: { realizedAt: date },
    }),
  ]);
  return { kind: "ok", type: "validation", entityId: validation.id, at: date.toISOString() };
}

// ─── agent-sighting (Vu / Note agent) ─────────────────────────────────────────

async function editAgentSighting(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const s = await prisma.agentSighting.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      sightedAt: true,
      kind: true,
      agent: { select: { firstName: true, lastName: true, matricule: true } },
    },
  });
  if (!s) return { kind: "not_found", type: "agent-sighting", entityId: id };
  if (!canActOnTeam(user, s.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "AgentSighting", s.id, {
        type: "agent-sighting",
        field: "sightedAt",
        previous: s.sightedAt.toISOString(),
        next: date.toISOString(),
        kind: s.kind,
        agentName: s.agent
          ? `${s.agent.lastName} ${s.agent.firstName}`.trim()
          : null,
        agentMatricule: s.agent?.matricule ?? null,
      }),
    }),
    prisma.agentSighting.update({ where: { id: s.id }, data: { sightedAt: date } }),
  ]);
  return { kind: "ok", type: "agent-sighting", entityId: s.id, at: date.toISOString() };
}

// ─── site-sighting (Vu / Note site) ───────────────────────────────────────────

async function editSiteSighting(
  user: SessionUser,
  id: string,
  date: Date,
): Promise<HistoryEditDateOutcome> {
  const s = await prisma.siteSighting.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      sightedAt: true,
      kind: true,
      site: { select: { name: true } },
    },
  });
  if (!s) return { kind: "not_found", type: "site-sighting", entityId: id };
  if (!canActOnTeam(user, s.teamId)) return { kind: "forbidden_scope" };

  await prisma.$transaction([
    prisma.auditLog.create({
      data: auditPayload(user, "SiteSighting", s.id, {
        type: "site-sighting",
        field: "sightedAt",
        previous: s.sightedAt.toISOString(),
        next: date.toISOString(),
        kind: s.kind,
        siteName: s.site?.name ?? null,
      }),
    }),
    prisma.siteSighting.update({ where: { id: s.id }, data: { sightedAt: date } }),
  ]);
  return { kind: "ok", type: "site-sighting", entityId: s.id, at: date.toISOString() };
}

// ─── audit helper ─────────────────────────────────────────────────────────────

function auditPayload(
  user: SessionUser,
  entity: string,
  entityId: string,
  details: object,
) {
  return {
    userId: user.id,
    userEmail: user.email,
    action: "HISTORY_DATE_EDITED",
    entity,
    entityId,
    details: JSON.stringify(details),
  };
}
