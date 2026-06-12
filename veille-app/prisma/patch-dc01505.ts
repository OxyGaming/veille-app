/**
 * Patch idempotent — DC01505 v11 du 29-09-2025
 * "Double voie et voies banalisées — Circulation, secours, VUT,
 *  mouvements à contre-voie".
 *
 *   1) Soft-delete de 2 doublons :
 *        - "Circulation des manoeuvres guidées et non guidées"
 *          (1 item, sous-ensemble de "Circulation des manœuvres
 *          guidées" qui sera enrichie)
 *        - "Attribution d'un bloc" (5 items, ~80% recouvrement avec
 *          "Gestion d'un bloc" qui est plus complète métier — inclut
 *          les procédures d'engagement/dégagement)
 *
 *   2) Création d'une nouvelle procédure spécialisée :
 *        - "Voie Unique Temporaire (VUT) inopinée"
 *          (domaine Mouvement > Exploitation en mode dégradé, G3,
 *           7 items couvrant § 2.3 et Fiches 21-26)
 *
 *   3) Enrichissement de 7 procédures existantes :
 *        - Mesures préalables à la réception (+5)
 *        - Mesures postérieures à la réception (+3)
 *        - Contre-voie (+9)
 *        - Mesures préalables au secours (+3)
 *        - Réalisation du secours (+3)
 *        - Annulation de la demande de secours (+1)
 *        - Circulation des manœuvres guidées (+4)
 *
 *   ETCS niveau 1 (§ 2.5) et Desserte à contre-sens inopinée sur IPCS
 *   (§ 2.6) NON enrichis (choix utilisateur — sujets marginaux).
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc01505.ts
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

type NewProcedure = {
  title: string;
  domain: string;
  theme: string;
  gravity: number;
  risk: string;
  documents: string[];
  items: NewItem[];
};

// ─── Soft-delete des doublons ─────────────────────────────────────────────
const TO_SOFT_DELETE = [
  "Circulation des manoeuvres guidées et non guidées",
  "Attribution d'un bloc",
];

// ─── Nouvelles procédures ─────────────────────────────────────────────────
const NEW_PROCEDURES: NewProcedure[] = [
  {
    title: "Voie Unique Temporaire (VUT) inopinée",
    domain: "Mouvement",
    theme: "Exploitation en mode dégradé",
    gravity: 3,
    risk: "Engagement intempestif sens contraire, collision nez-à-nez, perte d'espacement.",
    documents: ["DC01505"],
    items: [
      {
        label:
          "Conditions d'organisation d'une VUT (incident, indisponibilité d'une des voies)",
        helpReference: "DC01505 § 2.3.1",
        helpText:
          "Une VUT est organisée pour exploiter en voie unique l'une des deux voies d'une ligne à double voie, quand l'autre est indisponible (incident, travaux non programmés). Décision prise par le COGC en concertation avec EIC.",
      },
      {
        label:
          "Organisation : acteurs, ordre des opérations, prise en attachement",
        helpReference: "DC01505 Fiche 21",
        helpText:
          "Acteurs principaux : AC des gares encadrantes, régulateur, COGC. Ordre : décision, avis aux conducteurs concernés, mise en place poste intermédiaire si nécessaire, démarrage exploitation. Prise en attachement obligatoire sur état de circulation.",
      },
      {
        label:
          "Exploitation VUT — Circulation des trains à sens normal",
        helpReference: "DC01505 Fiche 22",
        helpText:
          "Les trains à sens normal (sur la voie restée disponible dans son sens habituel) circulent dans les conditions habituelles, sous réserve des restrictions liées à la VUT. Pas d'avis spécifique au conducteur en général.",
      },
      {
        label:
          "Exploitation VUT — Circulation des trains à contresens",
        helpReference: "DC01505 Fiche 23",
        helpText:
          "Les trains à contresens (qui empruntent la voie restée disponible dans le sens inverse de son sens habituel) reçoivent un avis spécifique du conducteur. Espacement par cantonnement téléphonique entre gares encadrantes ou via PIC.",
      },
      {
        label:
          "Établissement d'un poste intermédiaire de cantonnement téléphonique (PIC)",
        helpReference: "DC01505 Fiche 24",
        helpText:
          "Quand l'espacement direct entre gares encadrantes ne suffit pas (distance, trafic), un PIC est établi à mi-parcours. L'agent au PIC assure le cantonnement téléphonique des trains à contresens et coordonne avec les AC.",
      },
      {
        label:
          "Rôle du garde dans un PIC : protection PN et cantonnement",
        helpReference: "DC01505 Fiche 25",
        helpText:
          "Le garde au PIC assure : protection des PN non automatiques sur la zone qu'il commande, cantonnement téléphonique des trains à contresens, communication avec les AC encadrants et conducteurs.",
      },
      {
        label:
          "Suppression de la VUT — conditions et retour à l'exploitation normale",
        helpReference: "DC01505 Fiche 26",
        helpText:
          "La suppression est décidée quand la voie temporairement indisponible peut être remise en service. Conditions : vérification absence d'obstacle, retour des signalisations à leur état normal, avis aux conducteurs en cours, levée des restrictions.",
      },
    ],
  },
];

// ─── Enrichissements ──────────────────────────────────────────────────────
const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // Mesures préalables à la réception (+5)
  // ───────────────────────────────────────────────────────────────────────
  "Mesures préalables à la réception": [
    {
      label:
        "Désignation de la voie de réception par le RR : critères et trace",
      helpReference: "DC01505 § 2.1.7",
      helpText:
        "Le Responsable de Réception (RR) désigne la voie en fonction : aptitude (longueur, traction électrique, MD), occupation (TOV/GOV), itinéraires possibles, et planification. La désignation est tracée et communiquée aux AC.",
    },
    {
      label: "Différents types d'arrêts (à quai, hors quai, terminus, garage)",
      helpReference: "DC01505 § 2.1.4",
      helpText:
        "Arrêt à quai : montée/descente voyageurs. Hors quai : arrêt technique (signal, croisement). Terminus : fin de marche du train commercial. Garage : stationnement prolongé. Chaque type a des règles d'AuM et de protection spécifiques.",
    },
    {
      label:
        "Plan de surveillance des trains en marche (PSTM) — application",
      helpReference: "DC01505 § 2.1.9",
      helpText:
        "Le PSTM précise pour chaque gare les modalités de surveillance des trains en circulation (visu, contrôles automatiques DBC/DSE). Application : vérification effective pendant le service, alerte immédiate en cas d'anomalie détectée.",
    },
    {
      label:
        "Réception sur voie principale libre — conditions normales (Fiche 8)",
      helpReference: "DC01505 Fiche 8",
      helpText:
        "Cas standard : voie principale libre, signaux ouverts dans l'ordre normal, AuM transmis selon procédure usuelle. Vérifications minimales : libération vérifiée, itinéraire tracé, signalisation ouverte au temps utile.",
    },
    {
      label:
        "Réception sur voie occupée (principale ou service) — conditions spécifiques (Fiche 9)",
      helpReference: "DC01505 Fiche 9",
      helpText:
        "Réception prévue sur voie occupée : nécessite ordre IN82 MV (entrée en canton occupé, marche à vue), vérification absence d'obstacle entre le point d'entrée et le matériel stationné, communication conducteur arrivant ⇄ matériel présent.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Mesures postérieures à la réception (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Mesures postérieures à la réception": [
    {
      label: "Surveillance du train arrivé (composition, signalisation, voyageurs)",
      helpReference: "DC01505 § 2.1.8",
      helpText:
        "Après réception : vérification visuelle composition (longueur, état général), signalisation portée intacte, descente voyageurs ordonnée. Anomalies signalées immédiatement (rupture, feu, fumée, voyageur en danger).",
    },
    {
      label:
        "Cas particulier — train transportant des MD reçu sur voie de service non apte MD",
      helpReference: "DC01505 Fiche 6",
      helpText:
        "Réception exceptionnelle d'un train MD sur une voie de service non aptitude MD. Conditions strictes : autorisation expresse, vérification de l'absence de risque immédiat, durée d'occupation limitée, surveillance renforcée.",
    },
    {
      label:
        "Cas particulier — train transportant des voyageurs reçu sur voie de service (Fiche 5)",
      helpReference: "DC01505 Fiche 5",
      helpText:
        "Circulation exceptionnelle d'un train commercial sur voie de service (incident, déviation). Conditions : autorisation EF, vérification accès quai si descente prévue, signalisation adaptée, communication renforcée avec conducteur et chef de train.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Contre-voie (+9)
  // ───────────────────────────────────────────────────────────────────────
  "Contre-voie": [
    {
      label: "Sens normal vs sens inverse — définitions de référence",
      helpReference: "DC01505 § 2.4.1 et § 2.4.2",
      helpText:
        "Sens normal : sens dans lequel la voie est habituellement parcourue. Sens inverse du sens normal = contre-voie. Un mouvement à contre-voie est toute circulation dans le sens opposé au sens normal d'une voie principale.",
    },
    {
      label:
        "Différents types de mouvement à contre-voie (commercial, technique, secours)",
      helpReference: "DC01505 § 2.4.3",
      helpText:
        "Trois grandes catégories : commercial (déviation voyageurs/Fret), technique (essai, manœuvre), secours (récupération train en détresse). Chaque type a des règles particulières (avis, vitesse, formulaires).",
    },
    {
      label:
        "Espacement entre mouvements à contre-voie sur la même section",
      helpReference: "DC01505 § 2.4.4",
      helpText:
        "Deux mouvements à contre-voie sur la même section sont interdits sauf cas particulier (CCTT, CTx). L'AC doit s'assurer du dégagement complet du précédent avant d'en autoriser un nouveau.",
    },
    {
      label:
        "Implantation de la signalisation s'adressant aux mouvements à contre-voie",
      helpReference: "DC01505 § 2.4.5",
      helpText:
        "Signalisation spécifique contre-voie : signaux d'arrêt, de manœuvre, indicateurs de direction. Implantation et lecture peuvent différer du sens normal. L'AC doit connaître la configuration locale (consigne d'établissement).",
    },
    {
      label:
        "Préparation d'un mouvement à contre-voie (check-list, conditions préalables)",
      helpReference: "DC01505 Fiche 31",
      helpText:
        "Avant ordonner un mouvement à contre-voie : vérification voie libre dans la zone, mesures de protection (fermeture signaux opposés), avis aux agents concernés (AC adverses, mainteneur, RPTx si chantier), tracé de l'itinéraire si applicable.",
    },
    {
      label:
        "Prescriptions concernant les agents avisés (qui aviser et avec quel formalisme)",
      helpReference: "DC01505 Fiche 32",
      helpText:
        "Agents à aviser : AC de la gare où se termine le mouvement, AC encadrants si IPCS/ITCS, régulateur, conducteurs concernés, agents PN sur le parcours. Formalisme : dépêche tracée pour ordre, verbal possible pour avis.",
    },
    {
      label:
        "Exécution d'un mouvement à contre-voie — protocole pas-à-pas",
      helpReference: "DC01505 Fiche 33",
      helpText:
        "1) Confirmation conditions préalables. 2) Avis au conducteur (formulaire spécifique). 3) Ouverture signaux ou ordre écrit selon configuration. 4) Suivi du mouvement (point de passage, dégagement). 5) Trace sur état de circulation.",
    },
    {
      label:
        "Mesures à prendre après dégagement d'un mouvement à contre-voie",
      helpReference: "DC01505 Fiche 34",
      helpText:
        "Après dégagement complet : rétablissement signalisation au sens normal, levée des mesures de protection, avis de fin aux agents avisés, mise à jour TOV/GOV, fin de l'enregistrement à l'état de circulation.",
    },
    {
      label:
        "Prescriptions pour l'AC de la gare où se termine le mouvement (autre que celui qui l'ordonne)",
      helpReference: "DC01505 Fiche 35",
      helpText:
        "AC d'arrivée : reçoit avis préalable, prépare l'accueil (voie de réception désignée, libération vérifiée), confirme la prise en charge à l'AC initiateur, applique procédure de réception standard à l'arrivée du mouvement.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Mesures préalables au secours (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Mesures préalables au secours": [
    {
      label:
        "Chaîne d'avis suite à demande de secours (régulateur, AC encadrants, dirigeants)",
      helpReference: "DC01505 § 2.2.1 et § 2.2.2",
      helpText:
        "À réception d'une demande de secours (DSEC BC57), l'AC avise immédiatement : régulateur (priorité), AC des gares encadrantes du train en détresse, dirigeants compétents (DPx, COGC). L'ordre est dicté par l'urgence et le périmètre impacté.",
    },
    {
      label:
        "Particularités du secours sur ligne à voie banalisée",
      helpReference: "DC01505 § 2.2.4",
      helpText:
        "Sur voie banalisée (VB), le secours peut être fourni dans n'importe quel sens d'une même voie. Conditions : libération vérifiée, signalisation adaptée pour le sens choisi, communication renforcée AC encadrants.",
    },
    {
      label:
        "Particularités du secours sur ligne équipée d'IPCS ou ITCS",
      helpReference: "DC01505 § 2.2.5",
      helpText:
        "Sur ligne équipée d'IPCS (Installations Permanentes de Contre-Sens) ou ITCS (Installations Temporaires de Contre-Sens), le secours par voie contiguë est facilité. Procédures spécifiques pour basculer en mode contre-sens : avis, signalisation, vérifications.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Réalisation du secours (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Réalisation du secours": [
    {
      label: "Secours fourni par l'avant — protocole (Fiche 11)",
      helpReference: "DC01505 Fiche 11",
      helpText:
        "L'EMS (Engin Moteur de Secours) rejoint le train en détresse depuis l'avant (en sens inverse). Nécessite mouvement à contre-voie ou utilisation IPCS/ITCS. Avis spécifique au conducteur EMS (vitesse, point d'arrêt, modalités d'accouplement).",
    },
    {
      label: "Secours fourni par l'arrière — protocole (Fiche 12)",
      helpReference: "DC01505 Fiche 12",
      helpText:
        "L'EMS rejoint le train en détresse depuis l'arrière (dans le sens normal). Procédure standard la plus fréquente. Cantonnement maintenu, vérification absence de train intermédiaire, attelage à l'arrière du train en détresse.",
    },
    {
      label:
        "Secours fourni par l'arrière avec retour à la gare en arrière (Fiche 13)",
      helpReference: "DC01505 Fiche 13",
      helpText:
        "Variante de la Fiche 12 : après attelage, le convoi retourne à la gare en arrière (gare amont) au lieu de continuer dans le sens normal. Nécessite mouvement à contre-voie sur la portion retour. Avis et préparation spécifiques.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Annulation de la demande de secours (+1)
  // ───────────────────────────────────────────────────────────────────────
  "Annulation de la demande de secours": [
    {
      label:
        "Protocole d'annulation de la demande de secours et retour à l'autonomie du train",
      helpReference: "DC01505 Fiche 14",
      helpText:
        "Quand le train initialement en détresse peut repartir par ses propres moyens (panne résolue, intervention conducteur réussie) : émission BC58 REMA (fonction 1 — annulation DSEC), avis annulation aux acteurs avisés, vérification conditions de remise en marche, demande/autorisation REMA.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Circulation des manœuvres guidées (+4)
  // ───────────────────────────────────────────────────────────────────────
  "Circulation des manœuvres guidées": [
    {
      label:
        "Désignation d'un train (numérotation, identification, attachement)",
      helpReference: "DC01505 § 2.1.2",
      helpText:
        "Tout train doit être désigné par un numéro unique (4 ou 6 chiffres selon réseau) et identifié à son entrée dans le réseau. L'AC vérifie la cohérence numéro / horaire / composition, et prend en attachement à l'état de circulation.",
    },
    {
      label:
        "Modification de l'ordre normal de circulation (avance, retard, suppression)",
      helpReference: "DC01505 § 2.1.3",
      helpText:
        "Modifications possibles : circulation en avance (Fiche 2 si pas de voyageurs), retard (Fiche 3), déviation (Fiche 4), suppression. Toute modification donne lieu à un avis (régulateur, gares encadrantes, EF) et à un tracé sur état de circulation.",
    },
    {
      label:
        "Différents types d'arrêts (à quai, hors quai, terminus, garage)",
      helpReference: "DC01505 § 2.1.4",
      helpText:
        "Connaissance et identification des différents types d'arrêts est requise pour appliquer les bonnes mesures (AuM, protection, communication conducteur). Le type d'arrêt impacte également la gestion des voyageurs et la signalisation.",
    },
    {
      label: "Respect de l'horaire et gestion des écarts",
      helpReference: "DC01505 § 2.1.5",
      helpText:
        "L'AC veille au respect de l'horaire (départs, passages, arrivées). En cas d'écart (avance ou retard), application des procédures spécifiques (Fiche 2 pour avance, Fiche 3 pour retard) et avis aux acteurs impactés.",
    },
  ],
};

const DOMAIN = "Mouvement";

async function main() {
  console.log(
    `\n=== Patch DC01505 v11 du 29-09-2025 (Circulation/Secours/Contre-voie/VUT) ===\n`
  );

  // Étape 1 : soft-delete des doublons.
  console.log("--- Soft-delete des doublons ---");
  for (const title of TO_SOFT_DELETE) {
    const proc = await prisma.procedure.findFirst({
      where: { title },
      select: { id: true, isActive: true },
    });
    if (!proc) {
      console.log(`  [skip] "${title}" — introuvable`);
      continue;
    }
    if (!proc.isActive) {
      console.log(`  [skip] "${title}" — déjà désactivée`);
      continue;
    }
    await prisma.procedure.update({
      where: { id: proc.id },
      data: { isActive: false },
    });
    console.log(`  [soft-delete] "${title}"`);
  }

  // Étape 2 : création des nouvelles procédures.
  console.log("\n--- Création des procédures spécialisées ---");
  for (const np of NEW_PROCEDURES) {
    const existing = await prisma.procedure.findFirst({
      where: { title: np.title },
      select: { id: true, isActive: true },
    });
    let procId: string;
    if (existing) {
      procId = existing.id;
      console.log(`  [skip] "${np.title}" — existe déjà`);
    } else {
      const created = await prisma.procedure.create({
        data: {
          domain: np.domain,
          theme: np.theme,
          title: np.title,
          gravity: np.gravity,
          risk: np.risk,
          documents: JSON.stringify(np.documents),
          requireGeneralComment: false,
          sortOrder: 0,
          isActive: true,
        },
        select: { id: true },
      });
      procId = created.id;
      console.log(`  [create] "${np.title}" (G${np.gravity})`);
    }

    const lastOrder = await prisma.checklistItem.findFirst({
      where: { procedureId: procId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let order = lastOrder ? lastOrder.sortOrder + 1 : 0;
    let itemsAdded = 0;
    for (const it of np.items) {
      const itemExists = await prisma.checklistItem.findFirst({
        where: { procedureId: procId, label: it.label },
        select: { id: true, helpReference: true },
      });
      if (itemExists) {
        if (!itemExists.helpReference) {
          await prisma.checklistItem.update({
            where: { id: itemExists.id },
            data: { helpReference: it.helpReference, helpText: it.helpText },
          });
        }
        continue;
      }
      await prisma.checklistItem.create({
        data: {
          procedureId: procId,
          label: it.label,
          gravity: it.gravity ?? np.gravity,
          sortOrder: order++,
          helpReference: it.helpReference,
          helpText: it.helpText,
          isActive: true,
        },
      });
      itemsAdded++;
    }
    if (itemsAdded > 0) console.log(`    → ${itemsAdded} items ajoutés`);
  }

  // Étape 3 : enrichissement.
  console.log("\n--- Enrichissement des procédures existantes ---");
  let totalAdded = 0;
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
          console.log(`    [help-only] ${it.label.slice(0, 55)}…`);
        } else {
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

  console.log(`\n=== Terminé : ${totalAdded} items ajoutés ===\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
