/* eslint-disable no-console */
/**
 * Cleanup des fixtures de la recette Sprint 3 C10.
 * Idempotent : ne fait rien si les rows n'existent plus.
 *
 * Supprime :
 *   - rows TeamActivity créées pour la recette ;
 *   - photos + sighting hôte de la photo legacy ;
 *   - visites RECETTE-S3 ;
 *   - templates RECETTE-S3 ;
 *   - équipements RECETTE-S3 ;
 *   - actions RECETTE-S3 ;
 *   - sightings agents RECETTE-S3 ;
 *   - Site B + ses memberships ;
 *   - Team B ;
 *   - users recette + leurs memberships.
 *
 * Ne touche PAS aux comptes admin existants ni à Team A / Site A
 * (Site A est juste remis à isOccupied=true par sécurité).
 */
import { unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { PUBLIC_UPLOAD_DIR } from "../src/lib/photoStorage";

const PREFIX = "RECETTE-S3-";

async function main() {
  const teamB = await prisma.team.findFirst({ where: { name: { startsWith: PREFIX } } });
  const editor = await prisma.user.findUnique({ where: { email: "recette-editor-s3@veille.local" } });
  const userB = await prisma.user.findUnique({ where: { email: "recette-user-b-s3@veille.local" } });
  const siteB = await prisma.site.findFirst({ where: { code: "RECETTE-S3-INOCC" } });
  const legacyPhoto = await prisma.photo.findFirst({ where: { legend: `${PREFIX}legacy` } });
  const legacySighting = legacyPhoto ? await prisma.siteSighting.findUnique({ where: { id: legacyPhoto.siteSightingId! } }) : null;
  const tplTri = await prisma.siteVisitTemplate.findUnique({ where: { slug: "trimestrielle-recette-s3" } });
  const tplPlan = await prisma.siteVisitTemplate.findUnique({ where: { slug: "planifiee-recette-s3" } });

  let removed = { teamActivity: 0, photos: 0, siteSightings: 0, agentSightings: 0, equipments: 0, actions: 0, visits: 0, templates: 0, siteTeams: 0, siteB: 0, teamB: 0, userTeams: 0, users: 0 };

  // TeamActivity recette + dédup test
  const ta = await prisma.teamActivity.deleteMany({
    where: {
      OR: [
        { message: { contains: "RECETTE-S3" } },
        { message: { contains: "Dedup test" } },
        { message: { contains: "Franz David" } },
        { actorName: "recette-editor-s3" },
      ],
    },
  });
  removed.teamActivity = ta.count;

  // Photo legacy + fichier disque
  if (legacyPhoto) {
    if (legacyPhoto.storagePath.startsWith("/uploads/")) {
      const rel = legacyPhoto.storagePath.slice("/uploads/".length);
      await unlink(join(PUBLIC_UPLOAD_DIR, rel)).catch(() => null);
    }
    await prisma.photo.delete({ where: { id: legacyPhoto.id } });
    removed.photos = 1;
  }
  if (legacySighting) {
    await prisma.siteSighting.delete({ where: { id: legacySighting.id } });
    removed.siteSightings = 1;
  }

  // Sightings agents + actions créés par l'Editor pendant la recette
  const sights = await prisma.agentSighting.deleteMany({
    where: { observerId: editor?.id, comment: { contains: "RECETTE-S3" } },
  });
  removed.agentSightings = sights.count;
  const acts = await prisma.importedAction.deleteMany({
    where: { title: { contains: "RECETTE-S3" } },
  });
  removed.actions = acts.count;

  // Équipements RECETTE-S3
  const eqs = await prisma.siteEquipment.deleteMany({
    where: { label: { contains: "RECETTE-S3" } },
  });
  removed.equipments = eqs.count;

  // Visites recette
  if (tplTri || tplPlan) {
    const visits = await prisma.siteVisit.deleteMany({
      where: { generalComment: { startsWith: PREFIX } },
    });
    removed.visits = visits.count;
  }
  if (tplTri) {
    await prisma.siteVisitTemplate.delete({ where: { id: tplTri.id } }).catch(() => null);
    removed.templates++;
  }
  if (tplPlan) {
    await prisma.siteVisitTemplate.delete({ where: { id: tplPlan.id } }).catch(() => null);
    removed.templates++;
  }

  // Site B + memberships
  if (siteB) {
    const m = await prisma.siteTeam.deleteMany({ where: { siteId: siteB.id } });
    removed.siteTeams = m.count;
    await prisma.site.delete({ where: { id: siteB.id } }).catch(() => null);
    removed.siteB = 1;
  }

  // Users recette + memberships
  for (const u of [editor, userB].filter(Boolean)) {
    if (!u) continue;
    const m = await prisma.userTeam.deleteMany({ where: { userId: u.id } });
    removed.userTeams += m.count;
    await prisma.user.delete({ where: { id: u.id } }).catch(() => null);
    removed.users++;
  }

  // Team B
  if (teamB) {
    await prisma.team.delete({ where: { id: teamB.id } }).catch(() => null);
    removed.teamB = 1;
  }

  console.log(JSON.stringify(removed, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
