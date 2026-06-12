/**
 * Patch idempotent — Incidents de circulation (DC01503 v5 du 07-10-2025).
 *
 * Architecture validée avec l'utilisateur : socle + spécialisations.
 *
 *   1) Socle : "Obstacles / Dangers" (existante) → enrichie avec les
 *      9 principes communs (§ 2 DC01503).
 *
 *   2) 9 nouvelles procédures spécialisées créées dans le domaine
 *      "Situations perturbées / Incidents", thème "Incidents de
 *      circulation". L'utilisateur sélectionne le socle + une
 *      spécialisation selon la nature de l'incident :
 *
 *        a) Incidents Passages à Niveau (Fiches 8, 8.1-8.5, 9, 9.1-9.2)
 *        b) Présence de personnes sur ou aux abords des voies
 *           (Fiches 10, 10.1-10.6)
 *        c) Émission du SAR — Signal d'Alarme Radio (Fiches 16, 16.1, 16.2)
 *        d) Anomalies de signalisation portée par les trains
 *           (Fiches 20, 20.1-20.7)
 *        e) Évacuation et transbordement train voyageurs (Fiches 12, 13)
 *        f) Dérive d'un train ou d'un véhicule (Fiche 19)
 *        g) Détection incendie dans un local d'IS (Fiche 22)
 *        h) Coupure d'urgence en cas de risque électrique (Fiche 23)
 *        i) Intervention des agents de la Sûreté Ferroviaire (Fiche 24)
 *
 *   3) Enrichissement de 3 procédures existantes :
 *        - Anomalie MD sur un train en circulation (Fiche 18)
 *        - Train circulant dans des conditions dangereuses (Fiche 17)
 *        - Franchissement des signaux (Fiche 21)
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-incidents.ts
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

const DOMAIN = "Situations perturbées / Incidents";
const THEME = "Incidents de circulation";

// ─── Procédures à créer ────────────────────────────────────────────────────
const NEW_PROCEDURES: NewProcedure[] = [
  // ───────────────────────────────────────────────────────────────────────
  // a) Incidents Passages à Niveau
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Incidents Passages à Niveau",
    theme: THEME,
    gravity: 3,
    risk: "Collision train/route, franchissement intempestif de PN, mise en danger d'usagers de la route.",
    documents: ["DC01503", "DC07202"],
    items: [
      {
        label: "Avis et alerte (conducteur, agent PN, régulateur)",
        helpReference: "DC01503 Fiche 8",
        helpText:
          "À la détection d'un incident PN, l'AC alerte les acteurs concernés : conducteur(s) approchant du PN, agent en charge du PN s'il existe, régulateur. L'ordre des avis dépend du type d'incident.",
      },
      {
        label: "Raté d'ouverture d'un PN à SAL",
        helpReference: "DC01503 Fiche 8.1",
        helpText:
          "Le PN reste fermé alors qu'aucun train n'est en approche. Procédure : vérification d'absence de circulation, ordre IN85 VEFE (vérification fonctionnement feux routiers) éventuel, marche prudente IE8 si nécessaire.",
      },
      {
        label: "Raté de fermeture d'un PN à SAL",
        helpReference: "DC01503 Fiche 8.2",
        helpText:
          "Le PN ne se ferme pas à l'approche d'un train. Mesures immédiates : arrêt du train concerné, sécurisation par agent dépêché, ordre IN83 RATO (marche prudente) jusqu'à dépannage.",
      },
      {
        label: "Bris de barrière d'un PN à SAL",
        helpReference: "DC01503 Fiche 8.3",
        helpText:
          "Une barrière du PN est brisée (heurt usager, vandalisme). Avis aux secours si dégâts corporels, ordre IN85 VEFE pour vérification feux routiers, gardiennage manuel jusqu'à remise en état.",
      },
      {
        label: "PN gardé indûment ouvert",
        helpReference: "DC01503 Fiche 8.4",
        helpText:
          "Un PN gardé reste ouvert alors qu'il devrait être fermé (oubli, défaillance agent). Arrêt immédiat des circulations concernées, désignation d'un agent pour gardiennage, enquête sur la cause.",
      },
      {
        label: "Dérangement des avertisseurs d'un PN gardé",
        helpReference: "DC01503 Fiche 8.5",
        helpText:
          "Les avertisseurs (sonnerie, feux) d'un PN gardé sont en dérangement. L'agent en charge maintient la fermeture du PN. Avis à l'AC et au mainteneur. Pas d'impact direct sur la circulation ferroviaire si gardé.",
      },
      {
        label: "Traitement des alarmes d'un PN télésurveillé (niveau 4)",
        helpReference: "DC01503 Fiche 9, 9.1, 9.2",
        helpText:
          "Alarmes de niveau 4 : défaut contrôle fermeture barrières (9.1) ou maintien à la fermeture (9.2). Procédure spécifique selon le type d'alarme : arrêt circulations, vérification de la cause, gardiennage temporaire si requis.",
      },
      {
        label: "Marche prudente IE8 / IN83 RATO selon le cas",
        helpReference: "DC01503 Fiches 8/9 + DC07202 IE8/IN83",
        helpText:
          "IE8 : autorisation de franchir un ou plusieurs PN en dérangement. IN83 RATO : raté d'ouverture ou bris de barrière (tous les feux fonctionnent) — marche prudente. Le choix dépend du type d'incident et de l'état des feux routiers.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // b) Présence de personnes sur ou aux abords des voies
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Présence de personnes sur ou aux abords des voies",
    theme: THEME,
    gravity: 4,
    risk: "Accident de personne, heurt ferroviaire, électrisation, traumatisme.",
    documents: ["DC01503"],
    items: [
      {
        label: "Détection et signalement (origine : conducteur, agent, tiers)",
        helpReference: "DC01503 Fiche 10 + § 2.1",
        helpText:
          "L'avis peut venir d'un conducteur (vu pendant la marche), d'un agent en gare, ou d'un tiers (témoin, riverain). L'AC accuse réception et lance immédiatement les premières mesures de protection.",
      },
      {
        label: "Accident de personne : arrêt circulations, secours, sécurisation",
        helpReference: "DC01503 Fiche 10.1",
        helpText:
          "Procédure prioritaire : arrêt immédiat de toutes les circulations sur la zone, demande de secours (15/18/112), désignation d'un agent dépêché sur place, préservation des indices, avis Sûreté Ferroviaire et DPx.",
      },
      {
        label: "Personne dans la Zone Dangereuse et y restant",
        helpReference: "DC01503 Fiche 10.2",
        helpText:
          "Personne identifiée dans la ZD (entrevoie, plateforme) qui ne quitte pas la zone. Mesures : arrêt circulations sur la voie concernée, alerte SUGE, dépêche d'un agent pour évacuer la personne. Ne pas reprendre la circulation tant que la ZD n'est pas dégagée.",
      },
      {
        label: "Personne hors ZD (ou engageant fugitivement la ZD)",
        helpReference: "DC01503 Fiche 10.3",
        helpText:
          "Personne aperçue hors ZD ou y engageant fugitivement (traversée). Avis aux conducteurs en approche pour vigilance accrue, marche prudente si nécessaire. Avis SUGE pour intervention.",
      },
      {
        label:
          "Voyageurs descendus d'un train arrêté hors quai ou partiellement à quai",
        helpReference: "DC01503 Fiche 10.5",
        helpText:
          "Présomption ou constatation de voyageurs descendus en pleine voie ou en queue de train arrêté partiellement à quai. Arrêt immédiat des circulations sur les voies concernées, sécurisation par le conducteur, transbordement organisé si nécessaire (Fiche 13).",
      },
      {
        label: "Personne en situation de danger sur un train en marche",
        helpReference: "DC01503 Fiche 10.6",
        helpText:
          "Personne signalée accrochée, suspendue ou en danger sur un train en marche. Arrêt du train concerné dès que possible (gare, signal), coordination avec le conducteur et l'entreprise ferroviaire, secours sur place.",
      },
      {
        label: "Coordination avec la Sûreté Ferroviaire (SUGE)",
        helpReference: "DC01503 Fiches 10, 24",
        helpText:
          "La présence de personnes dans les emprises ferroviaires donne lieu à une demande d'intervention SUGE. Coordination par l'AC, traçabilité de l'avis et de la prise en charge, suivi jusqu'à reprise circulation normale.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // c) Émission du SAR (Signal d'Alarme Radio)
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Émission du SAR (Signal d'Alarme Radio)",
    theme: THEME,
    gravity: 4,
    risk: "Collision, rattrapage, situation critique nécessitant arrêt général immédiat.",
    documents: ["DC01503", "DC07202"],
    items: [
      {
        label: "Détection de l'émission SAR par l'AC ou le conducteur",
        helpReference: "DC01503 Fiche 16",
        helpText:
          "Le SAR (Signal d'Alarme Radio) est un message d'urgence diffusé sur GSM-R demandant l'arrêt immédiat de toutes les circulations dans la zone. À sa détection, tous les conducteurs et AC concernés prennent immédiatement les mesures d'arrêt.",
      },
      {
        label: "Mesures immédiates : arrêt général des circulations dans la zone",
        helpReference: "DC01503 Fiche 16 + § 2.2",
        helpText:
          "L'AC arrête immédiatement toutes les circulations sur la zone d'émission du SAR. Les conducteurs en marche déclenchent un arrêt d'urgence. Aucune nouvelle expédition tant que le SAR n'est pas levé.",
      },
      {
        label: "SAR sur Lignes Conventionnelles (LC) — procédure spécifique",
        helpReference: "DC01503 Fiche 16.1",
        helpText:
          "Sur LC, la procédure SAR définit qui peut lever le SAR (régulateur, AC en charge), les vérifications préalables, et les conditions de reprise. Communication par tous les moyens disponibles (radio, téléphone).",
      },
      {
        label: "SAR sur Lignes à Grande Vitesse (LGV) — procédure spécifique",
        helpReference: "DC01503 Fiche 16.2",
        helpText:
          "Sur LGV, la procédure SAR tient compte des vitesses élevées et des distances de freinage importantes. Coordination avec le PAR (Poste d'Aiguillage et Régulation), vérifications spécifiques avant levée.",
      },
      {
        label: "Levée du SAR et reprise de la circulation",
        helpReference: "DC01503 Fiche 16 + § 2.6",
        helpText:
          "La levée du SAR n'est possible qu'après identification de la cause, vérification de l'absence de danger résiduel, et accord du responsable habilité. La reprise peut être normale ou avec restrictions selon le contexte.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // d) Anomalies de signalisation portée par les trains
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Anomalies de signalisation portée par les trains",
    theme: THEME,
    gravity: 3,
    risk: "Train non identifié, perte de visibilité, non-conformité réglementaire des feux du train.",
    documents: ["DC01503"],
    items: [
      {
        label:
          "Constitution réglementaire de la signalisation portée (avant/arrière)",
        helpReference: "DC01503 Fiche 20",
        helpText:
          "Un train doit porter une signalisation conforme : feux blancs à l'avant, feux rouges à l'arrière, selon les règles propres au type de circulation, à l'éclairage ambiant, et au régime (BM/BA). Toute anomalie déclenche un traitement spécifique.",
      },
      {
        label: "Extinction totale de la signalisation d'avant",
        helpReference: "DC01503 Fiche 20.1",
        helpText:
          "Pas de feux blancs visibles à l'avant du train. Procédure : avis au conducteur (si pas déjà au courant), arrêt du train à la gare suivante, vérification et remise en état avant repartir. Marche à vue éventuelle si la nuit.",
      },
      {
        label: "Signalisation d'avant ou d'arrière intempestive",
        helpReference: "DC01503 Fiche 20.2",
        helpText:
          "Présence de feux non réglementaires (feux rouges à l'avant, feux blancs à l'arrière, etc.). Arrêt du train pour correction, risque d'identification erronée par d'autres acteurs.",
      },
      {
        label:
          "Extinction partielle / absence partielle de la signalisation d'arrière",
        helpReference: "DC01503 Fiche 20.3",
        helpText:
          "Un seul feu rouge arrière visible (au lieu de deux) ou feu unique latéral manquant. Arrêt à la prochaine gare pour remise en état. Pas de marche à vue requise.",
      },
      {
        label: "Extinction totale de la signalisation d'arrière en BM",
        helpReference: "DC01503 Fiche 20.4",
        helpText:
          "Aucun feu rouge arrière visible sur un train circulant en Block Manuel (BM). Risque majeur : un autre train derrière pourrait ne pas voir le train ouvert. Arrêt immédiat possible, vérifications strictes avant repartir.",
      },
      {
        label: "Absence totale de la signalisation d'arrière en BM",
        helpReference: "DC01503 Fiche 20.5",
        helpText:
          "Aucun feu n'est présent (absence physique). Encore plus critique qu'une extinction. Procédure : arrêt immédiat, mise en place d'une signalisation de fortune (drapeau rouge, lampe rouge), respect strict des règles BM.",
      },
      {
        label: "Extinction ou absence totale de la signalisation d'arrière en BA",
        helpReference: "DC01503 Fiches 20.6 et 20.7",
        helpText:
          "En Block Automatique (BA), la signalisation auto-mécanique compense partiellement, mais l'anomalie reste à traiter. Procédure : avis circulations en suivi, arrêt à la prochaine gare, vérification et correction.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // e) Évacuation et transbordement train voyageurs
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Évacuation et transbordement train voyageurs",
    theme: THEME,
    gravity: 4,
    risk: "Accident de personne, heurt par train sur voie contiguë, panique, blessures lors d'évacuation.",
    documents: ["DC01503"],
    items: [
      {
        label: "Décision d'évacuation : critères et acteurs habilités",
        helpReference: "DC01503 Fiche 12",
        helpText:
          "L'évacuation d'un train de voyageurs est décidée par le conducteur en lien avec l'entreprise ferroviaire et l'AC. Critères : impossibilité de remise en marche, durée d'attente prolongée, danger sur le train (incendie, MD, etc.). Coordination obligatoire avant déclenchement.",
      },
      {
        label:
          "Sécurisation préalable des voies adjacentes (arrêt circulations, coupure caténaire si requis)",
        helpReference: "DC01503 Fiche 12",
        helpText:
          "Avant évacuation, l'AC doit obtenir l'arrêt des circulations sur la voie évacuée ET sur les voies contiguës (risque de heurt). Si évacuation par sol ferré, demande de consignation caténaire au RSS.",
      },
      {
        label: "Coordination des acteurs (conducteur, EF, EIC, secours, SUGE)",
        helpReference: "DC01503 Fiche 12",
        helpText:
          "Multiples acteurs à coordonner : conducteur (contact direct voyageurs), entreprise ferroviaire (information voyageurs), EIC (sécurisation voies), secours (15/18/112 si blessés), SUGE (sécurisation des emprises).",
      },
      {
        label: "Transbordement vers un autre train : conditions et organisation",
        helpReference: "DC01503 Fiche 13",
        helpText:
          "Le transbordement vers un autre train (en gare ou en pleine voie) est une alternative à l'évacuation. Conditions : train d'accueil compatible (longueur, accès), accord des entreprises ferroviaires, sécurisation du transfert.",
      },
      {
        label: "Vérification reprise complète des voyageurs avant reprise circulation",
        helpReference: "DC01503 Fiches 12, 13",
        helpText:
          "Après évacuation ou transbordement, vérification systématique qu'aucun voyageur n'est resté sur la voie ou dans le train évacué. Comptage si possible, inspection visuelle, confirmation par conducteur et accompagnant. Reprise circulation conditionnée.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // f) Dérive d'un train ou d'un véhicule
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Dérive d'un train ou d'un véhicule",
    theme: THEME,
    gravity: 4,
    risk: "Collision, déraillement, dégâts matériels et corporels en aval.",
    documents: ["DC01503"],
    items: [
      {
        label: "Détection et signalement immédiat de la dérive",
        helpReference: "DC01503 Fiche 19",
        helpText:
          "Une dérive est le départ involontaire d'un train ou véhicule (rupture d'attelage, frein desserré, déclive forte). Détection par conducteur, agent en gare, ou contrôle système (TTC). Avis immédiat à l'AC et au régulateur.",
      },
      {
        label: "Mesures de protection en aval (arrêt circulations, sablage, etc.)",
        helpReference: "DC01503 Fiche 19",
        helpText:
          "Premières mesures : arrêt de toutes les circulations sur la voie en aval, alerte des AC des gares avales, déclenchement éventuel de dispositifs de sablage ou de talonnage. Objectif : limiter la distance parcourue par le train dérivé.",
      },
      {
        label: "Arrêt de toutes circulations sur la zone potentiellement impactée",
        helpReference: "DC01503 Fiche 19",
        helpText:
          "Zone à arrêter : toute la section en aval jusqu'à un point d'arrêt naturel (gare avec heurtoir, pente positive). Arrêt aussi des circulations en sens inverse sur voie contiguë si risque d'éboulement.",
      },
      {
        label: "Vérification dégagement avant reprise circulation",
        helpReference: "DC01503 Fiche 19 + § 2.6",
        helpText:
          "Après arrêt de la dérive : reconnaissance du parcours, vérification de l'absence de dégâts (voie, caténaire, signalisation), récupération du train dérivé. La reprise n'est autorisée qu'après confirmation d'intégrité.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // g) Détection incendie dans un local d'IS
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Détection incendie dans un local d'IS",
    theme: THEME,
    gravity: 4,
    risk: "Perte d'IS critiques (poste, signalisation), propagation, indisponibilité de signalisation.",
    documents: ["DC01503"],
    items: [
      {
        label: "Détection et alerte (capteurs, agent sur place)",
        helpReference: "DC01503 Fiche 22",
        helpText:
          "La détection peut venir d'une alarme incendie automatique du local, d'un agent sur place, ou d'une remontée d'un tiers. Avis immédiat aux secours (18/112), à l'AC, au mainteneur, et au régulateur.",
      },
      {
        label: "Mesures de protection (arrêt circulations selon impact IS)",
        helpReference: "DC01503 Fiche 22",
        helpText:
          "Si l'incendie impacte des IS critiques (poste d'aiguillage, signalisation), arrêt des circulations sur les voies concernées. Sinon, vigilance accrue et maintien sous condition. La portée de l'arrêt dépend de l'IS touchée.",
      },
      {
        label: "Coupure électrique éventuelle (caténaire, alimentation poste)",
        helpReference: "DC01503 Fiche 22",
        helpText:
          "Si le local abrite des équipements sous tension, demander la coupure d'alimentation au RSS avant intervention des pompiers. Pour la caténaire passant à proximité, consignation possible si risque électrique pour secours.",
      },
      {
        label: "Coordination secours et reprise après extinction",
        helpReference: "DC01503 Fiche 22",
        helpText:
          "Coordination avec les pompiers : accès au local, conditions d'intervention. Reprise circulation conditionnée à : extinction confirmée, vérification IS (test de fonctionnement), accord du mainteneur sur l'état post-incendie.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // h) Coupure d'urgence en cas de risque électrique
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Coupure d'urgence en cas de risque électrique",
    theme: THEME,
    gravity: 4,
    risk: "Électrisation, électrocution, incendie d'origine électrique.",
    documents: ["DC01503"],
    items: [
      {
        label: "Identification du risque (caténaire au sol, court-circuit, etc.)",
        helpReference: "DC01503 Fiche 23",
        helpText:
          "Risques typiques : caténaire tombée au sol, court-circuit visible, équipement émetteur d'arc électrique, présence d'eau près d'équipements sous tension. La détection peut venir d'un conducteur, d'un agent, ou d'un tiers.",
      },
      {
        label: "Demande de coupure d'urgence au RSS / Dispatching",
        helpReference: "DC01503 Fiche 23",
        helpText:
          "L'AC demande immédiatement la coupure au RSS (Régulateur Sous-Station) avec identification précise de la portion à couper (gare, intervalle, ligne). Texte de la demande : « AC X à RSS : coupure d'urgence sur [zone] pour [motif] à ..h..mn ».",
      },
      {
        label: "Mesures complémentaires (arrêt circulations, gardiennage zone)",
        helpReference: "DC01503 Fiche 23",
        helpText:
          "En complément de la coupure : arrêt de toutes les circulations sur la zone affectée (la coupure ne suffit pas — circulations à l'arrêt peuvent rester sous tension par induction), gardiennage par agent dépêché, signalisation visuelle si possible.",
      },
      {
        label: "Reprise après confirmation absence de risque et remise sous tension",
        helpReference: "DC01503 Fiche 23 + § 2.6",
        helpText:
          "La reprise nécessite : confirmation par RSS de la remise sous tension, vérification que la cause initiale est résolue (réparation, intervention mainteneur), accord du dirigeant compétent. Reprise circulations selon modalités habituelles.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // i) Intervention des agents de la Sûreté Ferroviaire (SUGE)
  // ───────────────────────────────────────────────────────────────────────
  {
    title: "Intervention des agents de la Sûreté Ferroviaire (SUGE)",
    theme: THEME,
    gravity: 2,
    risk: "Mauvaise coordination, retard d'intervention, perte de traçabilité.",
    documents: ["DC01503"],
    items: [
      {
        label: "Conditions de demande d'intervention SUGE",
        helpReference: "DC01503 Fiche 24",
        helpText:
          "Demande SUGE motivée par : présence de tiers dans les emprises, malveillance, accident de personne, tir/jet de projectiles, comportement suspect, voyageur en situation de danger. La demande est faite par l'AC ou le régulateur.",
      },
      {
        label: "Coordination AC ↔ SUGE pendant l'intervention",
        helpReference: "DC01503 Fiche 24",
        helpText:
          "Pendant l'intervention SUGE, l'AC reste en contact avec les agents sur place pour : autorisation d'accès aux voies (avec mesures de protection si ZD), information sur les circulations à arrêter, échange de renseignements pour la traçabilité de l'incident.",
      },
      {
        label: "Traçabilité de l'intervention (carnet de dépêches, main courante)",
        helpReference: "DC01503 Fiche 24 + § 2.5",
        helpText:
          "Toute intervention SUGE est tracée : heure de la demande, motif, agents intervenants, heure de fin d'intervention, conclusions. Inscription au carnet de dépêches et à la main courante. Préservation des éléments pour enquête éventuelle.",
      },
    ],
  },
];

// ─── Enrichissements de procédures existantes ─────────────────────────────
const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // Socle : Obstacles / Dangers (+9 items principes § 2)
  // ───────────────────────────────────────────────────────────────────────
  "Obstacles / Dangers": [
    {
      label: "Connaissance d'un obstacle / danger / présomption (origine variée)",
      helpReference: "DC01503 § 2.1",
      helpText:
        "L'avis d'obstacle/danger peut venir de multiples sources : conducteur (en marche), agent en gare, mainteneur, tiers (témoin, riverain), capteur automatique. L'AC accuse réception immédiatement et qualifie le niveau de certitude (obstacle avéré vs présomption).",
    },
    {
      label:
        "Mesures immédiates de protection (arrêt circulations, alerte, sécurisation)",
      helpReference: "DC01503 § 2.2",
      helpText:
        "Premières actions à exécuter en parallèle : arrêt des circulations concernées (signal ou ordre), alerte des conducteurs en approche, sécurisation de la zone (agent dépêché, ZE), avis aux dirigeants. L'ordre dépend de l'urgence et du contexte.",
    },
    {
      label: "Ordre d'avis à lancer (régulateur, RPTx, dirigeants, autorités)",
      helpReference: "DC01503 § 2.3",
      helpText:
        "Hiérarchie d'avis à respecter : régulateur (priorité circulations), RPTx si chantier impacté, dirigeants compétents (DPx, COGC), autorités externes si nécessaire (police, secours, autorités). L'ordre dépend de la nature de l'incident.",
    },
    {
      label: "Intervention des personnes avisées : rôles et coordination",
      helpReference: "DC01503 § 2.4",
      helpText:
        "Chaque personne avisée a un rôle spécifique : régulateur (réorganisation circulations), DPx (décisions stratégiques), mainteneur (réparation), secours (sauvetage), SUGE (sécurisation emprises). L'AC coordonne et trace les échanges.",
    },
    {
      label: "Prise en attachement de l'incident sur l'état de circulation",
      helpReference: "DC01503 § 2.5",
      helpText:
        "L'incident est pris en attachement : heure de détection, nature, zone impactée, mesures prises, acteurs avisés. Inscription sur l'état de circulation ET sur le carnet de dépêches. Cette traçabilité est obligatoire pour enquête ultérieure.",
    },
    {
      label: "Conditions de reprise de la circulation (normale vs avec restriction)",
      helpReference: "DC01503 § 2.6",
      helpText:
        "Reprise possible après : cause de l'incident résolue, vérification de l'absence de danger résiduel, accord du dirigeant compétent. Peut être normale (aucune restriction) ou avec restriction (limitation vitesse, marche à vue, ordre IN41 OCAR).",
    },
    {
      label:
        "Cas particulier — épandage de produits phytopharmaceutiques sur parcelle",
      helpReference: "DC01503 § 2.7",
      helpText:
        "Cas spécifique introduit dans v5 du 07-10-2025 : intervention dans une parcelle venant de faire l'objet d'un épandage de produits phytopharmaceutiques. Délais d'attente et EPI spécifiques à respecter pour le personnel intervenant.",
    },
    {
      label: "Utilisation des fiches DC01503 selon le type d'incident",
      helpReference: "DC01503 § 2.8",
      helpText:
        "Le DC01503 contient ~40 fiches par type d'incident. L'AC identifie le type, sélectionne la fiche applicable (3 Obstacle, 4 Danger, 16 SAR, 19 Dérive, etc.), et applique le protocole spécifique. Plusieurs fiches peuvent s'appliquer en parallèle.",
    },
    {
      label: "Utilisation d'ODICEO — système d'aide à la décision incidents",
      helpReference: "DC01503 § 2.9",
      helpText:
        "ODICEO est l'outil digital d'aide à la décision pour les incidents. L'AC y consigne les éléments clés, y consulte les procédures applicables, et y trace son traitement. Ne remplace pas le DC01503 mais l'opérationnalise.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Anomalie MD sur un train en circulation (+3 items, Fiche 18)
  // ───────────────────────────────────────────────────────────────────────
  "Anomalie MD sur un train en circulation": [
    {
      label: "Mesures de protection spécifiques aux Matières Dangereuses",
      helpReference: "DC01503 Fiche 18",
      helpText:
        "Selon le type de MD (radioactif, explosif, toxique, inflammable), périmètre de sécurité à mettre en place, distance d'évacuation, et coordination avec acteurs spécialisés (CMIR pour le nucléaire, pompiers spécialisés).",
    },
    {
      label: "Avis spécifique au responsable Transport MD de l'entreprise ferroviaire",
      helpReference: "DC01503 Fiche 18",
      helpText:
        "En cas d'anomalie MD, avis prioritaire au responsable Transport MD de l'entreprise ferroviaire (qui dispose des fiches de sécurité du chargement). L'EF mobilise ses moyens propres (intervention spécialisée).",
    },
    {
      label: "Distinction du type d'événement (Type 1 / Type 2) et niveau de gravité",
      helpReference: "DC01503 Fiche 18",
      helpText:
        "Type 1 : fuite, dégagement, suspicion d'avarie sans rupture confinement. Type 2 : avec rupture/risque imminent. Le niveau de gravité détermine l'ampleur des mesures (arrêt local vs arrêt général + évacuation).",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Train circulant dans des conditions dangereuses (+3 items, Fiche 17)
  // ───────────────────────────────────────────────────────────────────────
  "Train circulant dans des conditions dangereuses": [
    {
      label:
        "Mesures spécifiques en cas d'alarme DBC (Détecteur de Boîte Chaude)",
      helpReference: "DC01503 Fiche 17 + Fiche 18",
      helpText:
        "Alarme DBC = échauffement anormal d'un essieu. Procédure : avis conducteur, ralentissement ou arrêt à la prochaine gare, inspection visuelle, décision de continuer (avec restriction) ou de retirer le wagon en cause.",
    },
    {
      label:
        "Reprise de la circulation avec restrictions (ordre IN41 OCAR, marche à vue)",
      helpReference: "DC01503 Fiche 17 + DC07202 IN41",
      helpText:
        "Si conditions dangereuses confirmées et train autorisé à continuer : remise d'un IN41 OCAR au conducteur (ordre de circuler avec restriction — vitesse, signalisation, etc.). Tracé sur carnet d'ordres.",
            },
    {
      label:
        "Critères de retrait du train de la circulation (impossibilité de remise en marche sécurisée)",
      helpReference: "DC01503 Fiche 17",
      helpText:
        "Si les conditions dangereuses ne permettent pas une remise en marche sécurisée (avarie majeure, MD, risque incendie), retrait du train : garage dans une gare, attente d'un secours, ou évacuation voyageurs si train commercial.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Franchissement des signaux (+1 item, Fiche 21)
  // ───────────────────────────────────────────────────────────────────────
  "Franchissement des signaux": [
    {
      label: "Franchissement intempestif d'un signal d'arrêt fermé — protocole",
      helpReference: "DC01503 Fiche 21",
      helpText:
        "Un train a franchi un signal d'arrêt fermé sans autorisation. Procédure : arrêt immédiat du train, vérification absence de collision/dégât, recueil de témoignages conducteur, déclenchement enquête (TTC, REX). Avis au CSE et aux responsables sécurité.",
    },
  ],
};

async function main() {
  console.log(
    `\n=== Patch incidents (DC01503 v5 du 07-10-2025) ===\n`
  );

  // Étape 1 : création des 9 nouvelles procédures.
  console.log("--- Création des procédures spécialisées ---");
  let proceduresCreated = 0;
  let proceduresSkipped = 0;

  for (const np of NEW_PROCEDURES) {
    const existing = await prisma.procedure.findFirst({
      where: { title: np.title, domain: DOMAIN },
      select: { id: true, isActive: true },
    });

    let procId: string;
    if (existing) {
      procId = existing.id;
      proceduresSkipped++;
      console.log(`  [skip] "${np.title}" — existe déjà (id=${procId})`);
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
      proceduresCreated++;
      console.log(`  [create] "${np.title}" (G${np.gravity})`);
    }

    // Insertion des items de la procédure
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
        select: { id: true, helpReference: true, helpText: true },
      });
      if (itemExists) {
        if (!itemExists.helpReference && !itemExists.helpText) {
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
    if (itemsAdded > 0) {
      console.log(`    → ${itemsAdded} items ajoutés`);
    }
  }

  // Étape 2 : enrichissement des procédures existantes.
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
        select: { id: true, helpReference: true, helpText: true },
      });
      if (existing) {
        if (!existing.helpReference && !existing.helpText) {
          await prisma.checklistItem.update({
            where: { id: existing.id },
            data: {
              helpReference: it.helpReference,
              helpText: it.helpText,
            },
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

  console.log(
    `\n=== Terminé : ${proceduresCreated} procédures créées, ${proceduresSkipped} existaient déjà, ${totalAdded} items ajoutés aux procédures existantes ===\n`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
