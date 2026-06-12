/**
 * Patch idempotent — DC08043 v4 du 07-10-2021
 * "Traction électrique — Consignation C / Protection C / SNOP".
 *
 * Aucun doublon flagrant détecté dans le domaine "Traction électrique".
 * La structure éclatée Veille reflète volontairement les 2 acteurs DC08043
 * (agent E / RSS = celui qui commande, vs aiguilleur = celui qui exécute).
 *
 *   Enrichissement de 9 procédures (+28 items) :
 *     - Consignation C (+4 — Fiches 1, 2, 11, § 2.1.6, § 2.2)
 *     - Mise hors tension / condamnation (+4 — Fiches 4, 8, 14, 16, § 2.6)
 *     - Passage sous caténaire privée de tension (+3 — Fiches 20, 21, 22)
 *     - Protection C (ordres reçus RSS) (+3 — § 2.3)
 *     - Suppression tension cat. secondaire (+2 — Fiches 15, 17)
 *     - Ordres reçus du RSS (agent E) (+2)
 *     - Réalimentation en secours hors consignation C (+3 — Fiches 5, 7)
 *     - Protection C, protection d'une SNOP (aiguilleur) (+3 — Fiches 30, 31, 34)
 *     - Passage bimode sous caténaire privée (aiguilleur) (+4 — Fiches 21, 36)
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc08043.ts
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
  // Consignation C (Travaux/Incidents) — +4 items
  // ───────────────────────────────────────────────────────────────────────
  "Consignation C": [
    {
      label:
        "Demande de consignation C : émetteur, motif, périmètre, durée prévue",
      helpReference: "DC08043 Fiche 1",
      helpText:
        "La demande de consignation C est formalisée par le demandeur (RPTx, mainteneur) vers l'agent E (RSS). Elle précise : motif (travaux, incident), périmètre (élément caténaire, gare, ligne), durée prévue, agent en charge sur le terrain. Tracée au registre.",
    },
    {
      label:
        "Conditions préalables : circuit d'alarme actif, absence de circulation électrique en cours",
      helpReference: "DC08043 § 2.1.6 + § 2.2",
      helpText:
        "Avant consignation C, vérification : circuit d'alarme actif et fonctionnel (permet la détection d'anomalie), absence de circulation électrique engagée sur la zone à consigner (sinon attendre dégagement ou organiser arrêt). Conditions tracées.",
    },
    {
      label:
        "Vérification effective hors tension par moyens autorisés (perches, lampes néon)",
      helpReference: "DC08043 § 2.2 + Fiche 2",
      helpText:
        "La consignation C n'est effective qu'après vérification d'absence de tension par moyens autorisés : perches de mesure, lampes néon, dispositifs de signalisation absence de tension. Vérification réalisée à pied d'œuvre par l'agent désigné.",
    },
    {
      label:
        "Levée de la consignation C : déconsignation, fin de protection, traçabilité",
      helpReference: "DC08043 Fiches 6 à 10",
      helpText:
        "Levée en plusieurs étapes : Fiche 7 suppression alimentation secours, Fiche 8 décondamnation/fermeture appareil interruption, Fiche 9 suppression SNOP, Fiche 10 cessation protection C. Chaque étape tracée et confirmée à l'agent E.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Mise hors tension / condamnation — +4 items
  // ───────────────────────────────────────────────────────────────────────
  "Mise hors tension / condamnation": [
    {
      label:
        "Manœuvre à l'ouverture d'un appareil d'interruption : conditions et IN40 MEQI",
      helpReference: "DC08043 Fiche 4 + DC07202 IN40 MEQI",
      helpText:
        "L'ouverture d'un appareil d'interruption (sectionneur, disjoncteur) est commandée par l'agent E ou par l'aiguilleur sur ordre. Formulaire IN40 MEQI tracé. Manœuvre effective vérifiée par lecture de la position ou indicateurs locaux.",
    },
    {
      label:
        "Pose du dispositif de condamnation et vérification effective",
      helpReference: "DC08043 Fiche 4 + Fiche 14",
      helpText:
        "Après ouverture, pose physique du dispositif de condamnation (cadenas, plombage, étiquette) empêchant la remanœuvre. L'agent en charge vérifie l'effectivité de la condamnation et trace la pose (registre, dépêche).",
    },
    {
      label:
        "Décondamnation à la déconsignation : ordre, vérification, fermeture",
      helpReference: "DC08043 Fiches 8 et 16",
      helpText:
        "À la déconsignation, l'agent E ordonne la décondamnation. L'aiguilleur retire le dispositif, vérifie que les conditions de remise sous tension sont réunies, puis ferme l'appareil d'interruption. Vérification de l'alimentation rétablie.",
    },
    {
      label:
        "Particularité caténaire primaire vs secondaire : fiches distinctes",
      helpReference: "DC08043 § 2.6 + Fiches 14, 15, 16, 17",
      helpText:
        "Le DC08043 distingue caténaire primaire (alimentation directe de la sous-station) et secondaire (alimentée via appareil d'interruption depuis primaire). Procédures distinctes : Fiches 14/16 (primaire), Fiches 15/17 (secondaire). Le matériel et les vérifications diffèrent.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Passage sous caténaire privée de tension — +3 items
  // ───────────────────────────────────────────────────────────────────────
  "Passage sous caténaire privée de tension": [
    {
      label:
        "Bimode : changement des modes de traction en dehors des lieux de transition",
      helpReference: "DC08043 Fiche 20",
      helpText:
        "Le changement de mode de traction (électrique ↔ thermique) hors lieux de transition prévus n'est autorisé que dans des cas particuliers. L'AC vérifie les conditions (panto baissé si zone consignée, absence circulation contiguë) et trace l'opération.",
    },
    {
      label:
        "Passage d'une circulation bimode sous caténaire privée (SNOP, caténaire consignée)",
      helpReference: "DC08043 Fiche 21",
      helpText:
        "Une circulation bimode peut traverser une SNOP ou une caténaire consignée en mode thermique. Conditions : panto effectivement abaissé, avis au conducteur, vérification absence de risque électrique, traçabilité.",
    },
    {
      label:
        "Réduction de l'étendue du domaine privé de tension : conditions",
      helpReference: "DC08043 Fiche 22",
      helpText:
        "Procédure de réduction de l'étendue géographique d'une consignation en cours (les travaux progressent, on peut remettre sous tension une partie). Ordre formel de l'agent E vers l'aiguilleur, vérification de l'absence d'agents dans la zone réalimentée.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Protection C (ordres reçus du RSS) — +3 items
  // ───────────────────────────────────────────────────────────────────────
  "Protection C": [
    {
      label:
        "Principe protection C : empêcher la remise sous tension intempestive",
      helpReference: "DC08043 § 2.3.1",
      helpText:
        "La protection C est l'ensemble des mesures empêchant la remise sous tension intempestive d'une caténaire consignée. Elle inclut : condamnation des appareils, signalisation, organisation des accès, traçabilité. Garantit la sécurité des intervenants.",
    },
    {
      label:
        "Protection C automatique : mécanismes prévus par les installations",
      helpReference: "DC08043 § 2.3.2",
      helpText:
        "Sur certaines installations, la protection C est partiellement automatique : enclenchements électromécaniques empêchant la fermeture, alarmes, dispositifs de contrôle. L'AC vérifie le fonctionnement effectif des automatismes avant de les considérer actifs.",
    },
    {
      label:
        "Protection C assurée de fait : cas particuliers où elle n'est pas explicitement demandée",
      helpReference: "DC08043 § 2.3.3",
      helpText:
        "Dans certains cas (très courte intervention, configuration particulière du réseau), la protection C est dite « assurée de fait » : conditions cumulatives à vérifier sans formalisme explicite. Limites bien définies par la consigne locale.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Suppression de la tension sur El. de caténaire secondaire — +2 items
  // ───────────────────────────────────────────────────────────────────────
  "Suppression de la tension sur El. de caténaire secondaire": [
    {
      label:
        "Distinction caténaire primaire vs secondaire : fiches DC08043 spécifiques",
      helpReference: "DC08043 § 2.6 + Fiches 15, 17",
      helpText:
        "Un élément de caténaire secondaire est alimenté via un appareil d'interruption depuis la caténaire primaire. Sa mise hors tension n'affecte pas le réseau primaire. Procédure simplifiée par rapport au primaire : Fiche 15 condamnation, Fiche 17 décondamnation.",
    },
    {
      label:
        "Décondamnation et fermeture de l'appareil d'interruption alimentant",
      helpReference: "DC08043 Fiche 17",
      helpText:
        "À la déconsignation, l'aiguilleur (sur ordre RSS) retire la condamnation puis ferme l'appareil d'interruption alimentant la caténaire secondaire. Vérification de la remise sous tension effective (indicateurs, alarme remise au repos).",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Ordres reçus du RSS (Rôle agent E) — +2 items
  // ───────────────────────────────────────────────────────────────────────
  "Ordres reçus du RSS": [
    {
      label:
        "Collationnement systématique des ordres reçus du RSS",
      helpReference: "DC07202 § 2.3.2 + DC08043 § 2.1.3",
      helpText:
        "Tout ordre reçu du RSS (consignation, décondamnation, manœuvre) doit être collationné mot pour mot par l'agent qui le reçoit. Le RSS confirme l'exactitude avant que l'ordre devienne exécutoire. Communication tracée.",
    },
    {
      label:
        "Conditions de transmission des ordres au RSS (téléphonie dédiée, GSM-R)",
      helpReference: "DC08043 § 2.1.6 + DC07202 § 2.2",
      helpText:
        "La transmission des ordres se fait par moyen sécurisé (téléphonie dédiée traction électrique, GSM-R). En cas de dérangement, application des procédures alternatives (exprès, dépêche via autre poste). Toute communication tracée au registre.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Réalimentation en secours hors consignation C — +3 items
  // ───────────────────────────────────────────────────────────────────────
  "Réalimentation en secours hors consignation C": [
    {
      label: "Alimentation de secours : conditions et autorisation préalable",
      helpReference: "DC08043 Fiche 5",
      helpText:
        "L'alimentation de secours permet de réalimenter une zone consignée par un autre point d'alimentation (autre sous-station, secours mobile). Conditions : autorisation expresse RSS, vérification absence d'intervention sur la zone, mise en place avant déconsignation.",
    },
    {
      label: "Suppression de l'alimentation de secours à la déconsignation",
      helpReference: "DC08043 Fiche 7",
      helpText:
        "À la déconsignation, l'alimentation de secours doit être supprimée avant rétablissement de l'alimentation normale (sinon risque de couplage indésirable). Ordre RSS, vérification, trace.",
    },
    {
      label:
        "Suppression de tension d'alimentation hors de toute consignation C",
      helpReference: "DC08043 § 2.6.6",
      helpText:
        "Cas où la tension est coupée sans consignation C formelle (urgence électrique, alarme). Mesures de protection minimales sans formalisme complet. Régulariser par consignation C ou rétablir rapidement selon le contexte.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Protection C, protection d'une SNOP (aiguilleur) — +3 items
  // ───────────────────────────────────────────────────────────────────────
  "Protection C, protection d'une SNOP": [
    {
      label:
        "Mise en œuvre de la protection C en tant qu'aiguilleur",
      helpReference: "DC08043 Fiche 30",
      helpText:
        "L'aiguilleur exécute la protection C sur ordre du RSS : condamnation des appareils d'interruption désignés, pose des dispositifs de signalisation, vérification de l'effectivité. Confirme l'exécution au RSS par dépêche.",
    },
    {
      label:
        "Protection d'une SNOP (Section Neutre Ouverte Position) : conditions",
      helpReference: "DC08043 Fiche 31",
      helpText:
        "La SNOP est une portion de caténaire neutralisée par ouverture des sectionneurs aux extrémités. Sa protection nécessite condamnation des sectionneurs, pose signalisation, vérification visuelle. Permet une intervention sans consignation complète.",
    },
    {
      label:
        "Suppression d'une SNOP : conditions et traçabilité",
      helpReference: "DC08043 Fiche 34",
      helpText:
        "Levée de la SNOP : ordre RSS, décondamnation et fermeture des sectionneurs, vérification d'absence d'agents sur la zone, remise sous tension. Trace au registre + confirmation au RSS.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Passage d'une circulation bimode sous caténaire privée (aiguilleur)
  // — +4 items (procédure actuellement vide !)
  // ───────────────────────────────────────────────────────────────────────
  "Passage d'une circulation bimode sous caténaire privée de tension": [
    {
      label:
        "Conditions du passage d'une circulation bimode (Fiche 21)",
      helpReference: "DC08043 Fiche 21",
      helpText:
        "Une circulation bimode peut passer sous une caténaire consignée OU une SNOP, sous réserve : (1) panto effectivement abaissé, (2) mode de traction thermique engagé, (3) avis spécifique au conducteur, (4) vérification absence d'autres circulations contiguës.",
    },
    {
      label:
        "Levée de mesure de protection pour passage d'une circulation non électrique",
      helpReference: "DC08043 Fiche 36",
      helpText:
        "Pour permettre le passage d'une circulation non électrique (thermique pure ou bimode panto baissé) sous une SNOP/caténaire consignée, l'aiguilleur peut lever brièvement la mesure de protection sur ordre RSS. Rétablie immédiatement après dégagement.",
    },
    {
      label:
        "Coordination AC ↔ conducteur du train bimode (avis, vérification)",
      helpReference: "DC08043 Fiche 21",
      helpText:
        "L'AC ou l'aiguilleur informe le conducteur de la zone consignée à traverser. Le conducteur confirme l'abaissement du panto et l'engagement du mode thermique. Communication bilatérale tracée avant autorisation de mouvement.",
    },
    {
      label:
        "Traçabilité du passage et fin de l'opération",
      helpReference: "DC08043 Fiches 21, 36",
      helpText:
        "Le passage est tracé : heure d'entrée, heure de dégagement, identité du train et du conducteur. Une fois le train dégagé, rétablissement immédiat de la mesure de protection si elle avait été levée temporairement.",
    },
  ],
};

async function main() {
  console.log(
    `\n=== Patch DC08043 v4 du 07-10-2021 (Traction électrique) ===\n`
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
            data: {
              helpReference: it.helpReference,
              helpText: it.helpText,
            },
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
