/**
 * Synchronisation idempotente des modèles de visite (`SiteVisitTemplate`).
 *
 * Extrait du seed pour être réutilisable seul en déploiement : les templates
 * de visite sont des DONNÉES (pas du schéma), donc `prisma migrate deploy`
 * ne les crée pas. Sans ce sync, une migration qui ajoute un nouveau type de
 * visite (ex. S6A7) laisse la prod sans le modèle correspondant — invisible
 * dans l'assistant « Nouvelle visite ».
 *
 * Idempotent :
 *  - CHECKLIST déjà présent avec ses sections → on ne réécrase pas (préserve
 *    les éditions admin).
 *  - Templates pilotés par catalogue (INVENTORY, S6A7 ; sans sections) → on
 *    met à jour les scalaires (kind, cadence, description, layout).
 *  - Absent → création (+ sections/items pour les CHECKLIST).
 */
import { prisma } from "../src/lib/prisma";
import { SEED_VISIT_TEMPLATES } from "./seed-visit-templates";

export async function syncVisitTemplates(): Promise<void> {
  for (const t of SEED_VISIT_TEMPLATES) {
    const existing = await prisma.siteVisitTemplate.findUnique({
      where: { slug: t.slug },
      include: { sections: { include: { items: true } } },
    });
    const isCatalogDriven = t.kind === "INVENTORY" || t.kind === "S6A7";
    if (existing && !isCatalogDriven && existing.sections.length > 0) {
      console.log(
        `Template ${t.slug} déjà présent (${existing.sections.length} sections) — on ne réécrase pas.`,
      );
      continue;
    }
    const tpl = existing
      ? await prisma.siteVisitTemplate.update({
          where: { slug: t.slug },
          data: {
            name: t.name,
            description: t.description,
            pdfLayout: t.pdfLayout,
            kind: t.kind ?? "CHECKLIST",
            expectedFrequencyDays: t.expectedFrequencyDays ?? null,
          },
        })
      : await prisma.siteVisitTemplate.create({
          data: {
            slug: t.slug,
            name: t.name,
            description: t.description,
            pdfLayout: t.pdfLayout,
            kind: t.kind ?? "CHECKLIST",
            expectedFrequencyDays: t.expectedFrequencyDays ?? null,
          },
        });
    for (let i = 0; i < t.sections.length; i++) {
      const s = t.sections[i];
      const section = await prisma.siteVisitSection.create({
        data: {
          templateId: tpl.id,
          title: s.title,
          icon: s.icon,
          evalMode: s.evalMode,
          category: s.category,
          sortOrder: i,
        },
      });
      await prisma.siteVisitItem.createMany({
        data: s.items.map((label, j) => ({
          sectionId: section.id,
          label,
          sortOrder: j,
        })),
      });
    }
    console.log(
      existing
        ? `Template ${t.slug} synchronisé.`
        : `Template ${t.slug} créé (${t.sections.length} sections).`,
    );
  }
}
