/**
 * Patch idempotent — DC01556 v4 du 13-03-2025
 * "Shuntage — Circulations de catégorie A, B, C".
 *
 * Sujet : aptitude au shuntage des circulations (contact rail/roue qui
 * permet aux circuits de voie de détecter la présence d'un train).
 * Évènement redouté = "déshuntage" → libération intempestive de zone
 * → risque d'expédition vers zone non libérée.
 *
 *   Enrichissement de 2 procédures (+14 items) :
 *     - Circulations de catégorie A, B, C (+12 items, Fiches 101-107)
 *     - Circuits de voie peu empruntés (+2 items, lien § 4 + Fiche 106)
 *
 *   Aucun doublon flagrant détecté. Pas de nouvelle procédure créée.
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc01556.ts
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
  // Circulations de catégorie A, B, C (+12 items)
  // ───────────────────────────────────────────────────────────────────────
  "Circulations de catégorie A, B, C": [
    {
      label:
        "Évènement redouté « déshuntage » — définition et conséquences",
      helpReference: "DC01556 § 4.1",
      helpText:
        "Le déshuntage est la perte du contact rail-roue qui rend une circulation invisible des circuits de voie. Conséquence : libération intempestive de zone → un autre train peut être expédié vers une zone qu'il croit libre alors qu'elle est occupée. Risque majeur de collision.",
    },
    {
      label:
        "Facteurs influençant le contact rail-roue (pollution, masse essieux, humidité, état roues)",
      helpReference: "DC01556 § 4.2",
      helpText:
        "Le contact rail-roue dépend de : pollution du rail (graisse, feuilles, oxydation), masse des essieux, humidité, état des roues (planat, polissage). Un engin léger sur rail pollué ou sec a un risque déshuntage accru. D'où la catégorisation A/B/C.",
    },
    {
      label:
        "Identification de la catégorie A / B / C selon aptitude au shuntage",
      helpReference: "DC01556 Fiche 101",
      helpText:
        "A : aptitude bonne, matériel standard. B : aptitude réduite (engins plus légers, conditions partielles). C : aptitude faible (engins-chantier légers, draisines), déshuntage probable. L'identification est portée par la composition du convoi et son matériel.",
    },
    {
      label:
        "Mesures préalables à la mise en marche d'une circulation A, B ou C",
      helpReference: "DC01556 Fiche 102",
      helpText:
        "Vérifier : aptitude effective du matériel (dispositif d'aide au shuntage actif si C), conditions de circulation (météo, état pollution rails connue), parcours prévu (gares avec poste équipé CdV). Pas de départ si conditions non réunies.",
    },
    {
      label:
        "Mesures dans les postes équipés de CdV vis-à-vis des circulations A / B",
      helpReference: "DC01556 Fiches 103.1 et 103.2",
      helpText:
        "Catégorie A : pas de mesure particulière, la détection CdV est fiable. Catégorie B : vigilance accrue sur les modifications d'itinéraires, vérification visuelle de l'occupation effective avant toute action sensible.",
    },
    {
      label:
        "Mesures dans les postes vis-à-vis catégorie C (modification itinéraire, stationnement)",
      helpReference: "DC01556 Fiche 103.3",
      helpText:
        "Pour les circulations catégorie C : interdiction de se fier au seul CdV. Avant modification d'itinéraire ou stationnement voie principale, vérification supplémentaire (visuelle, communication conducteur). Différence selon poste à commandes individuelles (103.3.1) ou itinéraires (103.3.2).",
    },
    {
      label:
        "Mesures « pollution » vis-à-vis de l'ensemble des circulations dans un poste",
      helpReference: "DC01556 Fiche 103.4",
      helpText:
        "En cas de pollution avérée du réseau de CdV (incident généralisé, chute de feuilles, gel), application de mesures « pollution » sur l'ensemble des circulations : toutes les circulations sont alors traitées comme catégorie C jusqu'au retour à la normale.",
    },
    {
      label:
        "Détection d'une libération intempestive de zone — procédure d'urgence",
      helpReference: "DC01556 Fiche 103.5",
      helpText:
        "Quand un CdV signale libération alors que la zone est encore occupée (vérifié visuellement ou par recoupement), application d'une procédure d'urgence : interdiction de tracer un itinéraire conflictuel, vérification physique, avis aux mainteneurs.",
    },
    {
      label:
        "Mesures sur ligne BAL / BAPR / BMCV pour sortie d'une circulation C (IPCS / ITCS)",
      helpReference: "DC01556 Fiche 104",
      helpText:
        "Sur ligne à block par circuits de voie (BAL, BAPR, BMCV), une circulation C sortant de la zone d'action du poste nécessite des mesures spécifiques : 104.1 IPCS à accord et prise du sens, 104.2 voie banalisée ITCS, 104.3 autres cas. Postes commandes individuelles vs itinéraires distingués.",
    },
    {
      label:
        "Avarie du dispositif d'aide au shuntage avant le départ — décision",
      helpReference: "DC01556 Fiche 105.1",
      helpText:
        "Si l'avarie est détectée avant le départ de la gare d'origine : décision de remise en marche avec restrictions (catégorie C imposée) OU report du départ jusqu'au dépannage. Avis au régulateur et trace au registre.",
    },
    {
      label:
        "Avarie en cours de route (autorisation remise en marche ou secours)",
      helpReference: "DC01556 Fiche 105.2",
      helpText:
        "Avarie détectée en cours de route : 1re possibilité (105.2.1) — le régulateur autorise la remise en marche avec mesures C ; 2e possibilité (105.2.2) — le régulateur décide de faire secourir la circulation. Choix selon contexte (distance, trafic).",
    },
    {
      label:
        "Avarie sur catégorie A → considérer comme catégorie B + Secours équipée = catégorie C",
      helpReference: "DC01556 Fiches 105 bis et 107",
      helpText:
        "Fiche 105 bis : une circulation A frappée d'avarie sur son dispositif d'aide au shuntage est requalifiée B. Fiche 107 : si le secours d'une circulation équipée conduit à former un ensemble (train secourant + secouru), l'ensemble est considéré comme catégorie C — restrictions applicables.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Circuits de voie peu empruntés (+2 items)
  // ───────────────────────────────────────────────────────────────────────
  "Circuits de voie peu empruntés": [
    {
      label:
        "Lien avec l'évènement redouté « déshuntage » : circuits peu empruntés = risque accru",
      helpReference: "DC01556 § 4",
      helpText:
        "Les CdV peu empruntés voient leur capacité de détection se dégrader : oxydation du rail, accumulation pollution. Le risque de déshuntage y est accru, même pour des matériels normalement catégorie A. D'où l'attention particulière sur les itinéraires désignés.",
    },
    {
      label:
        "Mesures pour PN / TVP avec pictogrammes lumineux tributaires de CdV",
      helpReference: "DC01556 Fiche 106",
      helpText:
        "Quand un PN ou une TVP a son pictogramme lumineux piloté par un CdV peu emprunté, les mesures applicables couvrent : engins catégorie C ou exploitation particulière (106.1), suite avarie ou mise hors service du dispositif d'aide au shuntage (106.2).",
    },
  ],
};

async function main() {
  console.log(`\n=== Patch DC01556 v4 du 13-03-2025 (Shuntage) ===\n`);

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
