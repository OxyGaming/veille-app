/**
 * Mappers purs — convertissent une ligne Prisma en TodoItem / RecentActivityItem.
 *
 * Aucune dépendance Prisma client ici : on prend des « rows » objet simples
 * pour rester testables sans base et réutilisables côté futur Hub Échéances.
 */

import type { RecentActivityItem, TodoItem } from "./types";

const truncate = (s: string | null | undefined, max = 80): string =>
  !s ? "" : s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-day diff (jours pleins entre 00:00 et 00:00 en heure locale). */
const calendarDaysBetween = (later: Date, earlier: Date): number => {
  const startOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS,
  );
};

const formatRelativeDay = (date: Date, now: Date): string => {
  const daysAgo = calendarDaysBetween(now, date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (daysAgo <= 0) return `Aujourd'hui ${hh}:${mm}`;
  if (daysAgo === 1) return `Hier ${hh}:${mm}`;
  if (daysAgo < 7) {
    const weekday = date.toLocaleDateString("fr-FR", { weekday: "long" });
    return `${weekday} ${hh}:${mm}`;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
};

// ─── TodoItem mappers ────────────────────────────────────────────────────────

export type ImportedActionRow = {
  id: string;
  teamId: string;
  agentId: string | null;
  siteId: string | null;
  keyPoint: string | null;
  comment: string | null;
  dueAt: Date | null;
  agent: { id: string; firstName: string | null; lastName: string | null } | null;
  site: { id: string; name: string } | null;
};

export function mapImportedActionToTodoItem(row: ImportedActionRow): TodoItem {
  const agentName =
    row.agent && (row.agent.firstName || row.agent.lastName)
      ? `${row.agent.lastName ?? ""} ${row.agent.firstName ?? ""}`.trim()
      : null;
  const subtitleParts = [
    agentName,
    row.site?.name,
    row.dueAt
      ? `échéance ${row.dueAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
      : null,
  ].filter(Boolean);
  return {
    id: `action:${row.id}`,
    sourceType: "ACTION",
    sourceId: row.id,
    title: truncate(row.keyPoint ?? row.comment ?? "Action à valider"),
    subtitle: subtitleParts.join(" · "),
    dueAt: row.dueAt,
    context: {
      teamId: row.teamId,
      siteId: row.site?.id,
      siteName: row.site?.name,
      agentId: row.agent?.id,
      agentName: agentName ?? undefined,
    },
    assignedToUserId: null,
    cta: { label: "Valider", href: `/agents/${row.agentId ?? row.siteId ?? ""}` },
  };
}

export type DraftSessionRow = {
  id: string;
  teamId: string;
  startedAt: Date;
  updatedAt: Date;
  agent: { id: string; firstName: string | null; lastName: string | null } | null;
};

export function mapDraftSessionToTodoItem(row: DraftSessionRow): TodoItem {
  const agentName =
    row.agent && (row.agent.firstName || row.agent.lastName)
      ? `${row.agent.lastName ?? ""} ${row.agent.firstName ?? ""}`.trim()
      : null;
  return {
    id: `draft-session:${row.id}`,
    sourceType: "DRAFT_REMINDER",
    sourceId: row.id,
    title: `Veille en brouillon${agentName ? ` — ${agentName}` : ""}`,
    subtitle: `Démarrée le ${row.startedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`,
    dueAt: null,
    context: { teamId: row.teamId, agentId: row.agent?.id ?? undefined },
    assignedToUserId: null,
    cta: { label: "Reprendre", href: `/sessions/${row.id}` },
  };
}

export type DraftVisitRow = {
  id: string;
  teamId: string;
  visitDate: Date;
  updatedAt: Date;
  site: { id: string; name: string };
};

export function mapDraftVisitToTodoItem(row: DraftVisitRow): TodoItem {
  return {
    id: `draft-visit:${row.id}`,
    sourceType: "DRAFT_REMINDER",
    sourceId: row.id,
    title: `Visite en brouillon — ${row.site.name}`,
    subtitle: `Démarrée le ${row.visitDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`,
    dueAt: null,
    context: { teamId: row.teamId, siteId: row.site.id, siteName: row.site.name },
    assignedToUserId: null,
    cta: { label: "Reprendre", href: `/visits/${row.id}` },
  };
}

export type ExpiringEquipmentRow = {
  id: string;
  label: string;
  category: string;
  expirationDate: Date;
  site: { id: string; name: string; teamId: string | null };
};

export function mapExpiringEquipmentToTodoItem(
  row: ExpiringEquipmentRow,
  now: Date,
): TodoItem {
  const days = calendarDaysBetween(row.expirationDate, now);
  const tail =
    days < 0
      ? `périmé depuis ${Math.abs(days)} j`
      : days === 0
        ? "expire aujourd'hui"
        : `expire dans ${days} j`;
  return {
    id: `equipment:${row.id}`,
    sourceType: "EQUIPMENT_EXPIRING",
    sourceId: row.id,
    title: `${row.category} — ${truncate(row.label, 40)}`,
    subtitle: `${row.site.name} · ${tail}`,
    dueAt: row.expirationDate,
    context: {
      teamId: row.site.teamId ?? undefined,
      siteId: row.site.id,
      siteName: row.site.name,
    },
    assignedToUserId: null,
    cta: { label: "Voir", href: `/sites/${row.site.id}` },
  };
}

// ─── RecentActivityItem mappers ─────────────────────────────────────────────

export type RecentEventRow = {
  kind: "session" | "visit" | "sighting" | "validation";
  id: string;
  at: Date;
  label: string;
};

export function mapRecentEvent(
  row: RecentEventRow,
  now: Date,
): RecentActivityItem {
  return {
    id: `${row.kind}:${row.id}`,
    at: row.at,
    label: `${formatRelativeDay(row.at, now)} · ${row.label}`,
  };
}
