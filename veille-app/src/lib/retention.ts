/**
 * Rétention automatique (Sprint 5 C8).
 *
 * Helpers purs pour le calcul des seuils + helper exécuteur réutilisable
 * (testable via Vitest avec mock Prisma).
 */

import { prisma } from "@/lib/prisma";

export const RETENTION_THRESHOLDS = {
  /** Notifications lues : 90 jours (D6). */
  notificationsRead: 90,
  /** Notifications non lues : 180 jours. */
  notificationsUnread: 180,
  /** TeamActivity : 180 jours. */
  teamActivity: 180,
  /** AuditLog : 365 jours. */
  auditLog: 365,
} as const;

export type RetentionThresholds = typeof RETENTION_THRESHOLDS;

export type RetentionScopeKey =
  | "notificationsRead"
  | "notificationsUnread"
  | "teamActivity"
  | "auditLog";

export type RetentionReport = {
  dryRun: boolean;
  thresholds: RetentionThresholds;
  /** ISO de la limite (createdAt < cutoff) pour chaque scope. */
  cutoffs: Record<RetentionScopeKey, string>;
  detected: Record<RetentionScopeKey, number>;
  deleted: Record<RetentionScopeKey, number>;
  /** ISO `now` figée pour cette exécution. */
  executedAt: string;
};

const DAY_MS = 86_400_000;

function cutoffFor(days: number, now: Date): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/**
 * Exécute la rétention pour `now` donné. En `dryRun`, ne supprime rien
 * et `deleted` reste à 0. Sinon, `deleteMany` puis renvoie le count
 * effectif (qui peut différer marginalement de `detected` si des rows
 * sont insérées entre les deux requêtes — la valeur de `deleted` est
 * la source de vérité opérationnelle).
 */
export async function runRetention(
  now: Date,
  options: { dryRun: boolean },
): Promise<RetentionReport> {
  const thresholds = RETENTION_THRESHOLDS;
  const cutoffs = {
    notificationsRead: cutoffFor(thresholds.notificationsRead, now),
    notificationsUnread: cutoffFor(thresholds.notificationsUnread, now),
    teamActivity: cutoffFor(thresholds.teamActivity, now),
    auditLog: cutoffFor(thresholds.auditLog, now),
  };

  const whereReadOld = {
    readAt: { not: null, lt: cutoffs.notificationsRead },
  } satisfies Record<string, unknown>;
  const whereUnreadOld = {
    readAt: null,
    createdAt: { lt: cutoffs.notificationsUnread },
  } satisfies Record<string, unknown>;
  const whereTeamActOld = {
    createdAt: { lt: cutoffs.teamActivity },
  } satisfies Record<string, unknown>;
  const whereAuditOld = {
    createdAt: { lt: cutoffs.auditLog },
  } satisfies Record<string, unknown>;

  const [detectedRead, detectedUnread, detectedTA, detectedAudit] =
    await Promise.all([
      prisma.notification.count({ where: whereReadOld }),
      prisma.notification.count({ where: whereUnreadOld }),
      prisma.teamActivity.count({ where: whereTeamActOld }),
      prisma.auditLog.count({ where: whereAuditOld }),
    ]);

  const deleted: Record<RetentionScopeKey, number> = {
    notificationsRead: 0,
    notificationsUnread: 0,
    teamActivity: 0,
    auditLog: 0,
  };

  if (!options.dryRun) {
    const [delRead, delUnread, delTA, delAudit] = await Promise.all([
      prisma.notification.deleteMany({ where: whereReadOld }),
      prisma.notification.deleteMany({ where: whereUnreadOld }),
      prisma.teamActivity.deleteMany({ where: whereTeamActOld }),
      prisma.auditLog.deleteMany({ where: whereAuditOld }),
    ]);
    deleted.notificationsRead = delRead.count;
    deleted.notificationsUnread = delUnread.count;
    deleted.teamActivity = delTA.count;
    deleted.auditLog = delAudit.count;
  }

  return {
    dryRun: options.dryRun,
    thresholds,
    cutoffs: {
      notificationsRead: cutoffs.notificationsRead.toISOString(),
      notificationsUnread: cutoffs.notificationsUnread.toISOString(),
      teamActivity: cutoffs.teamActivity.toISOString(),
      auditLog: cutoffs.auditLog.toISOString(),
    },
    detected: {
      notificationsRead: detectedRead,
      notificationsUnread: detectedUnread,
      teamActivity: detectedTA,
      auditLog: detectedAudit,
    },
    deleted,
    executedAt: now.toISOString(),
  };
}
