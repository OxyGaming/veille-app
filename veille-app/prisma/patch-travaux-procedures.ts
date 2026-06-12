/**
 * Patch idempotent des procédures "Travaux sur les voies ou les IS" :
 *
 *   1) Soft-delete des deux procédures redondantes :
 *        - "Fin des travaux"          (sous-ensemble de "Fin / traçabilité")
 *        - "NVNP : Ententes et fermeture de voie"
 *          (sous-ensemble de "DV : Ententes et/ou fermeture de voie")
 *
 *   2) Enrichissement des 5 procédures restantes avec ~38 items calés
 *      sur DC03969 v01 du 13-09-2022 (Modes opératoires des AC — Tome 1).
 *      Chaque item ajouté porte :
 *        - `helpReference` (ex. "DC03969 § 8.4.1")
 *        - `helpText`      (1-3 phrases d'explication)
 *
 *   Idempotence : recherche par (procedureTitle, label) — pas de doublons
 *   si le script est rejoué.
 *
 *   Lancement :   npx tsx prisma/patch-travaux-procedures.ts
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

const REFERENTIEL = "Modes opératoires des agents-circulation — Tome 1";
const VERSION = "DC03969 v01 — 13-09-2022";

// ─── Procédures à enrichir ────────────────────────────────────────────────
// Map "titre exact" → items à insérer (à la suite des items existants).

const ENRICHMENTS: Record<string, NewItem[]> = {
  "1ère Cat. / DATIS": [
    {
      label: "Repérage des IS impactées (aiguilles, signaux, ADV)",
      helpReference: "DC03969 § 8.1, § 8.2.2",
      helpText:
        "Identifier les installations de sécurité concernées par l'intervention : aiguilles sur la ZEP (continuité, position obligée, indifférente), signaux intermédiaires éventuels, appareils de voie. Conditionne la mise en position avant accord.",
    },
    {
      label: "Carnet de dérangements des IS — tenue et amortissement",
      helpReference: "DC03969 § 8.4.1, § 9.2.2",
      helpText:
        "Les réserves à la restitution (conditions de franchissement des aiguilles) doivent être inscrites au carnet de dérangements des IS. La levée d'une restriction passe par amortissement de ce carnet.",
    },
    {
      label:
        "Mesures contre les modifications d'itinéraires à l'insu (mise en protection, retour automatique)",
      helpReference: "DC03969 § 8.1.2",
      helpText:
        "La consigne de protection liste, pour chaque ZEP, les aiguilles dont la position pourrait être modifiée à l'insu de M&T (tracé d'itinéraire sans rapport avec les travaux). L'AC applique les mesures prévues pour empêcher ces changements.",
    },
  ],

  "DV : Ententes et/ou fermeture de voie": [
    {
      label: "Entente préalable AC-RPTx réalisée ~30 min avant la planche-travaux",
      helpReference: "DC03969 § 6.1",
      helpText:
        "Concertation systématique entre l'AC et le RPTx avant le début de la planche-travaux. Chacun vérifie que les conditions prévues pour la réalisation sont réunies et les adapte si besoin dans son périmètre. Délai théorique 30 min, réductible selon circonstances.",
    },
    {
      label: "Type de ZEP identifié (L / G / L+G) et option d'accord retenue",
      helpReference: "DC03969 § 4.4, synoptique p.38-39",
      helpText:
        "Les ZEP sont de type linéaire (L), non linéaire (G — gare), ou en combinaison (L+G). Le type conditionne l'option d'accord DFV : avec/sans vérification de libération, derrière train ouvrant, avec TTx déclencheur, avec TTx stationné.",
    },
    {
      label: "Mise en position des aiguilles de continuité avant accord",
      helpReference: "DC03969 § 8.1.2",
      helpText:
        "Avant l'accord de la DFV, l'AC place (ou fait placer) les aiguilles dans la position assurant la continuité de la ZEP. Une mauvaise position peut conduire à un dégagement intempestif du domaine fermé.",
    },
    {
      label:
        "Aiguilles à position obligée vérifiées selon la consigne de protection",
      helpReference: "DC03969 § 8.1.1.2, § 8.1.2",
      helpText:
        "Une aiguille à position obligée est intégralement située sur la ZEP, dans les deux directions, jusqu'au garage franc minimum. Sa position imposée par la consigne de protection réduit le risque de sortie intempestive.",
    },
    {
      label: "Position des aiguilles à position indifférente convenue avec le RPTx",
      helpReference: "DC03969 § 8.1.1.3",
      helpText:
        "Une aiguille à position indifférente est entièrement sur la ZEP. RPTx et AC peuvent se concerter à l'entente préalable pour fixer sa position selon les besoins du chantier, ou la modifier pendant la DFV.",
    },
    {
      label:
        "Matériel roulant présent sur la ZEP : jalons d'arrêt / FC / dispositifs de réflexion",
      helpReference: "DC03969 § 8.3.1",
      helpText:
        "Si du matériel roulant stationne sur la ZEP, l'AC s'assure qu'il ne se remettra pas en mouvement : jalons d'arrêt visibles depuis le poste de conduite, ou Fermeture Carré (FC) avec dispositifs de réflexion si la consigne le prévoit.",
    },
    {
      label:
        "Outils d'identification du train ouvrant utilisés (GSMR, OLERON, GALITE)",
      helpReference: "DC03969 § 8.3.2",
      helpText:
        "Pour que M&T puisse identifier le train ouvrant sur le terrain, l'AC mobilise les outils à disposition : GSMR, OLERON, GALITE, contact radio conducteur, etc. À défaut d'identification fiable, basculer sur une autre option d'accord (vérif. de libération).",
    },
    {
      label:
        "DFV avec TTx déclencheur : terminus, n° de marche, attachement à l'état de circulation",
      helpReference: "DC03969 § 8.3.3",
      helpText:
        "Le TTx déclencheur circule comme un train ordinaire jusqu'à un point défini de sa future ZCh où il est terminus. Point d'arrêt prévu au CTx pour préserver le fonctionnement normal des IS. N° de marche et attachement obligatoires.",
    },
    {
      label: "DFV avec TTx stationné : point d'arrêt prévu à la consigne de protection",
      helpReference: "DC03969 § 8.3.4",
      helpText:
        "Le TTx stationné est acheminé comme une circulation ordinaire jusqu'à un point défini de sa future ZCh, prévu à la consigne de protection. Ce point ne doit pas perturber l'exploitation de la gare.",
    },
  ],

  "Fin des travaux et/ou traçabilité": [
    {
      label: "Réserves à la restitution (aiguilles) inscrites au carnet de dérangements IS",
      helpReference: "DC03969 § 8.4.1",
      helpText:
        "Les réserves à la restitution concernent uniquement les aiguilles et précisent leurs conditions de franchissement. En cas de dérangement, retranscrire la réserve au carnet de dérangements des IS.",
    },
    {
      label: "Restitution occupée ZEP type G : TTx immobilisé ou prêt expédition, nature précisée à l'AC",
      helpReference: "DC03969 § 8.4.3.1",
      helpText:
        "Au point prévu à la CCE S9C ou CCTT, le TTx est soit immobilisé conformément à la consigne d'immobilisation, soit prêt pour expédition. Le RPTx précise à l'AC la position ou n° de marche et la nature des TTx occupant la ZEP.",
    },
    {
      label: "Restitution occupée ZEP type L : TTx prêt expédition + AuM tracé",
      helpReference: "DC03969 § 8.4.3.2",
      helpText:
        "Le TTx est prêt pour l'expédition au point prévu au CTx. Le RPTx restitue la DFV en précisant le TTx, puis donne avec traçabilité l'autorisation de mouvement au conducteur, après autorisation de l'AC.",
    },
    {
      label: "Ordre de restriction de circulation transmis avant AuM si zone restreinte",
      helpReference: "DC03969 § 8.4.2",
      helpText:
        "Sur restitution occupée ZEP type L avec restriction entre point d'attente du TTx et destination, l'ordre de restriction est transmis au conducteur (écrit ou dépêche, carnet d'ordres correspondant) avant l'AuM via le RPTx.",
    },
    {
      label:
        "Levée des restrictions tracée (autorisation M&T écrite / amortissement IS / passage de N circulations)",
      helpReference: "DC03969 § 8.4.2",
      helpText:
        "Trois voies de levée : autorisation M&T par écrit/dépêche, amortissement du carnet de dérangements IS, ou passage du nombre défini de circulations concernées par une limitation de vitesse (ex. travaux de bourrage).",
    },
    {
      label: "Mode de traçabilité respecté = celui prévu initialement (écrit / dépêche)",
      helpReference: "DC03969 § 6.2",
      helpText:
        "Toute modification d'information en cours de travaux s'effectue selon le mode de traçabilité prévu initialement pour cette information. Pas de bascule informelle d'un écrit à un verbal.",
    },
    {
      label: "Inscription des avis non liés aux travaux au cadre « Autres dépêches » du carnet de DFV",
      helpReference: "DC03969 § 8.2.6",
      helpText:
        "À la réception d'un avis d'obstacle ou danger sans rapport avec les travaux, l'avis est reçu verbalement et inscrit dans le cadre « Autres dépêches » du carnet de DFV. Les avis DC01503 doivent par ailleurs être lancés.",
    },
  ],

  "TTX / LAM": [
    {
      label:
        "Autorisation d'engagement reçue avant manœuvre d'une aiguille point d'engagement",
      helpReference: "DC03969 § 8.1.3",
      helpText:
        "Pour manœuvrer une aiguille désignée comme point d'engagement d'un TTx vers le domaine fermé, l'AC doit avoir reçu au préalable l'autorisation d'engagement du RPTx, avec traçabilité.",
    },
    {
      label:
        "Demande de dégagement ATTx reçue avant manœuvre d'une aiguille point de dégagement",
      helpReference: "DC03969 § 8.1.3",
      helpText:
        "Pour manœuvrer une aiguille désignée comme point de dégagement d'un TTx depuis le domaine fermé, l'AC doit avoir reçu au préalable la demande de dégagement de l'ATTx, avec traçabilité.",
    },
    {
      label:
        "Aiguille à position obligée manœuvrée : CTx OU dépêche « pas de LAM sur la ZEP »",
      helpReference: "DC03969 § 8.1.4.2",
      helpText:
        "Manœuvre autorisée si un CTx le prévoit, OU s'il n'y a ni TTx ni LAM sur le domaine fermé (absence TTx dans la demande DFV ; absence LAM par dépêche « M…RPTx à AC…, il n'y a pas de LAM sur la ZEP… »). Remise en position obligée ensuite.",
    },
    {
      label:
        "Aiguille protégée par signal intermédiaire — conditions selon nombre de TTx",
      helpReference: "DC03969 § 8.1.4.4",
      helpText:
        "ZEP avec TTx unique sans fractionnement : manœuvre autorisée après autorisation d'engagement, sur demande RPTx avec maîtrise du risque de talonnage, ou après demande de dégagement. ZEP avec plusieurs TTx : conditions prévues par CTx.",
    },
    {
      label:
        "Interdiction : signal intermédiaire comme point de dégagement si plusieurs TTx",
      helpReference: "DC03969 § 8.2.4",
      helpText:
        "L'utilisation d'un signal intermédiaire comme point origine d'itinéraire de dégagement n'est autorisée que si la ZEP est desservie par un TTx unique. Cette mesure réduit le risque de dégagement intempestif du domaine fermé.",
    },
    {
      label:
        "TTx entre 2 ZEP contiguës : un seul RPTx ; sinon élargissement / rétrécissement",
      helpReference: "DC03969 § 8.2.5",
      helpText:
        "Passage d'un TTx d'une DFV à une autre interdit si les ZEP contiguës dépendent de RPTx distincts (sauf aléa géré par un dirigeant). Sur ZCh à cheval : CTx + CCTT dispense d'engagement / dégagement, sinon procédure d'élargissement / rétrécissement.",
    },
    {
      label: "Convoyage LAM via CCTT si mise en voie non directe",
      helpReference: "DC03969 § 8.5.1",
      helpText:
        "Procédure classique : mise en voie et hors voie des LAM directement après accord de la DFV. Si impossible, une CCTT « convoyage » précise la procédure d'acheminement depuis le point de mise en voie jusqu'à l'extrémité amont de la ZEP.",
    },
    {
      label:
        "Secours porté à un TTx : DSEC reçue, accompagnement ATTx obligatoire sur ZCh",
      helpReference: "DC03969 § 8.5.4",
      helpText:
        "Le conducteur établit la DSEC, transmise à l'AC via le RPTx. Le RPTx organise le secours, prend les mesures vis-à-vis des autres TTx, PN, TVP. L'accompagnement par un ATTx est obligatoire sur la ZCh pour respecter le mode déplacement-chantier.",
    },
    {
      label: "Engin moteur de secours électrique → appel au dirigeant",
      helpReference: "DC03969 § 8.5.4 / § 8.5.5 (encart)",
      helpText:
        "Dans le cas exceptionnel où l'engin moteur de secours est électrique, l'AC fait appel à son dirigeant avant d'organiser le secours (TTx ou circulation commerciale).",
    },
  ],

  "Vérifications préalables et/ou accord de la DFV": [
    {
      label: "Aide au bouclage sur IPCS : vérification du sens établi par AC + dépêche au RPTx",
      helpReference: "DC03969 § 8.5.3",
      helpText:
        "Pour simplifier le bouclage par le CCh, le RPTx peut demander à l'AC de vérifier le sens réellement établi après accord de la DFV. L'AC applique DC01567/68/69/70 et répond par dépêche : « AC à M… RPTx, l'intervalle A-B voie … est orienté en sens normal. »",
    },
    {
      label:
        "Signal participant à la protection d'une ZEP : ni intermédiaire ni annulable",
      helpReference: "DC03969 § 8.2.5 (encart avertissement)",
      helpText:
        "Un signal participant à la protection d'une ZEP ne peut pas être désigné comme signal intermédiaire ni être annulé. Cette règle est cardinale pour éviter d'ouvrir un accès non maîtrisé au domaine fermé.",
    },
    {
      label:
        "Engagement multiple : autorisation possible en une fois, ordre respecté selon le CTx",
      helpReference: "DC03969 § 8.2.3",
      helpText:
        "L'autorisation d'engagement du domaine fermé peut être donnée en une seule fois pour tous les TTx à engager. Les TTx sont ensuite engagés dans l'ordre prévu au CTx.",
    },
    {
      label:
        "Manœuvre vers domaine fermé sans engager : temps strictement nécessaire, mesures rétablies",
      helpReference: "DC03969 § 8.5.2",
      helpText:
        "Une manœuvre en direction d'un domaine fermé sans l'engager est autorisée sous réserve que ce dernier ne soit pas engagé. L'AC lève les mesures de protection pendant le temps strictement nécessaire, puis les rétablit.",
    },
    {
      label:
        "IPCS avec 2 AC distincts : sens normal exigé pour TTx derrière train ouvrant",
      helpReference: "DC03969 § 8.3.2",
      helpText:
        "Sur ligne IPCS dont les 2 extrémités de la ZEP sont commandées par des AC distincts, le train ouvrant doit circuler en sens normal. Idem TTx déclencheur. Sinon, vérification de libération a posteriori avant engagement à contresens.",
    },
  ],
};

// ─── Procédures à désactiver (soft-delete) ────────────────────────────────
const TO_SOFT_DELETE = [
  "Fin des travaux", // sous-ensemble de "Fin des travaux et/ou traçabilité"
  "NVNP : Ententes et fermeture de voie", // sous-ensemble de "DV : Ententes…"
];

async function main() {
  console.log(`\n=== Patch procédures Travaux (réf. ${VERSION}) ===\n`);

  // Étape 1 : soft-delete des redondances.
  for (const title of TO_SOFT_DELETE) {
    const proc = await prisma.procedure.findFirst({
      where: { title, domain: "Travaux sur les voies ou les IS" },
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

  // Étape 2 : enrichissement.
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const [title, items] of Object.entries(ENRICHMENTS)) {
    const proc = await prisma.procedure.findFirst({
      where: { title, domain: "Travaux sur les voies ou les IS" },
      select: { id: true, gravity: true },
    });
    if (!proc) {
      console.log(`\n  [skip procedure] "${title}" — introuvable`);
      continue;
    }

    // Prochain sortOrder = max existant + 1
    const last = await prisma.checklistItem.findFirst({
      where: { procedureId: proc.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let order = last ? last.sortOrder + 1 : 0;

    console.log(`\n  ▸ "${title}"`);

    for (const it of items) {
      // Idempotence : recherche par (procedureId, label).
      const existing = await prisma.checklistItem.findFirst({
        where: { procedureId: proc.id, label: it.label },
        select: { id: true, helpReference: true, helpText: true },
      });
      if (existing) {
        // S'il existe sans aide, on remplit. Sinon on saute.
        if (!existing.helpReference && !existing.helpText) {
          await prisma.checklistItem.update({
            where: { id: existing.id },
            data: {
              helpReference: it.helpReference,
              helpText: it.helpText,
            },
          });
          console.log(`    [help-only] ${it.label.slice(0, 60)}…`);
          totalSkipped++;
        } else {
          console.log(`    [skip] ${it.label.slice(0, 60)}…`);
          totalSkipped++;
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
      console.log(`    [add] ${it.label.slice(0, 60)}…`);
    }
  }

  console.log(
    `\n=== Terminé : ${totalAdded} items ajoutés, ${totalSkipped} items déjà présents ===\n`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
