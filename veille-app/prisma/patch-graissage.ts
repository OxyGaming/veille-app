/**
 * Patch idempotent du template "planifiee-eic-ra" :
 *  - met à jour le champ `precisions` sur les sections déjà connues,
 *  - ajoute les 4 sections "Graissage" si absentes.
 *
 * Lancement : npx tsx prisma/patch-graissage.ts
 */
import { prisma } from "../src/lib/prisma";
import { SEED_VISIT_TEMPLATES } from "./seed-visit-templates";

async function main() {
  const tpl = await prisma.siteVisitTemplate.findUnique({
    where: { slug: "planifiee-eic-ra" },
    include: { sections: { include: { items: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!tpl) {
    console.log("Template introuvable — exécutez d'abord `npm run seed`.");
    return;
  }
  const seedTpl = SEED_VISIT_TEMPLATES.find((t) => t.slug === "planifiee-eic-ra");
  if (!seedTpl) {
    console.log("Seed source absente.");
    return;
  }
  const existingByTitle = new Map(tpl.sections.map((s) => [s.title, s]));
  let updated = 0;
  let created = 0;
  for (let i = 0; i < seedTpl.sections.length; i++) {
    const s = seedTpl.sections[i];
    const exist = existingByTitle.get(s.title);
    if (exist) {
      // Met à jour precisions, category, sortOrder ; ne touche pas aux items
      // pour ne pas casser les observations rattachées.
      const needs =
        exist.precisions !== (s.precisions ?? null) ||
        exist.category !== (s.category ?? null) ||
        exist.sortOrder !== i;
      if (needs) {
        await prisma.siteVisitSection.update({
          where: { id: exist.id },
          data: {
            precisions: s.precisions ?? null,
            category: s.category ?? null,
            sortOrder: i,
          },
        });
        updated++;
      }
    } else {
      // Section absente → on la crée + items.
      const created_ = await prisma.siteVisitSection.create({
        data: {
          templateId: tpl.id,
          title: s.title,
          icon: s.icon,
          evalMode: s.evalMode,
          category: s.category,
          precisions: s.precisions,
          sortOrder: i,
        },
      });
      await prisma.siteVisitItem.createMany({
        data: s.items.map((label, j) => ({
          sectionId: created_.id,
          label,
          sortOrder: j,
        })),
      });
      created++;
    }
  }
  console.log(
    `Patch appliqué : ${updated} section(s) mise(s) à jour, ${created} section(s) créée(s).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
