/**
 * Seed initial — équipe par défaut, utilisateur admin, procédures issues
 * du HTML de référence (Veille_procedures_AC.html), catégories de liens.
 *
 * Idempotent : tout est en `upsert`.
 */
// Charge .env explicitement — utile en exécution standalone via `tsx`
// (sans cette ligne, `process.env.DATABASE_URL` est undefined et l'adapter
// Prisma tombe sur le fallback `file:./dev.db`, qui ne correspond pas au
// fichier créé par `prisma db push`).
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { SEED_PROCEDURES } from "./seed-procedures";
import { SEED_VISIT_TEMPLATES } from "./seed-visit-templates";
import { SEED_VEHICLE_ROUND_TEMPLATES } from "./seed-vehicle-round-template";

async function main() {
  const team = await prisma.team.upsert({
    where: { name: "EIC RHONE ALPES" },
    update: {},
    create: { name: "EIC RHONE ALPES", code: "EIC-RA" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@veille.local" },
    update: {},
    create: {
      email: "admin@veille.local",
      name: "Administrateur",
      password: hashPassword("admin"),
      role: "ADMIN",
      teamId: team.id,
    },
  });
  console.log(`Admin : ${admin.email} (mot de passe: admin) — équipe ${team.name}`);

  const procCount = await prisma.procedure.count();
  if (procCount === 0) {
    let sortOrder = 0;
    for (const seed of SEED_PROCEDURES) {
      const proc = await prisma.procedure.create({
        data: {
          domain: seed.domain,
          theme: seed.theme || null,
          title: seed.title,
          gravity: seed.gravity,
          documents: JSON.stringify(seed.documents),
          risk: seed.risk || null,
          sortOrder: sortOrder++,
        },
      });
      for (let i = 0; i < seed.items.length; i++) {
        const it = seed.items[i];
        await prisma.checklistItem.create({
          data: {
            procedureId: proc.id,
            label: it.label,
            gravity: it.gravity ?? null,
            historicConformPct: it.histPct ?? null,
            historicSampleSize: it.histN ?? null,
            sortOrder: i,
            // Par défaut : commentaire obligatoire si KO sur les G3/G4.
            requireCommentIfKO: (it.gravity ?? seed.gravity) >= 3,
          },
        });
      }
    }
    console.log(`Procédures importées : ${SEED_PROCEDURES.length}`);
  } else {
    console.log(`Procédures déjà présentes (${procCount}) — on ne réécrase pas.`);
  }

  // Catégories de liens utiles par défaut.
  const cats = [
    { name: "Référentiels", icon: "book", color: "#2E5496", sortOrder: 1 },
    { name: "Outils internes", icon: "wrench", color: "#1E8A4C", sortOrder: 2 },
    { name: "Sécurité", icon: "shield", color: "#C0152F", sortOrder: 3 },
  ];
  for (const c of cats) {
    await prisma.linkCategory.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

  // Templates de visite (idempotent : upsert par slug, on (re)crée les sections
  // seulement si pas déjà présentes).
  for (const t of SEED_VISIT_TEMPLATES) {
    const existing = await prisma.siteVisitTemplate.findUnique({
      where: { slug: t.slug },
      include: { sections: { include: { items: true } } },
    });
    // Pour les templates CHECKLIST déjà présents avec leurs sections, on ne
    // touche pas au contenu (préserve les éditions admin). Pour les templates
    // INVENTORY (toujours sans sections), on autorise la mise à jour des
    // scalaires : kind, expectedFrequencyDays, description peuvent évoluer
    // entre versions.
    const isInventory = t.kind === "INVENTORY";
    if (existing && !isInventory && existing.sections.length > 0) {
      console.log(`Template ${t.slug} déjà présent (${existing.sections.length} sections) — on ne réécrase pas.`);
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
    console.log(`Template ${t.slug} créé (${t.sections.length} sections).`);
  }

  // Templates de tournée véhicule (idempotent : upsert par slug, on (re)crée
  // les sections seulement si pas déjà présentes — préserve les éditions admin).
  for (const t of SEED_VEHICLE_ROUND_TEMPLATES) {
    const existing = await prisma.vehicleRoundTemplate.findUnique({
      where: { slug: t.slug },
      include: { sections: { include: { items: true } } },
    });
    if (existing && existing.sections.length > 0) {
      console.log(
        `Template VS ${t.slug} déjà présent (${existing.sections.length} sections) — on ne réécrase pas.`
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

  console.log("Seed terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
