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
  classifyVisitTemplateSlug,
  visitFrequencyDays,
  type VisitCadenceType,
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
 * Visites en retard — un site est compté si trimestrielle OU planifiée est
 * dépassée. Les deux cadences sont suivies SÉPARÉMENT
 * (cf. memory/business-rules.md §Visites) :
 *  - trimestrielle : 90 j pour tous les sites ;
 *  - planifiée    : 180 j si occupé / 365 j si inoccupé.
 * Un site « jamais visité (cadence X) » est considéré en retard sur X.
 */
async function countLateVisits(user: SessionUser, now: Date): Promise<number> {
  const sites = await fetchSitesWithRecentVisits(user);
  let count = 0;
  for (const s of sites) {
    const status = computeSiteVisitStatus(s, now);
    if (status.overdueTypes.length > 0) count++;
  }
  return count;
}

/** Charge tous les sites du scope + leurs dernières visites complètes par cadence. */
async function fetchSitesWithRecentVisits(user: SessionUser) {
  return prisma.site.findMany({
    where: { isActive: true, ...siteScope(user) },
    select: {
      id: true,
      name: true,
      isOccupied: true,
      // On prend les 20 dernières visites complètes : assez pour trouver la
      // dernière trimestrielle ET la dernière planifiée, même si elles sont
      // imbriquées avec d'autres types (INVENTORY, etc.).
      visits: {
        where: { status: "completed", finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: 20,
        select: {
          finishedAt: true,
          template: { select: { slug: true } },
        },
      },
    },
    take: 500,
  });
}

type SiteWithVisits = Awaited<ReturnType<typeof fetchSitesWithRecentVisits>>[number];

type SiteVisitStatus = {
  lastQuarterly: Date | null;
  lastPlanned: Date | null;
  /** Date la plus récente toutes cadences confondues (utile pour `daysSince`). */
  lastAny: Date | null;
  quarterlyOverdueDays: number | null; // null si à jour
  plannedOverdueDays: number | null;   // null si à jour
  overdueTypes: ("quarterly" | "planned")[];
};

/**
 * Calcule l'état de retard d'un site sur les deux cadences indépendantes.
 * Un site « jamais visité (cadence X) » est en retard maximal sur X.
 */
function computeSiteVisitStatus(
  s: { isOccupied: boolean; visits: SiteWithVisits["visits"] },
  now: Date,
): SiteVisitStatus {
  let lastQuarterly: Date | null = null;
  let lastPlanned: Date | null = null;
  let lastAny: Date | null = null;
  for (const v of s.visits) {
    if (!v.finishedAt) continue;
    if (!lastAny || v.finishedAt > lastAny) lastAny = v.finishedAt;
    const cadence = classifyVisitTemplateSlug(v.template.slug);
    if (cadence === "quarterly" && !lastQuarterly) lastQuarterly = v.finishedAt;
    else if (cadence === "planned" && !lastPlanned) lastPlanned = v.finishedAt;
  }
  const quarterlyThreshold = visitFrequencyDays("quarterly", s.isOccupied);
  const plannedThreshold = visitFrequencyDays("planned", s.isOccupied);
  const daysSinceQuarterly = lastQuarterly
    ? Math.floor((now.getTime() - lastQuarterly.getTime()) / DAY_MS)
    : null;
  const daysSincePlanned = lastPlanned
    ? Math.floor((now.getTime() - lastPlanned.getTime()) / DAY_MS)
    : null;
  const quarterlyOverdueDays =
    daysSinceQuarterly === null
      ? quarterlyThreshold + 1
      : daysSinceQuarterly > quarterlyThreshold
        ? daysSinceQuarterly - quarterlyThreshold
        : null;
  const plannedOverdueDays =
    daysSincePlanned === null
      ? plannedThreshold + 1
      : daysSincePlanned > plannedThreshold
        ? daysSincePlanned - plannedThreshold
        : null;
  const overdueTypes: ("quarterly" | "planned")[] = [];
  if (quarterlyOverdueDays !== null) overdueTypes.push("quarterly");
  if (plannedOverdueDays !== null) overdueTypes.push("planned");
  return {
    lastQuarterly,
    lastPlanned,
    lastAny,
    quarterlyOverdueDays,
    plannedOverdueDays,
    overdueTypes,
  };
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
 * Top N sites à visiter — suit les deux mécanismes INDÉPENDANTS de
 * visite (cf. memory/business-rules.md §Visites) :
 *  - trimestrielle : 90 j pour tous les sites ;
 *  - planifiée    : 180 j (occupé) / 365 j (inoccupé).
 *
 * Un site est inclus dans la watchlist si au moins une des deux cadences
 * est dépassée. Le tri se fait par retard maximal toutes cadences
 * confondues (« le plus en retard d'abord »). Les sites jamais visités
 * sur une cadence sont considérés en retard maximal sur cette cadence.
 */
export async function getSitesWithoutVisit(
  user: SessionUser,
  now: Date,
  limit = 5,
): Promise<{ items: WatchlistItem[]; total: number }> {
  const sites = await fetchSitesWithRecentVisits(user);
  const enriched = sites.map((s) => {
    const status = computeSiteVisitStatus(s, now);
    const maxOverdue = Math.max(
      status.quarterlyOverdueDays ?? 0,
      status.plannedOverdueDays ?? 0,
    );
    // daysSince exposé = jours depuis la dernière visite quelle que soit
    // la cadence (préserve la signature de WatchlistItem).
    const daysSinceLastAny = status.lastAny
      ? Math.floor((now.getTime() - status.lastAny.getTime()) / DAY_MS)
      : null;
    return { site: s, status, maxOverdue, daysSinceLastAny };
  });
  // Filtre : au moins une cadence en retard.
  const watchlist = enriched.filter((e) => e.status.overdueTypes.length > 0);
  // Tri : le plus en retard d'abord (tie-break sur lastAny null first).
  watchlist.sort((a, b) => {
    if (b.maxOverdue !== a.maxOverdue) return b.maxOverdue - a.maxOverdue;
    if (a.daysSinceLastAny === null && b.daysSinceLastAny !== null) return -1;
    if (b.daysSinceLastAny === null && a.daysSinceLastAny !== null) return 1;
    return (b.daysSinceLastAny ?? 0) - (a.daysSinceLastAny ?? 0);
  });
  const top = watchlist.slice(0, limit);
  const equipmentAlertsBySite = await countEquipmentAlertsForSites(
    top.map((e) => e.site.id),
    now,
  );
  const items: WatchlistItem[] = top.map((e) => ({
    id: e.site.id,
    name: e.site.name,
    daysSince: e.daysSinceLastAny,
    level: levelForVisitOverdue(e.maxOverdue, e.site.isOccupied),
    cta: { label: "Visiter", href: `/visits/new?siteId=${e.site.id}` },
    badges: {
      equipmentAlerts: equipmentAlertsBySite.get(e.site.id) ?? 0,
      overdueVisitTypes: e.status.overdueTypes,
      isUnoccupied: !e.site.isOccupied,
    },
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

/**
 * Niveau visuel d'un site en retard de visite.
 * `overdueDays` = nombre de jours de retard sur la cadence la plus
 * contraignante. `isOccupied` permet d'ajuster les seuils si besoin.
 */
const levelForVisitOverdue = (
  overdueDays: number,
  _isOccupied: boolean,
): "red" | "orange" | "yellow" => {
  if (overdueDays > 30) return "red";
  if (overdueDays > 7) return "orange";
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
