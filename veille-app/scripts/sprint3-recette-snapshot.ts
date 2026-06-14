/* eslint-disable no-console */
/**
 * Snapshot DB pour la recette Sprint 3 C10.
 * Imprime l'état utilisateurs / équipes / sites / activité.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const [users, teams, sites, agents, photoCount, sessionCount, visitCount, activityCount, migrations] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          viewAllTeams: true,
          teamId: true,
          memberships: { select: { teamId: true } },
        },
      }),
      prisma.team.findMany({ select: { id: true, name: true } }),
      prisma.site.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          isOccupied: true,
          teamId: true,
          memberships: { select: { teamId: true } },
        },
      }),
      prisma.agent.count(),
      prisma.photo.count(),
      prisma.veilleSession.count(),
      prisma.siteVisit.count(),
      prisma.teamActivity.count(),
      prisma.$queryRawUnsafe<{ migration_name: string }[]>(
        "SELECT migration_name FROM _prisma_migrations ORDER BY started_at",
      ),
    ]);

  console.log(JSON.stringify({
    users: users.map(u => ({ ...u, memberships: u.memberships.map(m => m.teamId) })),
    teams,
    sites: sites.map(s => ({ ...s, memberships: s.memberships.map(t => t.teamId) })),
    counts: { agents, photoCount, sessionCount, visitCount, activityCount },
    migrations: migrations.map(m => m.migration_name),
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
