/* eslint-disable no-console */
/**
 * Lot d'assertions DB pour la recette Sprint 3 C10.
 * Imprime les résultats en JSON pour usage dans le rapport.
 */
import { prisma } from "../src/lib/prisma";

const SITE_A = "cmq9x4kfs0000y8ul8myn94vs";
const SITE_B = "cmqdpbg7m0006o8ulqx6xryyo";
const TEAM_A = "cmq9qr47000007oulk260tl7k";
const TEAM_B = "cmqdpbg4d0000o8ulo34y074t";

async function main() {
  // A. isOccupied final + counts globaux préservés
  const siteA = await prisma.site.findUniqueOrThrow({ where: { id: SITE_A }, select: { isOccupied: true } });
  const siteB = await prisma.site.findUniqueOrThrow({ where: { id: SITE_B }, select: { isOccupied: true } });
  const counts = {
    sites: await prisma.site.count(),
    agents: await prisma.agent.count(),
    sessions: await prisma.veilleSession.count(),
    visits: await prisma.siteVisit.count(),
    photos: await prisma.photo.count(),
  };

  // B. Cadences — règles métier C4 (re-vérification)
  const C = await import("../src/lib/today/constants");

  // C. SiteTeam memberships
  const memberA = await prisma.siteTeam.findMany({ where: { siteId: SITE_A } });
  const memberB = await prisma.siteTeam.findMany({ where: { siteId: SITE_B } });

  // D. TeamActivity
  const activityByType = await prisma.teamActivity.groupBy({
    by: ["type"],
    _count: true,
  });
  const activityForA = await prisma.teamActivity.count({ where: { teamId: TEAM_A } });
  const activityForB = await prisma.teamActivity.count({ where: { teamId: TEAM_B } });

  // E. Photos
  const photoLegacy = await prisma.photo.count({
    where: { storagePath: { startsWith: "/uploads/" } },
  });
  const photoPrivate = await prisma.photo.count({
    where: { storagePath: { startsWith: "private:" } },
  });

  // F. Visites récentes par site (pour valider les cadences)
  const visitsA = await prisma.siteVisit.findMany({
    where: { siteId: SITE_A, status: "completed" },
    select: { id: true, finishedAt: true, template: { select: { slug: true } } },
    orderBy: { finishedAt: "desc" },
  });
  const visitsB = await prisma.siteVisit.findMany({
    where: { siteId: SITE_B, status: "completed" },
    select: { id: true, finishedAt: true, template: { select: { slug: true } } },
    orderBy: { finishedAt: "desc" },
  });

  console.log(JSON.stringify({
    A_isOccupied: { siteA: siteA.isOccupied, siteB: siteB.isOccupied },
    A_counts: counts,
    B_cadences: {
      QUARTERLY_VISIT_DAYS: C.QUARTERLY_VISIT_DAYS,
      OCCUPIED_PLANNED_VISIT_DAYS: C.OCCUPIED_PLANNED_VISIT_DAYS,
      UNOCCUPIED_PLANNED_VISIT_DAYS: C.UNOCCUPIED_PLANNED_VISIT_DAYS,
      classify_tri: C.classifyVisitTemplateSlug("trimestrielle-recette-s3"),
      classify_plan: C.classifyVisitTemplateSlug("planifiee-recette-s3"),
      classify_other: C.classifyVisitTemplateSlug("foo-bar"),
      freq_quarterly: C.visitFrequencyDays("quarterly", true),
      freq_planned_occ: C.visitFrequencyDays("planned", true),
      freq_planned_unocc: C.visitFrequencyDays("planned", false),
    },
    C_memberships: {
      siteA: memberA.map(m => m.teamId),
      siteB: memberB.map(m => m.teamId),
    },
    D_activity: { byType: activityByType, teamA: activityForA, teamB: activityForB },
    E_photos: { legacy: photoLegacy, private: photoPrivate, total: counts.photos },
    F_visits: {
      siteA: visitsA.map(v => ({ id: v.id, daysAgo: Math.round((Date.now() - v.finishedAt!.getTime()) / 86400000), slug: v.template.slug })),
      siteB: visitsB.map(v => ({ id: v.id, daysAgo: Math.round((Date.now() - v.finishedAt!.getTime()) / 86400000), slug: v.template.slug })),
    },
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
