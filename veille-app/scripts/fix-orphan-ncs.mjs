#!/usr/bin/env node
/**
 * Script de migration ponctuelle (C16) — marque `redressedDate` sur les
 * `SiteVisitNonConformity` dont l'`ImportedAction` liée est déjà
 * `VALIDATED_LOCAL` mais sans redressement enregistré.
 *
 * Origine du besoin : avant C14, la validation d'une action ne touchait
 * pas la NC liée. Les NC créées et validées AVANT le déploiement de C14
 * restent donc à `redressedDate=null` et apparaissent encore au dashboard
 * alors qu'elles sont en réalité résolues.
 *
 * Usage :
 *   node scripts/fix-orphan-ncs.mjs            # dry-run (défaut) : compte et liste
 *   APPLY=1 node scripts/fix-orphan-ncs.mjs    # applique réellement les updates
 *
 * Stratégie de date :
 *  - On utilise `ActionValidation.realizedAt` la plus récente pour
 *    cette action (cf. cascade des doublons).
 *  - Si aucune ActionValidation trouvée (cas pathologique : action
 *    VALIDATED_LOCAL sans row de validation), fallback sur la valeur
 *    actuelle d'`ImportedAction.updatedAt` puis `now()`.
 *
 * Idempotent : un second run sur une base déjà nettoyée renvoie 0
 * (le filtre `redressedDate: null` exclut les rows déjà migrées).
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const APPLY = process.env.APPLY === "1" || process.env.APPLY === "true";
const URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const adapter = new PrismaBetterSqlite3({ url: URL });
const prisma = new PrismaClient({ adapter });

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  console.log(
    `\n${APPLY ? "🚧 APPLY MODE" : "👀 DRY-RUN"} — DATABASE_URL=${URL}\n`,
  );

  // Toutes les NC ouvertes dont l'action est déjà validée.
  const orphans = await prisma.siteVisitNonConformity.findMany({
    where: {
      redressedDate: null,
      generatedActionId: { not: null },
      generatedAction: { localStatus: "VALIDATED_LOCAL" },
    },
    select: {
      id: true,
      description: true,
      generatedActionId: true,
      generatedAction: {
        select: {
          realizedAt: true,
          updatedAt: true,
          validations: {
            orderBy: { realizedAt: "desc" },
            select: { realizedAt: true },
            take: 1,
          },
        },
      },
      visit: {
        select: { site: { select: { name: true } } },
      },
    },
  });

  console.log(`Trouvé ${orphans.length} NC fantôme(s) à redresser.\n`);

  if (orphans.length === 0) {
    await prisma.$disconnect();
    return;
  }

  // Aperçu (jusqu'à 20 lignes).
  console.log("Aperçu (max 20) :");
  for (const nc of orphans.slice(0, 20)) {
    const v = nc.generatedAction?.validations[0]?.realizedAt;
    const fallback =
      v ?? nc.generatedAction?.realizedAt ?? nc.generatedAction?.updatedAt;
    console.log(
      `  - ${nc.visit?.site?.name ?? "?"} | ${nc.description.slice(0, 70)} | redress→ ${fmt(fallback)}`,
    );
  }
  if (orphans.length > 20) {
    console.log(`  … et ${orphans.length - 20} autre(s).`);
  }

  if (!APPLY) {
    console.log(
      "\nMode dry-run : aucun update effectué. Relance avec APPLY=1 pour appliquer.\n",
    );
    await prisma.$disconnect();
    return;
  }

  // Apply : update par row, avec la meilleure date trouvée.
  let updated = 0;
  for (const nc of orphans) {
    const candidate =
      nc.generatedAction?.validations[0]?.realizedAt ??
      nc.generatedAction?.realizedAt ??
      nc.generatedAction?.updatedAt ??
      new Date();
    await prisma.siteVisitNonConformity.update({
      where: { id: nc.id },
      data: { redressedDate: candidate },
    });
    updated++;
  }
  console.log(`\n✅ ${updated} NC mises à jour.\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
