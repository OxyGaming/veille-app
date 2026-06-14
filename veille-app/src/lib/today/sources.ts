/**
 * Sources de données — accès Prisma pour l'écran Aujourd'hui.
 *
 * Toutes les fonctions sont scopées sur l'utilisateur via les helpers
 * existants (`teamScope`, `agentScope`, `siteScope`, `actionScope`).
 * Aucune nouvelle entité, aucun nouveau champ : on dérive `lastSessionAt`,
 * `lastVisitDate`, `validatedAt` à la volée par sous-requêtes.
 */

import { prisma } from "@/lib/prisma";
import {
  actionScope,
  agentScope,
  siteScope,
  teamScope,
  type SessionUser,
} from "@/lib/auth";
import {
  DEFAULT_VISIT_FREQUENCY_DAYS,
  EQUIPMENT_EXPIRATION_WINDOW_DAYS,
  STALE_DRAFT_DAYS,
} from "./constants";
import type {
  AdminAlert,
  AdminUsage,
  CurrentWork,
  EditorDiagnostic,
  EditorWeekCounters,
  RecentActivityItem,
  WatchlistItem,
} from "./types";
import {
  mapDraftSessionToTodoItem,
  mapDraftVisitToTodoItem,
  mapExpiringEquipmentToTodoItem,
  mapImportedActionToTodoItem,
  mapRecentEvent,
  type DraftSessionRow,
  type DraftVisitRow,
  type ExpiringEquipmentRow,
  type ImportedActionRow,
} from "./mappers";
import type { TodoItem } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

const subDays = (date: Date, days: number): Date =>
  new Date(date.getTime() - days * DAY_MS);

