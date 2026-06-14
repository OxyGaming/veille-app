/**
 * Agrégateur — construit le payload de l'écran Aujourd'hui selon le rôle.
 *
 * Toute requête Prisma est scopée via les helpers existants. Les sources sont
 * appelées en parallèle (`Promise.all`) pour rester sous 300 ms en SSR.
 */

import type { SessionUser } from "@/lib/auth";
import { topItems } from "./priority";
import {
  getAdminAlerts,
  getAdminRecentActivity,
  getAdminSystemStatus,
  getAdminUsage7d,
  getAgentsToReview,
  getCurrentWorkForUser,
  getEditorDiagnostic,
  getEditorPerimeter,
  getEditorWeekCounters,
  getExpiringEquipments,
  getOpenActions,
  getRecentActivityForUser,
  getSitesWithoutVisit,
  getStaleDrafts,
} from "./sources";
import type {
  AdminPayload,
  EditorPayload,
  TodayPayload,
  UserPayload,
} from "./types";

const TODO_LIMIT = 5;

/** Fabrique le payload de la variante USER. */
export async function aggregateUser(
  user: SessionUser,
  now: Date,
): Promise<UserPayload> {
  const [current, openActions, staleDrafts, expiring, recent] = await Promise.all([
    getCurrentWorkForUser(user, now),
    getOpenActions(user, now),
    getStaleDrafts(user, now),
    getExpiringEquipments(user, now),
    getRecentActivityForUser(user, now),
  ]);

  const allItems = [...openActions, ...staleDrafts, ...expiring];
  const ctx = { user: { id: user.id, teamIds: user.teamIds }, now };
  const sorted = topItems(allItems, ctx, TODO_LIMIT);

  return {
    role: "USER",
    now: now.toISOString(),
    greeting: {
      name: user.name,
      teamName: null, // résolu côté UI ou enrichi V2 (multi-équipes)
    },
    current,
    todoList: sorted,
    todoTotal: allItems.length,
    recent,
  };
}

/** Fabrique le payload de la variante EDITOR. */
export async function aggregateEditor(
  user: SessionUser,
  now: Date,
): Promise<EditorPayload> {
  const [perimeter, diagnostic, weekCounters, agents, sites] = await Promise.all([
    getEditorPerimeter(user),
    getEditorDiagnostic(user, now),
    getEditorWeekCounters(user, now),
    getAgentsToReview(user, now),
    getSitesWithoutVisit(user, now),
  ]);
  return {
    role: "EDITOR",
    now: now.toISOString(),
    tour: { perimeter },
    diagnostic,
    weekCounters,
    agentsToReview: agents.items,
    agentsToReviewTotal: agents.total,
    sitesWithoutVisit: sites.items,
    sitesWithoutVisitTotal: sites.total,
  };
}

/** Fabrique le payload de la variante ADMIN. */
export async function aggregateAdmin(
  user: SessionUser,
  now: Date,
): Promise<AdminPayload> {
  const [systemStatus, alerts, usage7d, recentActivity] = await Promise.all([
    getAdminSystemStatus(now),
    getAdminAlerts(now),
    getAdminUsage7d(now),
    getAdminRecentActivity(now),
  ]);
  return {
    role: "ADMIN",
    now: now.toISOString(),
    systemStatus,
    alerts,
    usage7d,
    recentActivity,
  };
}

/**
 * Switch selon le rôle. ADMIN avec scope équipe verra C10 ajouter le bloc
 * EDITOR au-dessus du bloc système ; en V1 on renvoie le payload ADMIN brut.
 */
export async function aggregateToday(
  user: SessionUser,
  now: Date = new Date(),
): Promise<TodayPayload> {
  if (user.role === "ADMIN") return aggregateAdmin(user, now);
  if (user.role === "EDITOR") return aggregateEditor(user, now);
  return aggregateUser(user, now);
}
