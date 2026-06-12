/**
 * Patch idempotent — DC01510 v3 du 07-04-2023
 * "Service de la circulation (Organisation et méthode)".
 *
 * Le DC01510 est le document parent de DC01506 (qui le décline pour les
 * gares temporaires DV BA). Il fixe les principes généraux du service
 * de la circulation, les catégories de gares, les secteurs-circulation,
 * la connaissance de la circulation, et l'assurance de voie libre.
 *
 *   Enrichissement de 4 procédures (+11 items) :
 *     - Gares temporaires / Gares perm. autorisées à s'absenter (+3 —
 *       § 9.2, 9.4, 8.5)
 *     - Suivi de la circulation en DV (+4 — § 15, 17, 19)
 *     - Transmission ou cessation du service (+3 — § 6, 13, 16)
 *     - Manoeuvre des installations (+1 — § 8.5 reprise commande locale)
 *
 *   Aucun doublon flagrant, pas de nouvelle procédure créée.
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc01510.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

type NewItem = {
  label: string;
  gravity?: number;
  helpReference: string;
  helpText: string;
};

const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // Gares temporaires / Gares perm. autorisées à s'absenter (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Gares temporaires / Gares permanentes autorisées à s'absenter": [
    {
      label:
        "Désignation des gares temporaires : lignes à période de fermeture vs autres lignes",
      helpReference: "DC01510 § 9.2",
      helpText:
        "Sur les lignes à période de fermeture à la circulation (§ 9.2.1), les gares temporaires sont désignées dans le cadre de l'organisation du service. Sur les autres lignes (§ 9.2.2), les gares peuvent être désignées temporaires selon les besoins (chantier, période creuse, etc.).",
    },
    {
      label:
        "Fonctionnement des installations en période de fermeture",
      helpReference: "DC01510 § 9.4",
      helpText:
        "Pendant la période de fermeture, les installations (signaux, AdV, IS) peuvent rester actives selon la configuration. La consigne locale précise ce qui est maintenu et ce qui est mis en sommeil. Vérification à la reprise.",
    },
    {
      label:
        "Reprise en « commande locale » d'une gare télécommandée",
      helpReference: "DC01510 § 8.5",
      helpText:
        "Une gare télécommandée peut être reprise en commande locale (par un agent sur place) en cas de besoin (dérangement télécommande, intervention spécifique). La reprise nécessite : avis au poste télécommandant, présence physique de l'AC, application des consignes locales.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Suivi de la circulation en DV (+4)
  // ───────────────────────────────────────────────────────────────────────
  "Suivi de la circulation en DV": [
    {
      label:
        "Connaissance du dernier train expédié et du dernier train reçu",
      helpReference: "DC01510 § 19.2 et § 19.3",
      helpText:
        "L'AC doit en permanence connaître : le dernier train expédié vers la gare aval (et confirmé arrivé), le dernier train reçu de la gare amont. Ces informations conditionnent l'expédition des trains suivants et les procédures d'assurance voie libre.",
    },
    {
      label: "Connaissance du premier train attendu",
      helpReference: "DC01510 § 19.4",
      helpText:
        "L'AC connaît également le premier train attendu (arrivée prochaine) pour anticiper : préparation itinéraire de réception, vérification voie libre, communication avec les gares encadrantes. Information issue de l'ONJ ou de l'état circulation.",
    },
    {
      label:
        "État circulation informatisé vs imprimé — exigences",
      helpReference: "DC01510 § 15",
      helpText:
        "L'état circulation peut être informatisé (système intégré, mises à jour automatiques) ou sous forme d'imprimé (saisie manuelle). Dans les deux cas : tenue rigoureuse, traçabilité, sauvegarde en cas de défaillance système. Particularités selon le type de gare.",
    },
    {
      label:
        "Dispense de prise en attachement : conditions techniques + dérangement contrôle libération intervalle",
      helpReference: "DC01510 § 17",
      helpText:
        "La dispense de prise en attachement (heures arrivée/départ/passage) est conditionnée par : contexte organisationnel (§ 17.2), conditions techniques réunies (§ 17.3 — dispositifs auto). En cas de dérangement du contrôle de libération de l'intervalle (§ 17.7), la dispense est levée et l'attachement redevient obligatoire.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Transmission ou cessation du service (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Transmission ou cessation du service": [
    {
      label:
        "Secteurs-circulation : autorité, limites, agent en charge",
      helpReference: "DC01510 § 6",
      helpText:
        "Une gare est découpée en un ou plusieurs secteurs-circulation. Chaque secteur a son périmètre défini (§ 6.3), son autorité exercée (§ 6.4 — AC, dirigeant), et son agent en charge des prescriptions (§ 6.5). La transmission de service précise quel secteur est concerné.",
    },
    {
      label:
        "Catégories de gares : 1ère cat A, 1ère cat B, 2ème cat",
      helpReference: "DC01510 § 16",
      helpText:
        "Les gares sont classées selon leur importance opérationnelle : 1ère cat A (gares principales, § 16.2), 1ère cat B (importance intermédiaire, § 16.3), 2ème cat (gares moindres, § 16.4). La catégorie conditionne les procédures applicables, notamment pour la connaissance des trains et les avis.",
    },
    {
      label:
        "Ordre Normal Journalier (ONJ) et succession des trains",
      helpReference: "DC01510 § 13",
      helpText:
        "L'ONJ fixe l'ordre normal de circulation des trains sur la journée. Il est consulté à la prise de service et permet d'anticiper les passages. Toute modification de l'ordre (avance, retard, suppression) donne lieu à un avis et à une mise à jour de l'état de circulation.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Manoeuvre des installations (+1)
  // ───────────────────────────────────────────────────────────────────────
  "Manoeuvre des installations": [
    {
      label:
        "Gares télécommandées : autorité exercée et reprise en commande locale",
      helpReference: "DC01510 § 8.3 et § 8.5",
      helpText:
        "Sur une gare télécommandée, l'autorité est exercée à distance par le poste télécommandant. En cas de besoin (dérangement, intervention locale), une reprise en commande locale est possible (§ 8.5) : présence physique d'un AC sur place, avis au poste télécommandant, application des consignes locales.",
    },
  ],
};

async function main() {
  console.log(
    `\n=== Patch DC01510 v3 du 07-04-2023 (Service de la circulation) ===\n`
  );

  let totalAdded = 0;
  let totalHelpOnly = 0;
  let totalSkipped = 0;

  for (const [title, items] of Object.entries(ENRICHMENTS)) {
    const proc = await prisma.procedure.findFirst({
      where: { title, isActive: true },
      select: { id: true, gravity: true, title: true },
    });
    if (!proc) {
      console.log(`\n  [skip procedure] "${title}" — introuvable`);
      continue;
    }
    const last = await prisma.checklistItem.findFirst({
      where: { procedureId: proc.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let order = last ? last.sortOrder + 1 : 0;
    console.log(`\n  ▸ "${proc.title}"`);
    for (const it of items) {
      const existing = await prisma.checklistItem.findFirst({
        where: { procedureId: proc.id, label: it.label },
        select: { id: true, helpReference: true },
      });
      if (existing) {
        if (!existing.helpReference) {
          await prisma.checklistItem.update({
            where: { id: existing.id },
            data: { helpReference: it.helpReference, helpText: it.helpText },
          });
          totalHelpOnly++;
          console.log(`    [help-only] ${it.label.slice(0, 55)}…`);
        } else {
          totalSkipped++;
          console.log(`    [skip] ${it.label.slice(0, 55)}…`);
        }
        continue;
      }
      await prisma.checklistItem.create({
        data: {
          procedureId: proc.id,
          label: it.label,
          gravity: it.gravity ?? proc.gravity,
          sortOrder: order++,
          helpReference: it.helpReference,
          helpText: it.helpText,
          isActive: true,
        },
      });
      totalAdded++;
      console.log(`    [add] ${it.label.slice(0, 55)}…`);
    }
  }

  console.log(
    `\n=== Terminé : ${totalAdded} items ajoutés, ${totalHelpOnly} aides complétées, ${totalSkipped} déjà à jour ===\n`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