const startOfWeekParis = (now: Date): Date => {
  // Approximation simple : début de semaine = lundi 00:00 dans le fuseau local
  // du serveur. SQLite stocke les dates en UTC ; pour V1 on accepte le décalage
  // (utilisateurs FR métropolitains uniquement). À reraffiner si déploiement
  // multi-fuseau.
  const d = new Date(now);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── USER ────────────────────────────────────────────────────────────────────

/**
 * Travail en cours : top 1 entre VeilleSession et SiteVisit en draft/active
 * pour l'utilisateur courant, trié par updatedAt DESC.
 */
export async function getCurrentWorkForUser(
  user: SessionUser,
  now: Date,
): Promise<CurrentWork | null> {
  const [session, visit] = await Promise.all([
    prisma.veilleSession.findFirst({
      where: {
        observerId: user.id,
        status: { in: ["draft", "active"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        updatedAt: true,
        agent: { select: { firstName: true, lastName: true } },
        procedures: { select: { id: true } },
      },
    }),
    prisma.siteVisit.findFirst({
      where: {
        observerId: user.id,
        status: { in: ["draft", "active"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        visitDate: true,
        updatedAt: true,
        site: { select: { name: true } },
      },
    }),
  ]);

  const candidates: Array<{ kind: "session" | "visit"; updatedAt: Date; build: () => CurrentWork }> = [];
  if (session) {
    candidates.push({
      kind: "session",
      updatedAt: session.updatedAt,
      build: () => {
        const agentName =
          session.agent && (session.agent.firstName || session.agent.lastName)
            ? `${session.agent.lastName ?? ""} ${session.agent.firstName ?? ""}`.trim()
            : "Sans agent";
        return {
          kind: "session",
          id: session.id,
          title: `Veille — ${agentName}`,
          subtitle: `${session.procedures.length} procédure(s)`,
          href: `/sessions/${session.id}`,
          startedAt: session.startedAt,
          isStale: now.getTime() - session.updatedAt.getTime() > 7 * DAY_MS,
        };
      },
    });
  }
  if (visit) {
    candidates.push({
      kind: "visit",
      updatedAt: visit.updatedAt,
      build: () => ({
        kind: "visit",
        id: visit.id,
        title: `Visite — ${visit.site.name}`,
        subtitle: "Visite de site en cours",
        href: `/visits/${visit.id}`,
        startedAt: visit.visitDate,
        isStale: now.getTime() - visit.updatedAt.getTime() > 7 * DAY_MS,
      }),
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return candidates[0].build();
}

/**
 * Actions ImportedAction encore actives, sur le scope de l'utilisateur,
 * avec une échéance ≤ +N jours (paramétrable) ou en retard.
 */
export async function getOpenActions(
  user: SessionUser,
  now: Date,
  windowDays = 30,
): Promise<TodoItem[]> {
  const rows = await prisma.importedAction.findMany({
    where: {
      ...actionScope(user),
      localStatus: "ACTIVE",
      dueAt: { lte: addDays(now, windowDays) },
    },
    orderBy: { dueAt: "asc" },
    take: 50,
    select: {
      id: true,
      teamId: true,
      agentId: true,
      siteId: true,
      keyPoint: true,
      comment: true,
      dueAt: true,
      agent: { select: { id: true, firstName: true, lastName: true } },
      site: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => mapImportedActionToTodoItem(r as ImportedActionRow));
}

/**
 * Brouillons (sessions et visites) appartenant à l'utilisateur, dont la
 * dernière modification dépasse STALE_DRAFT_DAYS.
 */
export async function getStaleDrafts(
  user: SessionUser,
  now: Date,
): Promise<TodoItem[]> {
  const staleBefore = subDays(now, STALE_DRAFT_DAYS);
  const [sessions, visits] = await Promise.all([
    prisma.veilleSession.findMany({
      where: {
        observerId: user.id,
        status: { in: ["draft", "active"] },
        updatedAt: { lt: staleBefore },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
      select: {
        id: true,
        teamId: true,
        startedAt: true,
        updatedAt: true,
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.siteVisit.findMany({
      where: {
        observerId: user.id,
        status: { in: ["draft", "active"] },
        updatedAt: { lt: staleBefore },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
      select: {
        id: true,
        teamId: true,
        visitDate: true,
        updatedAt: true,
        site: { select: { id: true, name: true } },
      },
    }),
  ]);
  return [
    ...sessions.map((s) => mapDraftSessionToTodoItem(s as DraftSessionRow)),
    ...visits.map((v) => mapDraftVisitToTodoItem(v as DraftVisitRow)),
  ];
}

/**
 * Équipements en péremption (≤ EQUIPMENT_EXPIRATION_WINDOW_DAYS) sur les
 * sites accessibles à l'utilisateur.
 */
export async function getExpiringEquipments(
  user: SessionUser,
  now: Date,
): Promise<TodoItem[]> {
  const rows = await prisma.siteEquipment.findMany({
    where: {
      isActive: true,
      expirationDate: {
        not: null,
        lte: addDays(now, EQUIPMENT_EXPIRATION_WINDOW_DAYS),
      },
      site: siteScope(user),
    },
    orderBy: { expirationDate: "asc" },
    take: 20,
    select: {
      id: true,
      label: true,
      category: true,
      expirationDate: true,
      site: { select: { id: true, name: true, teamId: true } },
    },
  });
  return rows
    .filter((r): r is typeof r & { expirationDate: Date } => !!r.expirationDate)
    .map((r) => mapExpiringEquipmentToTodoItem(r as ExpiringEquipmentRow, now));
}

/**
 * 3 dernières activités de l'utilisateur, toutes sources confondues.
 */
export async function getRecentActivityForUser(
  user: SessionUser,
  now: Date,
  limit = 3,
): Promise<RecentActivityItem[]> {
  const [sessions, visits, validations, sightings] = await Promise.all([
    prisma.veilleSession.findMany({
      where: { observerId: user.id, status: "completed", finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        finishedAt: true,
        agent: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.siteVisit.findMany({
      where: { observerId: user.id, status: "completed", finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        finishedAt: true,
        site: { select: { name: true } },
      },
    }),
    prisma.actionValidation.findMany({
      where: { validatedById: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        action: { select: { keyPoint: true } },
      },
    }),
    prisma.agentSighting.findMany({
      where: { observerId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        agent: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const events: Parameters<typeof mapRecentEvent>[0][] = [];
  for (const s of sessions) {
    const agentName =
      s.agent && (s.agent.firstName || s.agent.lastName)
        ? `${s.agent.lastName ?? ""} ${s.agent.firstName ?? ""}`.trim()
        : "Sans agent";
    events.push({
      kind: "session",
      id: s.id,
      at: s.finishedAt as Date,
      label: `Veille terminée — ${agentName}`,
    });
  }
  for (const v of visits) {
    events.push({
      kind: "visit",
      id: v.id,
      at: v.finishedAt as Date,
      label: `Visite terminée — ${v.site.name}`,
    });
  }
  for (const val of validations) {
    events.push({
      kind: "validation",
      id: val.id,
      at: val.createdAt,
      label: `Action validée — ${val.action?.keyPoint ?? "sans libellé"}`,
    });
  }
  for (const sg of sightings) {
    const agentName =
      sg.agent && (sg.agent.firstName || sg.agent.lastName)
        ? `${sg.agent.lastName ?? ""} ${sg.agent.firstName ?? ""}`.trim()
        : "Sans agent";
    events.push({
      kind: "sighting",
      id: sg.id,
      at: sg.createdAt,
      label: `Vu — ${agentName}`,
    });
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
    .map((e) => mapRecentEvent(e, now));
}

// ─── EDITOR ──────────────────────────────────────────────────────────────────

/**
 * Diagnostic global — compte les retards sur 3 axes (actions, visites,
 * équipements) et en déduit un état rouge/jaune/vert.
 */
export async function getEditorDiagnostic(
  user: SessionUser,
  now: Date,
): Promise<EditorDiagnostic> {
  const [lateActions7d, expiredEquipments, expiringEquipments, lateVisits] =
    await Promise.all([
      prisma.importedAction.count({
        where: {
          ...actionScope(user),
          localStatus: "ACTIVE",
          dueAt: { lt: subDays(now, 7) },
        },
      }),
      prisma.siteEquipment.count({
        where: {
          isActive: true,
          expirationDate: { not: null, lt: now },
          site: siteScope(user),
        },
      }),
      prisma.siteEquipment.count({
        where: {
          isActive: true,
          expirationDate: {
            not: null,
            gte: now,
            lte: addDays(now, EQUIPMENT_EXPIRATION_WINDOW_DAYS),
          },
          site: siteScope(user),
        },
      }),
      countLateVisits(user, now),
    ]);
  // Règles V1 (cf. TODAY-V1.md §5.4) :
  //  - 🔴 si des actions actives sont en retard > 7 j ou des équipements
  //    sont déjà périmés (impact réglementaire immédiat).
  //  - 🟡 sinon si des visites sont en retard ou des équipements vont
  //    expirer dans les 30 jours (alerte préventive).
  //  - 🟢 sinon : tout est sous contrôle.
  let state: EditorDiagnostic["state"];
  if (lateActions7d > 0 || expiredEquipments > 0) state = "red";
  else if (lateVisits > 0 || expiringEquipments > 0) state = "yellow";
  else state = "green";
  return {
    state,
    lateActions7d,
    lateVisits,
    expiredEquipments,
    expiringEquipments,
  };
}

/**
 * Visites en retard — V1 : on dérive `lastVisitDate` par sous-requête
 * et on compare à `DEFAULT_VISIT_FREQUENCY_DAYS` (90 j).
 * Aucun champ `Site.isOccupied` n'existe encore : on applique la cadence
 * trimestrielle conservative pour tous les sites du scope.
 */
async function countLateVisits(user: SessionUser, now: Date): Promise<number> {
  const threshold = subDays(now, DEFAULT_VISIT_FREQUENCY_DAYS);
  // Sites du scope ayant aucune visite finie OU dont la dernière est avant
  // le seuil. On charge les ids puis on filtre côté Node : SQLite ne fait pas
  // toujours bon ménage des subqueries corrélées via Prisma.
  const sites = await prisma.site.findMany({
    where: { isActive: true, ...siteScope(user) },
    select: {
      id: true,
      visits: {
        where: { status: "completed", finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: 1,
        select: { finishedAt: true },
      },
    },
  });
  let count = 0;
  for (const s of sites) {
    const last = s.visits[0]?.finishedAt;
    if (!last || last < threshold) count++;
  }
  return count;
}

/**
 * Compteurs hebdomadaires bruts (pas d'objectif/ratio V1).
 */
export async function getEditorWeekCounters(
  user: SessionUser,
  now: Date,
): Promise<EditorWeekCounters> {
  const weekStart = startOfWeekParis(now);
  const [visits, sessions, closedActions] = await Promise.all([
    prisma.siteVisit.count({
      where: {
        ...teamScope(user),
        status: "completed",
        finishedAt: { gte: weekStart, lte: now },
      },
    }),
    prisma.veilleSession.count({
      where: {
        ...teamScope(user),
        status: "completed",
        finishedAt: { gte: weekStart, lte: now },
      },
    }),
    prisma.actionValidation.count({
      where: {
        ...teamScope(user),
        createdAt: { gte: weekStart, lte: now },
      },
    }),
  ]);
  return { visits, sessions, closedActions };
}

/**
 * Top N agents triés par dernière session ASC (les plus anciens d'abord).
 * `lastSessionAt` dérivé par sous-requête (pas de champ stocké).
 */
export async function getAgentsToReview(
  user: SessionUser,
  now: Date,
  limit = 5,
): Promise<{ items: WatchlistItem[]; total: number }> {
  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where: { isVisible: true, ...agentScope(user) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { startedAt: true },
        },
      },
      take: 200,
    }),
    prisma.agent.count({ where: { isVisible: true, ...agentScope(user) } }),
  ]);
  const enriched = agents.map((a) => {
    const last = a.sessions[0]?.startedAt ?? null;
    const daysSince = last
      ? Math.floor((now.getTime() - last.getTime()) / DAY_MS)
      : null;
    return { id: a.id, firstName: a.firstName, lastName: a.lastName, daysSince };
  });
  enriched.sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return 0;
    if (a.daysSince === null) return -1;
    if (b.daysSince === null) return 1;
    return b.daysSince - a.daysSince;
  });
  // On ne garde que les agents réellement « à veiller » : jamais vus OU
  // dont la dernière session date de plus de 14 jours. Les agents très
  // récemment veillés ne polluent pas la liste.
  const watchlist = enriched.filter((a) => (a.daysSince ?? Infinity) > 14);
  const top = watchlist.slice(0, limit);
  // Compteur d'actions ouvertes par agent — purement informatif, n'entre
  // pas dans le tri principal (qui reste basé sur la fraîcheur).
  const openActionsByAgent = await countOpenActionsForAgents(top.map((a) => a.id));
  const items: WatchlistItem[] = top.map((a) => ({
    id: a.id,
    name: `${a.lastName ?? ""} ${a.firstName ?? ""}`.trim() || "Agent",
    daysSince: a.daysSince,
    level: levelForFreshness(a.daysSince),
    cta: { label: "Veiller", href: `/sessions/new?agentId=${a.id}` },
    badges: { openActions: openActionsByAgent.get(a.id) ?? 0 },
  }));
  return { items, total: watchlist.length };
}

async function countOpenActionsForAgents(
  agentIds: string[],
): Promise<Map<string, number>> {
  if (!agentIds.length) return new Map();
  const rows = await prisma.importedAction.groupBy({
    by: ["agentId"],
    where: { agentId: { in: agentIds }, localStatus: "ACTIVE" },
    _count: { _all: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.agentId) m.set(r.agentId, r._count._all);
  }
  return m;
}

/**
 * Top N sites sans visite récente. Dérive `lastVisitDate` par sous-requête.
 */
export async function getSitesWithoutVisit(
  user: SessionUser,
  now: Date,
  limit = 5,
): Promise<{ items: WatchlistItem[]; total: number }> {
  const sites = await prisma.site.findMany({
    where: { isActive: true, ...siteScope(user) },
    select: {
      id: true,
      name: true,
      visits: {
        where: { status: "completed", finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: 1,
        select: { finishedAt: true },
      },
    },
    take: 500,
  });
  const enriched = sites.map((s) => {
    const last = s.visits[0]?.finishedAt ?? null;
    const daysSince = last
      ? Math.floor((now.getTime() - last.getTime()) / DAY_MS)
      : null;
    return { id: s.id, name: s.name, daysSince };
  });
  enriched.sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return 0;
    if (a.daysSince === null) return -1;
    if (b.daysSince === null) return 1;
    return b.daysSince - a.daysSince;
  });
  // On ne retient que les sites réellement « à visiter » : jamais visités
  // OU dont la dernière visite trimestrielle dépasse 90 jours
  // (DEFAULT_VISIT_FREQUENCY_DAYS, heuristique V1).
  const watchlist = enriched.filter(
    (s) => (s.daysSince ?? Infinity) > DEFAULT_VISIT_FREQUENCY_DAYS,
  );
  const top = watchlist.slice(0, limit);
  // Compteur d'équipements en alerte (périmé OU expirant ≤ 30 j) par site.
  const equipmentAlertsBySite = await countEquipmentAlertsForSites(
    top.map((s) => s.id),
    now,
  );
  const items: WatchlistItem[] = top.map((s) => ({
    id: s.id,
    name: s.name,
    daysSince: s.daysSince,
    level: levelForVisitOverdue(s.daysSince),
    cta: { label: "Visiter", href: `/visits/new?siteId=${s.id}` },
    badges: { equipmentAlerts: equipmentAlertsBySite.get(s.id) ?? 0 },
  }));
  return { items, total: watchlist.length };
}

async function countEquipmentAlertsForSites(
  siteIds: string[],
  now: Date,
): Promise<Map<string, number>> {
  if (!siteIds.length) return new Map();
  const rows = await prisma.siteEquipment.groupBy({
    by: ["siteId"],
    where: {
      siteId: { in: siteIds },
      isActive: true,
      expirationDate: {
        not: null,
        lte: addDays(now, EQUIPMENT_EXPIRATION_WINDOW_DAYS),
      },
    },
    _count: { _all: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.siteId, r._count._all);
  return m;
}

/**
 * Périmètre EDITOR (compteurs d'équipes / sites / agents visibles).
 */
export async function getEditorPerimeter(
  user: SessionUser,
): Promise<{ teamsCount: number; sitesCount: number; agentsCount: number }> {
  const [sitesCount, agentsCount] = await Promise.all([
    prisma.site.count({ where: { isActive: true, ...siteScope(user) } }),
    prisma.agent.count({ where: { isVisible: true, ...agentScope(user) } }),
  ]);
  const teamsCount = user.role === "ADMIN" ? 0 : user.teamIds.length;
  return { teamsCount, sitesCount, agentsCount };
}

const levelForFreshness = (daysSince: number | null): "red" | "orange" | "yellow" => {
  if (daysSince === null || daysSince > 30) return "red";
  if (daysSince > 14) return "orange";
  return "yellow";
};

const levelForVisitOverdue = (daysSince: number | null): "red" | "orange" | "yellow" => {
  if (daysSince === null) return "red";
  if (daysSince > DEFAULT_VISIT_FREQUENCY_DAYS) return "red";
  if (daysSince > DEFAULT_VISIT_FREQUENCY_DAYS - 14) return "orange";
  return "yellow";
};

// ─── ADMIN ───────────────────────────────────────────────────────────────────

/**
 * Statut système global.
 */
export async function getAdminSystemStatus(
  now: Date,
): Promise<{
  state: "ok" | "degraded" | "incident";
  usersCount: number;
  teamsCount: number;
  lastBackupAt: Date | null;
}> {
  const [usersCount, teamsCount, lastBackupAt] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.team.count(),
    getLastBackupAt(),
  ]);
  const backupAgeMs = lastBackupAt ? now.getTime() - lastBackupAt.getTime() : Infinity;
  const state: "ok" | "degraded" | "incident" =
    backupAgeMs > 72 * 60 * 60 * 1000
      ? "incident"
      : backupAgeMs > 36 * 60 * 60 * 1000
        ? "degraded"
        : "ok";
  return { state, usersCount, teamsCount, lastBackupAt };
}

/** Lit le mtime du dernier dump SQLite (Sprint 1 US-1.8). */
async function getLastBackupAt(): Promise<Date | null> {
  const dir = process.env.BACKUP_DIR ?? "data/backups";
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const files = await fs.readdir(dir);
    if (!files.length) return null;
    let latest = 0;
    for (const f of files) {
      try {
        const stat = await fs.stat(path.join(dir, f));
        if (stat.mtimeMs > latest) latest = stat.mtimeMs;
      } catch {
        // ignorer un fichier inaccessible
      }
    }
    return latest > 0 ? new Date(latest) : null;
  } catch {
    return null;
  }
}

/**
 * Alertes système — sessions orphelines + tentatives login échouées.
 */
export async function getAdminAlerts(now: Date): Promise<AdminAlert[]> {
  const alerts: AdminAlert[] = [];
  const thirtyDaysAgo = subDays(now, 30);
  const [staleDrafts, loginFailed24h] = await Promise.all([
    prisma.veilleSession.count({
      where: { status: "draft", updatedAt: { lt: thirtyDaysAgo } },
    }),
    prisma.auditLog.count({
      where: { action: "LOGIN_FAILED", createdAt: { gte: subDays(now, 1) } },
    }),
  ]);
  if (staleDrafts > 0) {
    alerts.push({
      id: "stale-drafts",
      level: "warn",
      label: `${staleDrafts} session(s) brouillon > 30 j`,
      href: "/sessions?status=draft",
    });
  }
  if (loginFailed24h >= 10) {
    alerts.push({
      id: "login-failed",
      level: loginFailed24h >= 50 ? "error" : "warn",
      label: `${loginFailed24h} tentatives de connexion échouées (24 h)`,
    });
  } else {
    alerts.push({
      id: "login-ok",
      level: "ok",
      label: "Aucune anomalie de connexion (24 h)",
    });
  }
  return alerts;
}

/**
 * Usage 7 derniers jours (sessions / visites / validations / photos).
 */
export async function getAdminUsage7d(now: Date): Promise<AdminUsage> {
  const since = subDays(now, 7);
  const [sessions, visits, validatedActions, photos] = await Promise.all([
    prisma.veilleSession.count({ where: { createdAt: { gte: since } } }),
    prisma.siteVisit.count({ where: { createdAt: { gte: since } } }),
    prisma.actionValidation.count({ where: { createdAt: { gte: since } } }),
    prisma.photo.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { sessions, visits, validatedActions, photos };
}

/**
 * 5 dernières entrées AuditLog (activité système).
 */
export async function getAdminRecentActivity(
  now: Date,
  limit = 5,
): Promise<RecentActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entity: true,
      userEmail: true,
      createdAt: true,
    },
  });
  return logs.map((l) =>
    mapRecentEvent(
      {
        kind: "validation",
        id: l.id,
        at: l.createdAt,
        label: `${l.action} ${l.entity}${l.userEmail ? ` · ${l.userEmail}` : ""}`,
      },
      now,
    ),
  );
}
