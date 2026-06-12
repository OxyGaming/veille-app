/**
 * Patch idempotent : ajoute ou met à jour le template « Veille de site »
 * (mode INVENTORY). Ne touche pas aux autres templates ni à leurs sections.
 *
 * Usage :
 *   npx tsx prisma/patch-veille-site.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { TEMPLATE_VEILLE_SITE } from "./seed-visit-templates";

async function main() {
  const t = TEMPLATE_VEILLE_SITE;
  const existing = await prisma.siteVisitTemplate.findUnique({
    where: { slug: t.slug },
    select: { id: true, kind: true, expectedFrequencyDays: true },
  });
  if (existing) {
    const updated = await prisma.siteVisitTemplate.update({
      where: { slug: t.slug },
      data: {
        name: t.name,
        description: t.description,
        pdfLayout: t.pdfLayout,
        kind: t.kind ?? "INVENTORY",
        expectedFrequencyDays: t.expectedFrequencyDays ?? null,
      },
      select: { id: true, kind: true, expectedFrequencyDays: true },
    });
    console.log(
      `✓ Template ${t.slug} mis à jour : kind=${updated.kind}, freq=${updated.expectedFrequencyDays}`
    );
  } else {
    const created = await prisma.siteVisitTemplate.create({
      data: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        pdfLayout: t.pdfLayout,
        kind: t.kind ?? "INVENTORY",
        expectedFrequencyDays: t.expectedFrequencyDays ?? null,
      },
      select: { id: true, kind: true, expectedFrequencyDays: true },
    });
    console.log(
      `✓ Template ${t.slug} créé : kind=${created.kind}, freq=${created.expectedFrequencyDays}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
