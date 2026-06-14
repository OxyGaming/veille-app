/* eslint-disable no-console */
/**
 * Fixtures Sprint 3 C10 — recette finale.
 *
 * Idempotent : peut être rejoué. Affichage des IDs en sortie pour usage
 * dans les tests preview/curl. Toutes les entités créées portent un
 * `code`/email/name préfixé `RECETTE-S3-` pour faciliter le cleanup.
 *
 * Crée :
 *   - Team B "Rive Gauche Sud" (nouvelle)
 *   - Site B "Recette Inoccupé" (isOccupied=false, rattaché à Team B)
 *   - User EDITOR multi-team (membre de Team A + Team B)
 *   - User USER simple sur Team B (pour test cloisonnement)
 *   - 1 visite sur Site A faite il y a 80j (trimestrielle OK, planifiée 180j OK)
 *   - 1 visite sur Site A faite il y a 100j (trimestrielle KO, planifiée 180j OK)
 *   - 1 visite sur Site B faite il y a 200j (trimestrielle KO, planifiée 365j OK)
 *   - 1 photo legacy fake dans public/uploads/photos/ + row Photo `/uploads/...`
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { PUBLIC_UPLOAD_DIR } from "../src/lib/photoStorage";

const PREFIX = "RECETTE-S3-";

async function upsertTeam(name: string) {
  const existing = await prisma.team.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.team.create({ data: { name } });
}

async function upsertUser(
  email: string,
  role: "USER" | "EDITOR" | "ADMIN",
  primaryTeamId: string,
  membershipTeamIds: string[],
) {
  const found = await prisma.user.findUnique({ where: { email } });
  if (found) {
    await prisma.user.update({
      where: { id: found.id },
      data: { role, teamId: primaryTeamId },
    });
    // S'assure des memberships demandés (idempotent).
    for (const teamId of membershipTeamIds) {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: found.id, teamId } },
        create: { userId: found.id, teamId },
        update: {},
      });
    }
    return found;
  }
  const created = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      password: hashPassword("recette"),
      role,
      teamId: primaryTeamId,
      memberships: { create: membershipTeamIds.map((teamId) => ({ teamId })) },
    },
  });
  return created;
}

async function ensureSite(name: string, code: string, teamId: string, isOccupied: boolean) {
  const found = await prisma.site.findFirst({ where: { code } });
  if (found) {
    await prisma.site.update({
      where: { id: found.id },
      data: { isOccupied, teamId },
    });
    await prisma.siteTeam.upsert({
      where: { siteId_teamId: { siteId: found.id, teamId } },
      create: { siteId: found.id, teamId },
      update: {},
    });
    return found;
  }
  return prisma.site.create({
    data: {
      name,
      code,
      isOccupied,
      teamId,
      type: "Poste",
      memberships: { create: [{ teamId }] },
    },
  });
}

async function ensureVisitTemplates() {
  // Convention slug C4 Sprint 3 :
  //  - "trimestrielle-*" → quarterly (90j)
  //  - "planifiee-*"     → planned (180j occupé / 365j inoccupé)
  const tri = await prisma.siteVisitTemplate.upsert({
    where: { slug: "trimestrielle-recette-s3" },
    create: {
      slug: "trimestrielle-recette-s3",
      name: `${PREFIX}Visite trimestrielle`,
      isActive: true,
    },
    update: {},
  });
  const plan = await prisma.siteVisitTemplate.upsert({
    where: { slug: "planifiee-recette-s3" },
    create: {
      slug: "planifiee-recette-s3",
      name: `${PREFIX}Visite planifiée`,
      isActive: true,
    },
    update: {},
  });
  return { tri, plan };
}

async function ensureVisit(
  siteId: string,
  templateId: string,
  teamId: string,
  userId: string,
  daysAgo: number,
) {
  // Marqueur idempotent : on stocke le daysAgo dans `summary` pour pouvoir
  // retrouver/écraser.
  const tag = `${PREFIX}visit:${siteId}:${templateId}:${daysAgo}d`;
  const found = await prisma.siteVisit.findFirst({
    where: { generalComment: tag },
  });
  const finishedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  if (found) {
    await prisma.siteVisit.update({
      where: { id: found.id },
      data: { visitDate: finishedAt, finishedAt, status: "completed" },
    });
    return found;
  }
  return prisma.siteVisit.create({
    data: {
      siteId,
      templateId,
      teamId,
      observerId: userId,
      generalComment: tag,
      visitDate: finishedAt,
      finishedAt,
      status: "completed",
    },
  });
}

async function ensureLegacyPhotoOnSightingA(teamId: string, userId: string) {
  // 1. Sighting site rattaché à Team A pour porter la photo.
  const site = await prisma.site.findFirst({
    where: { code: "POS-GIVORS" },
  });
  if (!site) throw new Error("Site POS-GIVORS introuvable");
  const tag = `${PREFIX}legacy-photo-host`;
  let sighting = await prisma.siteSighting.findFirst({
    where: { comment: tag },
  });
  if (!sighting) {
    sighting = await prisma.siteSighting.create({
      data: {
        siteId: site.id,
        teamId,
        observerId: userId,
        kind: "NOTE",
        comment: tag,
      },
    });
  }

  // 2. Fichier "legacy" sur disque public/uploads/photos/
  const legacyName = "recette-s3-legacy.jpg";
  const dir = join(PUBLIC_UPLOAD_DIR, "photos");
  await mkdir(dir, { recursive: true });
  // PNG 1x1 transparent stocké en .jpg pour rester cohérent avec l'app.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await writeFile(join(dir, legacyName), png);

  // 3. Row Photo en format legacy /uploads/photos/...
  let photo = await prisma.photo.findFirst({
    where: { legend: `${PREFIX}legacy` },
  });
  if (!photo) {
    photo = await prisma.photo.create({
      data: {
        siteSightingId: sighting.id,
        uploaderId: userId,
        storagePath: `/uploads/photos/${legacyName}`,
        legend: `${PREFIX}legacy`,
        byteSize: png.byteLength,
        syncStatus: "SYNCED",
      },
    });
  } else {
    photo = await prisma.photo.update({
      where: { id: photo.id },
      data: {
        siteSightingId: sighting.id,
        storagePath: `/uploads/photos/${legacyName}`,
      },
    });
  }
  return { sightingId: sighting.id, photoId: photo.id, legacyPath: photo.storagePath };
}

async function main() {
  const teamA = await prisma.team.findFirstOrThrow({ where: { name: "Rive Droite Nord" } });
  const teamB = await upsertTeam(`${PREFIX}Rive Gauche Sud`);

  const editor = await upsertUser(
    "recette-editor-s3@veille.local",
    "EDITOR",
    teamA.id,
    [teamA.id, teamB.id],
  );
  const userB = await upsertUser(
    "recette-user-b-s3@veille.local",
    "USER",
    teamB.id,
    [teamB.id],
  );

  const siteA = await prisma.site.findFirstOrThrow({ where: { code: "POS-GIVORS" } });
  // Force siteA isOccupied = true pour repartir propre.
  await prisma.site.update({ where: { id: siteA.id }, data: { isOccupied: true } });

  const siteB = await ensureSite(
    `${PREFIX}Site Inoccupé`,
    "RECETTE-S3-INOCC",
    teamB.id,
    false,
  );

  const { tri, plan } = await ensureVisitTemplates();

  // Visites avec dates contrôlées pour tester les cadences.
  const v80 = await ensureVisit(siteA.id, tri.id, teamA.id, editor.id, 80);   // trimestrielle OK
  const v100 = await ensureVisit(siteA.id, tri.id, teamA.id, editor.id, 100); // jamais utilisé → garde 80
  const v200 = await ensureVisit(siteB.id, plan.id, teamB.id, editor.id, 200); // planifiée inoccupée OK (<365)

  const legacy = await ensureLegacyPhotoOnSightingA(teamA.id, editor.id);

  console.log(JSON.stringify({
    teamA: teamA.id,
    teamB: teamB.id,
    editor: { id: editor.id, email: editor.email },
    userB: { id: userB.id, email: userB.email },
    siteA: siteA.id,
    siteB: siteB.id,
    templates: { tri: tri.id, plan: plan.id },
    visits: { v80: v80.id, v100: v100.id, v200: v200.id },
    legacy,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
