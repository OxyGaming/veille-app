/**
 * Seed standalone pour le template de tournée véhicule (TT VS).
 *
 * Exécution : `npx tsx prisma/seed-vehicle-rounds-standalone.ts`
 *
 * N'effectue QUE la création du template "tournee-vs" (idempotent : ne
 * réécrit pas si déjà présent). Ne touche à aucun autre seed (procédures,
 * visite, équipes…) pour éviter les conflits sur les seeds historiques.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { SEED_VEHICLE_ROUND_TEMPLATES } from "./seed-vehicle-round-template";

async function main() {
  for (const t of SEED_VEHICLE_ROUND_TEMPLATES) {
    const existing = await prisma.vehicleRoundTemplate.findUnique({
      where: { slug: t.slug },
      include: { sections: { include: { items: true } } },
    });
    if (existing && existing.sections.length > 0) {
      console.log(
        `Template VS ${t.slug} déjà présent (${existing.sections.length} sections, ${existing.sections.reduce((n, s) => n + s.items.length, 0)} items) — on ne réécrase pas.`
      );
      continue;
    }
    const tpl = existing
      ? await prisma.vehicleRoundTemplate.update({
          where: { slug: t.slug },
          data: {
            name: t.name,
            description: t.description,
            expectedFrequencyDays: t.expectedFrequencyDays,
          },
        })
      : await prisma.vehicleRoundTemplate.create({
          data: {
            slug: t.slug,
            name: t.name,
            description: t.description,
            expectedFrequencyDays: t.expectedFrequencyDays,
          },
        });
    for (let i = 0; i < t.sections.length; i++) {
      const s = t.sections[i];
      const section = await prisma.vehicleRoundSection.create({
        data: {
          templateId: tpl.id,
          title: s.title,
          icon: s.icon ?? null,
          sortOrder: i,
        },
      });
      await prisma.vehicleRoundItem.createMany({
        data: s.items.map((it, j) => ({
          sectionId: section.id,
          label: it.label,
          applicableTypes: JSON.stringify(it.applicableTypes),
          responseFormat: it.responseFormat,
          sortOrder: j,
        })),
      });
    }
    console.log(
      `Template VS ${t.slug} créé (${t.sections.length} sections, ${t.sections.reduce((n, s) => n + s.items.length, 0)} items).`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
