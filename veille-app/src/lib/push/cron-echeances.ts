/**
 * Cron des échéances critiques (Sprint Push V1 — C8).
 *
 * Stratégie : ne PAS réinventer le scope. On réutilise la même source
 * de vérité que /today et /api/echeances :
 *   getCriticalEcheancesItems(user, now)
 *
 * Puis on délègue la création des Notification au générateur existant :
 *   notifyEcheancesCriticalForUser(userId, items)
 *
 * Le push se déclenche automatiquement via `createNotification` →
 * `sendPushNotification` (C6). Aucune logique push directe ici.
 *
 * Périmètre cible : EDITOR + ADMIN uniquement. USER exclu en V1
 * (même règle que `getNotificationRecipients` côté générateurs).
 */

import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import type { SessionUser, Role } from "@/lib/auth";
import { getCriticalEcheancesItems } from "@/lib/echeances/aggregator";
import { notifyEcheancesCriticalForUser } from "@/lib/notifications-generators";

/** Rapport JSON renvoyé par la route + persisté en log. */
export type EcheancesPushReport = {
  usersScanned: number;
  usersWithCriticalItems: number;
  notificationsAttempted: number;
  notificationsCreated: number;
  notificationsDeduped: number;
  errors: number;
  elapsedMs: number;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId: string | null;
  viewAllTeams: boolean;
  adminScopeMode: string | null;
  adminTeamId: string | null;
  memberships: { teamId: string }[];
};

/**
 * Reconstruit un `SessionUser` à partir d'une row DB. On ne peut pas
 * appeler `getSessionUser` ici (pas de cookie en contexte cron), donc
 * on compose à la main avec le même fallback que `auth.ts`.
 */
function buildSessionUser(u: UserRow): SessionUser {
  const teamIds = u.memberships.map((m) => m.teamId);
  if (teamIds.length === 0 && u.teamId) teamIds.push(u.teamId);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    teamId: u.teamId,
    teamIds,
    viewAllTeams: u.viewAllTeams,
    adminScopeMode: u.adminScopeMode,
    adminTeamId: u.adminTeamId,
  };
}

/**
 * Exécution principale du cron — réutilisable hors HTTP (tests, scripts
 * de maintenance).
 *
 * Traitement séquentiel des users. Pour V1 (typiquement 10-200 EDITOR/
 * ADMIN, quelques items critiques chacun), le coût est négligeable.
 * Si la volumétrie l'exige, basculer sur `Promise.all` par batches.
 *
 * Une erreur sur un user est isolée — les suivants sont traités.
 *
 * `notifyEcheancesCriticalForUser` renvoie le nombre de Notification
 * effectivement créées (= attempted - dedup P2002). C'est notre source
 * de vérité pour le compteur `notificationsCreated`. Limitation :
 * impossible de distinguer une dédup d'un échec Prisma silencieux —
 * tous deux comptent comme "non créé" puis "deduped" (cf. doc).
 */
export async function runEcheancesPushCron(
  now: Date,
): Promise<EcheancesPushReport> {
  const t0 = Date.now();

  const users = (await prisma.user.findMany({
    where: { isActive: true, role: { in: ["EDITOR", "ADMIN"] } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
      viewAllTeams: true,
      adminScopeMode: true,
      adminTeamId: true,
      memberships: { select: { teamId: true } },
    },
  })) as UserRow[];

  let usersWithCriticalItems = 0;
  let notificationsAttempted = 0;
  let notificationsCreated = 0;
  let errors = 0;

  for (const row of users) {
    try {
      const su = buildSessionUser(row);
      const items = await getCriticalEcheancesItems(su, now);
      if (items.length === 0) continue;
      usersWithCriticalItems++;
      notificationsAttempted += items.length;
      const created = await notifyEcheancesCriticalForUser(row.id, items);
      notificationsCreated += created;
    } catch (e) {
      errors++;
      log.error("cron.echeances-push.user.failed", {
        userId: row.id,
        role: row.role,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const report: EcheancesPushReport = {
    usersScanned: users.length,
    usersWithCriticalItems,
    notificationsAttempted,
    notificationsCreated,
    notificationsDeduped: Math.max(
      0,
      notificationsAttempted - notificationsCreated,
    ),
    errors,
    elapsedMs: Date.now() - t0,
  };

  log.info("cron.echeances-push.done", report);
  return report;
}
