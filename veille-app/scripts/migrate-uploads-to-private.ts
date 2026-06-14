/**
 * Migration manuelle Sprint 3 C9 — déplace les anciennes photos legacy de
 * `public/uploads/photos/` vers `data/uploads/photos/` et bascule leur
 * `storagePath` au nouveau format `private:photos/<name>`.
 *
 * Usage :
 *   pnpm tsx scripts/migrate-uploads-to-private.ts            # dry-run
 *   pnpm tsx scripts/migrate-uploads-to-private.ts --apply    # exécute
 *
 * Sûr à rejouer : on saute les rows déjà migrées (storagePath préfixé
 * `private:`) et on accepte ENOENT côté source (fichier déjà déplacé).
 *
 * Le bypass `/uploads/` du middleware (proxy.ts) reste actif tant que la
 * migration n'a pas été effectuée. Une fois 0 photo en format legacy en
 * DB, le bypass peut être supprimé.
 */
/* eslint-disable no-console */

import { rename, mkdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { PrismaClient } from "@prisma/client";
import {
  PRIVATE_UPLOAD_DIR,
  PUBLIC_UPLOAD_DIR,
  LEGACY_STORAGE_PREFIX,
  buildPrivateStoragePath,
} from "../src/lib/photoStorage";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  console.log(`[migrate] mode = ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[migrate] source = ${PUBLIC_UPLOAD_DIR}/photos`);
  console.log(`[migrate] target = ${PRIVATE_UPLOAD_DIR}/photos`);

  const legacy = await prisma.photo.findMany({
    where: { storagePath: { startsWith: LEGACY_STORAGE_PREFIX } },
    select: { id: true, storagePath: true },
  });

  console.log(`[migrate] ${legacy.length} photo(s) au format legacy à migrer`);

  let moved = 0;
  let missing = 0;
  let alreadyDone = 0;
  let failed = 0;

  for (const p of legacy) {
    const rel = p.storagePath.slice(LEGACY_STORAGE_PREFIX.length);
    const src = join(PUBLIC_UPLOAD_DIR, rel);
    const dst = join(PRIVATE_UPLOAD_DIR, rel);
    const newStoragePath = buildPrivateStoragePath(
      rel.replace(/^photos\//, ""),
    );

    try {
      await stat(src);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        // Fichier absent côté source — la row reste legacy ; à inspecter.
        missing++;
        console.warn(`[migrate] MISS  ${p.id} src=${src}`);
        continue;
      }
      failed++;
      console.error(`[migrate] FAIL  ${p.id} ${err.code} ${src}`);
      continue;
    }

    // Cible déjà présente : on suppose qu'une exécution précédente a déjà
    // déplacé le fichier mais pas mis à jour la DB.
    let targetExists = false;
    try {
      await stat(dst);
      targetExists = true;
    } catch {
      /* attendu */
    }

    if (APPLY) {
      try {
        if (!targetExists) {
          await mkdir(dirname(dst), { recursive: true });
          await rename(src, dst);
        }
        await prisma.photo.update({
          where: { id: p.id },
          data: { storagePath: newStoragePath },
        });
        moved++;
        console.log(`[migrate] OK    ${p.id} ${p.storagePath} → ${newStoragePath}`);
      } catch (e: unknown) {
        failed++;
        console.error(`[migrate] FAIL  ${p.id}`, e);
      }
    } else {
      if (targetExists) alreadyDone++;
      else moved++;
      console.log(
        `[migrate] PLAN  ${p.id} ${src} → ${dst} (storage ${p.storagePath} → ${newStoragePath})`,
      );
    }
  }

  console.log("[migrate] résumé :", {
    moved,
    alreadyDone,
    missing,
    failed,
    apply: APPLY,
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
