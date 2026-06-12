/**
 * Patch idempotent — DC01792 v2 du 29-09-2025
 * "Acheminement de transports avec particularités — TE, MD radioactives,
 *  gabarit GB, wagons en charge D, conditions météorologiques extrêmes".
 *
 * Architecture validée : socle + spécialisations (cohérence DC01503).
 *
 *   1) Socle : "Acheminement d'un transport particulier" (existante)
 *      enrichie avec 6 items principes communs au DC01792.
 *
 *   2) 3 nouvelles procédures spécialisées créées dans le domaine
 *      "Acheminement des transports avec particularités" :
 *        a) Transport Exceptionnel (TE) (G4, 10 items, Fiches 1-11)
 *        b) Conditions météorologiques extrêmes (G3, 7 items, § 2.7-8 + Fiches 40-60)
 *        c) Acheminement de matières radioactives (G4, 6 items, § 2.2 + Fiche 20)
 *
 *   Total : 29 items ajoutés, 3 procédures créées.
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc01792.ts
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
  theme: string;
  gravity: number;
  risk: string;
  documents: string[];
  items: NewItem[];
};

const DOMAIN = "Acheminement des transports avec particularités";
const THEME = "Transports avec particularités";

const NEW_PROCEDURES: NewProcedure[] = [
  // ───────────────────────────────────────────────────────────────────────
  // a) Transport Exceptionnel (TE)
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Transport Exceptionnel (TE)",
    theme: THEME,
    gravity: 4,
    risk: "Collision, dépassement de gabarit, talonnage d'appareils de voie, déraillement.",
    documents: ["DC01792"],
    items: [
      {
        label:
          "Avis de Transport Exceptionnel — contenu, conditions, transmission",
        helpReference: "DC01792 § 2.1.1",
        helpText:
          "L'Avis TE est délivré par le Bureau des Transports Exceptionnels. Il précise : nature et dimensions du convoi, parcours, conditions de circulation, restrictions (vitesse, croisement, dépassement). Transmis à l'AC avant la circulation.",
      },
      {
        label:
          "Type 4 vs type 5 — conditions de circulation distinctes",
        helpReference: "DC01792 Fiches 2 et 3",
        helpText:
          "Le type 4 : TE avec restrictions standards. Le type 5 : TE avec restrictions renforcées (vitesse plus basse, parcours limités). La Fiche 2 (lignes régulées) et la Fiche 3 (non régulées) précisent les particularités d'acheminement.",
      },
      {
        label:
          "Incorporation par DINAMIC vs hors DINAMIC",
        helpReference: "DC01792 Fiches 1.1 et 1.2",
        helpText:
          "Si le TE est incorporé via DINAMIC (système digital national), Fiche 1.1 s'applique : schéma simplifié, ordres digitaux. Sinon, Fiche 1.2 : procédure manuelle avec transmission papier/dépêche traditionnelle.",
      },
      {
        label:
          "Interdiction de croisement ou de dépassement en gare",
        helpReference: "DC01792 Fiche 4",
        helpText:
          "Pendant le passage du TE en gare, aucune circulation ne peut le croiser ni le dépasser. L'AC réserve les voies concernées et interdit les itinéraires conflictuels jusqu'au dégagement complet du TE.",
      },
      {
        label:
          "Interdiction croisement/dépassement en pleine voie — variations selon ICS/banalisation/voies contiguës",
        helpReference: "DC01792 Fiches 5, 5.1 à 5.5",
        helpText:
          "5 variantes selon la configuration : 5.1 voies sans ICS ni banalisation, 5.2 voies avec ICS ou banalisées, 5.3 voies contiguës de même sens, 5.4 voies contiguës de sens contraire, 5.5 combinaison ICS + contiguë même sens. Choix de la fiche selon le contexte.",
      },
      {
        label:
          "Interdiction de croisement/dépassement d'autres TE ou de circulations > 160 km/h",
        helpReference: "DC01792 Fiche 6",
        helpText:
          "Pour les TE dépassant les piédroits du gabarit (encombrement latéral important) ou pour les circulations à plus de 160 km/h, le croisement/dépassement est strictement interdit. Mesures complémentaires pour la sécurité du convoi.",
      },
      {
        label:
          "Interdiction d'emprunt de la branche déviée des appareils de voie",
        helpReference: "DC01792 Fiche 7",
        helpText:
          "Certains TE ne peuvent emprunter la branche déviée d'un appareil de voie (rayon de courbure trop serré, risque de talonnage). L'AC vérifie l'itinéraire prévu et oriente vers la branche directe.",
      },
      {
        label: "Garage d'un TE sur voie de service — conditions",
        helpReference: "DC01792 Fiche 8.1",
        helpText:
          "Le garage TE sur voie de service nécessite des vérifications : aptitude de la voie (gabarit, longueur), absence de circulation conflictuelle, conditions d'accès, modalités de sortie ultérieure. Trace au registre.",
      },
      {
        label: "Remise en circulation d'un TE garé sur voie de service",
        helpReference: "DC01792 Fiche 8.2",
        helpText:
          "À la remise en circulation, l'AC : vérifie l'absence d'obstacle, réactive l'Avis TE si nécessaire, prépare l'itinéraire de sortie selon le parcours prévu. Coordination avec l'Opérateur TE pour la suite du convoi.",
      },
      {
        label:
          "TE dispensés d'annonce et détournement sur lignes non régulées",
        helpReference: "DC01792 Fiches 10 et 11",
        helpText:
          "Certains TE de gabarit standard peuvent être dispensés d'annonce préalable (Fiche 10). En cas de détournement sur lignes non régulées (Fiche 11), procédure spécifique : vérifications renforcées, communication avec gares encadrantes, traçabilité.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // b) Conditions météorologiques extrêmes
  // ───────────────────────────────────────────────────────────────────────
  {
    title:
      "Conditions météorologiques extrêmes (neige, givre, verglas, vents)",
    theme: THEME,
    gravity: 3,
    risk: "Adhérence dégradée, accrochage caténaire, chute d'arbres, ralentissement et arrêts généralisés.",
    documents: ["DC01792"],
    items: [
      {
        label:
          "Consultation et anticipation des prévisions météorologiques",
        helpReference: "DC01792 § 2.7.1",
        helpText:
          "L'AC consulte régulièrement les prévisions météo (services dédiés SNCF, alertes Météo-France) et anticipe les mesures à prendre. La vigilance est accrue dès l'annonce de phénomènes intenses (chutes de neige, givre, vents > seuils).",
      },
      {
        label: "Fortes chutes de neige sur Lignes Conventionnelles",
        helpReference: "DC01792 Fiche 40",
        helpText:
          "Sur LC : restrictions de vitesse selon l'intensité, vérifications avant départ (pantos, freins), surveillance renforcée pendant la marche. Coordination avec les services de l'infrastructure pour le déneigement et le dégagement de la voie.",
      },
      {
        label: "Fortes chutes de neige sur Lignes à Grande Vitesse",
        helpReference: "DC01792 Fiche 41",
        helpText:
          "Sur LGV : restrictions spécifiques (vitesse, espacement), inspection de la voie par engins dédiés avant reprise des circulations commerciales. La gestion de l'aérodynamique en présence de neige nécessite des protocoles renforcés.",
      },
      {
        label: "Formation de givre ou de verglas sur LC",
        helpReference: "DC01792 Fiche 50",
        helpText:
          "Sur LC : surveillance des caténaires (risque d'arc électrique au passage du panto), restrictions de vitesse pour limiter le givrage, déclenchement chasse-givre si disponible. Information conducteurs et coordination régulateur.",
      },
      {
        label: "Formation de givre ou de verglas sur LGV",
        helpReference: "DC01792 Fiche 51",
        helpText:
          "Sur LGV : la formation de givre/verglas est plus critique en raison des vitesses élevées. Trains chasse-givre nocturnes, ralentissements imposés, inspection visuelle si signalé. Coordination étroite avec RSS pour la traction électrique.",
      },
      {
        label:
          "Anticipation et traitement des conséquences des vents violents et tempêtes",
        helpReference: "DC01792 § 2.8",
        helpText:
          "Lors d'alertes vents violents : surveillance arbres bordant les voies, vérification stabilité ouvrages d'art (ponts, talus), restrictions de vitesse selon l'intensité. Anticipation des coupures (lignes électriques, signalisation).",
      },
      {
        label:
          "Mouvements anormaux de la caténaire sur LC électrifiée 25000 V",
        helpReference: "DC01792 Fiche 60",
        helpText:
          "Détection : balancement excessif de la caténaire (vents, panto défaillant). Mesures : arrêt circulations sur la zone, vérification visuelle, avis RSS pour consignation si nécessaire, contrôle de l'absence de rupture ou de dégât.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // c) Acheminement de matières radioactives
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Acheminement de matières radioactives",
    theme: THEME,
    gravity: 4,
    risk: "Contamination, exposition radiologique, dispersion en cas d'avarie ou d'accident.",
    documents: ["DC01792"],
    items: [
      {
        label: "Avis Préalable obligatoire — Avis Circulation matières radioactives",
        helpReference: "DC01792 § 2.2.2",
        helpText:
          "Tout acheminement de matières radioactives donne lieu à un Avis Préalable transmis à l'AC. L'Avis Circulation précise le contenu, la nature des matières, le parcours, les contraintes (vitesse, croisement) et les contacts d'urgence.",
      },
      {
        label: "Suivi des transports radioactifs sur la marche",
        helpReference: "DC01792 § 2.2.1",
        helpText:
          "Le suivi inclut : position du convoi, heure de passage aux points clés, anomalies éventuelles, communication avec le conducteur. Le COGC et le Bureau des TE sont avisés en cas d'incident ou de modification de parcours.",
      },
      {
        label:
          "Annonce des acheminements de matières radioactives — modalités",
        helpReference: "DC01792 § 2.2.3",
        helpText:
          "L'annonce préalable aux AC des gares de passage indique : nature des MD radioactives, classe, numéros ONU si applicable, conditions particulières d'arrêt et de stationnement. Communication confidentielle (sécurité).",
      },
      {
        label:
          "Immobilisation d'un envoi de matières radioactives en gare",
        helpReference: "DC01792 § 2.2.4",
        helpText:
          "Si un convoi radioactif doit être immobilisé en gare (avarie, arrêt prolongé) : isolement immédiat de la zone, avis aux autorités (CMIR, pompiers spécialisés, ASN), sécurisation du périmètre, communication avec le donneur d'ordre.",
      },
      {
        label:
          "Mesures de prévention spécifiques aux transports radioactifs",
        helpReference: "DC01792 § 2.2.5",
        helpText:
          "Mesures : pas de stationnement prolongé en gare voyageurs sauf nécessité, surveillance renforcée, accès interdit à toute personne non autorisée, application des consignes spécifiques de l'entreprise ferroviaire.",
      },
      {
        label:
          "Protocole d'acheminement d'un convoi de matières radioactives",
        helpReference: "DC01792 Fiche 20",
        helpText:
          "Fiche unifiée de l'acheminement : préparation (vérification annonces, parcours, points sensibles), exécution (suivi heure par heure, communication), clôture (confirmation d'arrivée, trace au registre). Coordination CMIR/CAB si incident.",
      },
    ],
  },
];

const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // Socle "Acheminement d'un transport particulier" (+6 items principes)
  // ───────────────────────────────────────────────────────────────────────
  "Acheminement d'un transport particulier": [
    {
      label:
        "Identification du type de transport particulier (TE, MD, radioactif, gabarit GB, charge D, unités flexibles)",
      helpReference: "DC01792 § 1",
      helpText:
        "Les transports avec particularités regroupent plusieurs catégories distinctes traitées par le DC01792 : TE (encombrement, masse), MD (dangereuses), radioactives, gabarit GB (limites latérales), wagons en charge D (essieu lourd), unités flexibles. L'AC identifie le type avant tout traitement.",
    },
    {
      label:
        "Rôle du Bureau des Transports Exceptionnels et de l'Opérateur TE",
      helpReference: "DC01792 § 1.4 et § 1.11",
      helpText:
        "Le Bureau des TE délivre les autorisations d'acheminement et les Avis TE. L'Opérateur TE est la personne désignée par l'EF pour suivre le convoi et coordonner avec les AC. L'AC s'identifie auprès de l'Opérateur TE avant le passage.",
    },
    {
      label:
        "Conditions de circulation des transports de MD sur voies de service",
      helpReference: "DC01792 § 2.6.1 à § 2.6.4",
      helpText:
        "MD sur voie de service : information préalable, stationnement de MD classe 1 (explosifs) avec restrictions spécifiques (durée, accès, distance habitations), séjour temporaire modifié ou imprévu signalé immédiatement.",
    },
    {
      label:
        "Transports d'unités flexibles chargées sur plus de deux wagons",
      helpReference: "DC01792 § 2.3 + Fiche 30",
      helpText:
        "Cas particulier : unités flexibles (containers, charges allongées) chargées sur plus de 2 wagons. Conditions : trafic intérieur vs international (§ 2.3.1-2), restrictions vitesse, parcours, principes d'acheminement (Fiche 30).",
    },
    {
      label:
        "Transports au gabarit GB et wagons en charge D — particularités",
      helpReference: "DC01792 § 2.4 et § 2.5",
      helpText:
        "Gabarit GB : transports dépassant le gabarit standard mais sans encombrement TE. Caractéristiques du RFN compatibles à vérifier, circulation différente sur voie principale vs voie de service. Wagons en charge D : essieux lourds, restrictions de vitesse, voies aptes uniquement.",
    },
    {
      label:
        "Surveillance du convoi pendant la marche et traçabilité des passages",
      helpReference: "DC01792 § 2.1.2",
      helpText:
        "Pendant la marche du convoi avec particularité, surveillance visuelle aux points de passage (composition, signalisation, comportement), traçabilité au registre (heures, anomalies), communication avec l'Opérateur TE ou le conducteur en cas de doute.",
    },
  ],
};

async function main() {
  console.log(
    `\n=== Patch DC01792 v2 du 29-09-2025 (Transports avec particularités) ===\n`
  );

  // Étape 1 : création des nouvelles procédures.
  console.log("--- Création des procédures spécialisées ---");
  for (const np of NEW_PROCEDURES) {
    const existing = await prisma.procedure.findFirst({
      where: { title: np.title, domain: DOMAIN },
      select: { id: true },
    });
    let procId: string;
    if (existing) {
      procId = existing.id;
      console.log(`  [skip] "${np.title}" — existe déjà`);
    } else {
      const created = await prisma.procedure.create({
        data: {
          domain: DOMAIN,
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

  // Étape 2 : enrichissement du socle.
  console.log("\n--- Enrichissement du socle ---");
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

  console.log(`\n=== Terminé : socle +${totalAdded} items, 3 spé créées ===\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
