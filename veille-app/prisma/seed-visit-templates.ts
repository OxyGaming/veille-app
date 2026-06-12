/**
 * Templates de visite de site — issus directement des PDF fournis.
 *
 * 1) Visite trimestrielle incendie (IMO00301)  : PER_ITEM (Oui / Non / Sans objet)
 * 2) Visite planifiée EIC Rhône-Alpes (RH00003) : PER_SECTION (Conforme / Non conforme / Sans objet)
 *
 * Le `metaSchema` reste vide en V1 — on saisit juste date + site.
 * Les autres champs (RSI, CLSI, COSI, N° UT, distribution, traçabilité…)
 * sont prévus en V2 via cet enum.
 */

export type SeedTemplate = {
  slug: string;
  name: string;
  description: string;
  pdfLayout: "VEILLE" | "SNCF";
  sections: SeedSection[];
};
export type SeedSection = {
  title: string;
  icon?: string;
  evalMode: "PER_ITEM" | "PER_SECTION";
  category?: string;
  /** Texte fixe affiché dans la colonne "Précisions" du PDF SNCF. */
  precisions?: string;
  items: string[];
};

export const TEMPLATE_TRIMESTRIELLE: SeedTemplate = {
  slug: "trimestrielle-incendie",
  name: "Visite trimestrielle incendie",
  description:
    "Rapport de visite trimestrielle des moyens de secours et installations incendie (référentiel SNCF Immobilier IMO00301).",
  pdfLayout: "SNCF",
  sections: [
    {
      title: "Extincteurs",
      icon: "🧯",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: [
        "Accès dégagé",
        "État général (scellé goupille, présence goupille, cuve, flexible, lance)",
        "Visibilité / numérotation",
        "Bon état du support",
        "Entretien (moins de 12 mois avec une tolérance de ± 2 mois)",
      ],
    },
    {
      title: "Robinets Incendie Armés",
      icon: "🚿",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: [
        "Accès dégagé",
        "État général (dévidoir, tuyau, lance, robinet, vanne)",
        "Visibilité",
        "Entretien (moins de 12 mois)",
      ],
    },
    {
      title: "Poteaux / Bouches Incendie",
      icon: "💧",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: ["Accès dégagé", "Visibilité", "État général", "Alimentation en eau"],
    },
    {
      title: "Système Sécurité Incendie — Alarme",
      icon: "🚨",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: [
        "Bon état des déclencheurs manuels",
        "Absence de voyant défaut sur la centrale (tableau de signalisation, ECS, unité de signalisation…)",
      ],
    },
    {
      title: "Éclairage de sécurité",
      icon: "💡",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: [
        "Veilleuse allumée",
        "Blocs SATI : contrôle visuel voyant test vert",
        "Blocs simples : disjoncter l'éclairage et vérifier l'allumage (visites mensuelles pour les BAES — arrêté du 14/12/2011)",
      ],
    },
    {
      title: "Porte coupe-feu",
      icon: "🚪",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: [
        "État général (porte, joints, éléments de guidage, fixations…)",
        "Portes non bloquées en position ouverte",
      ],
    },
    {
      title: "Dégagements, circulations, issues",
      icon: "🏃",
      evalMode: "PER_ITEM",
      category: "Évacuation",
      items: [
        "Absence d'obstacles dans les dégagements et circulations",
        "Issues dégagées et facilement manœuvrables (pas de clef)",
      ],
    },
    {
      title: "Consignes — Plans — Registre",
      icon: "📋",
      evalMode: "PER_ITEM",
      category: "Documentation",
      items: [
        "Consignes incendie affichées et à jour",
        "Plan d'évacuation affiché et à jour",
        "Registre de sécurité présent et à jour",
      ],
    },
    {
      title: "Autres moyens de lutte contre l'incendie",
      icon: "🔥",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: ["Présence du matériel (ex. bac à sable)", "Accès dégagé", "État général"],
    },
    {
      title: "Désenfumage",
      icon: "🌬️",
      evalMode: "PER_ITEM",
      category: "Incendie",
      items: ["Accès des commandes dégagé", "Visibilité", "État général"],
    },
    {
      title: "Utilisation appareils électriques d'appoint",
      icon: "⚡",
      evalMode: "PER_ITEM",
      category: "Électrique",
      items: ["Chauffage", "Climatiseur", "Rallonge"],
    },
  ],
};

export const TEMPLATE_PLANIFIEE: SeedTemplate = {
  slug: "planifiee-eic-ra",
  name: "Visite planifiée — EIC Rhône-Alpes",
  description:
    "Visite planifiée de site (poste, chantier) — référentiel EIC RA RH00003 : poste de travail, incendie, électrique, prévention, coactivité, véhicules, EPI, environnement.",
  pdfLayout: "VEILLE",
  sections: [
    // === 1 - Poste de travail ===
    {
      title: "Ergonomie du poste",
      icon: "🪑",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      items: [
        "Éclairage individuel présent et en état",
        "Luminosité suffisante (éclairage naturel)",
        "Dispositifs occultants aux fenêtres présents et en bon état (volets, stores, rideaux…)",
        "Éclairage artificiel adapté",
        "Agencement des locaux adapté à l'activité",
        "Mobilier bien disposé",
        "Armoires, vestiaires suffisants et en bon état",
        "Bureaux, tables, chaises, fauteuils suffisants et en bon état",
        "Portes et fenêtres en bon état et se manœuvrant facilement",
        "Ouverture en étage sécurisée (garde-corps ou limitateur d'ouverture)",
        "Ambiance sonore (conversation facilement audible)",
        "Aucun stockage au-dessus des armoires",
        "Rangement correct (absence de matériel inutile ou obsolète, hors d'usage, extérieur à l'entreprise…)",
      ],
    },
    {
      title: "Chauffage / Ventilation / Climatisation / Fontaine à eau",
      icon: "🌡️",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      items: [
        "Système de climatisation (ou de rafraîchissement d'air) adapté",
        "Système de chauffage adapté",
        "Maintenance annuelle réalisée : rapports (CVC) et émargements registre incendie ou sur appareils",
        "CVC et fontaine à eau fonctionnent correctement, bon état général, propres",
        "Régulation thermique hiver/été suffisante (avis agent)",
        "Bonne isolation",
        "Si ascenseur : bon état et maintenance effectuée",
      ],
    },
    {
      title: "Moyens de secours aux personnes",
      icon: "🚑",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      precisions: "Contenu repris dans le GRH0003",
      items: [
        "Signalétique de repérage de la trousse de secours visible",
        "Trousse accessible facilement",
        "Contenu conforme",
        "Produits non périmés",
        "Feuille de suivi présente et remplie",
        "Emplacement de la trousse connu des agents",
      ],
    },
    {
      title: "Document Unique",
      icon: "📄",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      items: [
        "Document Unique de A-1 présent et complet (y compris RPS)",
        "Ou affiche indiquant l'adresse pour accéder à la PST présente",
      ],
    },
    {
      title: "Affichage obligatoire",
      icon: "📌",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      items: [
        "Panneau d'affichage obligatoire présent dans le poste",
        "Panneau accessible",
        "Panneau à jour : coordonnées DPX, emplacement trousse de secours, extincteurs, organes de coupure, liste SST et n° d'appels",
        "Politique sécurité à jour",
        "Affiche RQS présente",
        "OTS affiché en poste",
        "Les agents connaissent les informations affichées",
      ],
    },
    {
      title: "Cheminement dans les locaux",
      icon: "🚶",
      evalMode: "PER_SECTION",
      category: "Poste de travail",
      items: [
        "Aires de circulation totalement dégagées (pas de stockage, pas de câbles non protégés)",
        "Sol en bon état",
        "Éclairage suffisant",
        "Obstacles et dangers signalés",
        "Si escaliers : marches en bon état",
        "Rampe présente et en bon état",
        "Cage d'escalier totalement désencombrée (y compris sous les escaliers)",
      ],
    },
    // === 2 - Locaux Incendie ===
    {
      title: "Affichage sécurité incendie",
      icon: "🚨",
      evalMode: "PER_SECTION",
      category: "Incendie",
      precisions:
        "La consigne incendie simplifiée est intégrée dans le panneau d'affichage obligatoire.",
      items: [
        "Plan d'évacuation, s'il existe, à jour",
        "Informations relatives à l'incendie à jour : type et emplacement des extincteurs et organes de coupure sur le panneau d'affichage obligatoire",
        "Les agents connaissent les mesures à prendre en cas d'incendie et les modalités d'évacuation",
      ],
    },
    {
      title: "Documentation sécurité incendie",
      icon: "📚",
      evalMode: "PER_SECTION",
      category: "Incendie",
      precisions:
        "Registre incendie ou registre de suivi des installations incendie si EIC non RSI.",
      items: [
        "Registre incendie accessible",
        "Registre à jour : coordonnées occupants, occupation bâtiment, emplacement extincteurs, feuille d'émargement de l'année, liste agents formés",
        "Registre émargé par les entreprises de maintenance",
        "Tous les agents ont reçu la formation sécurité incendie (validité 5 ans)",
      ],
    },
    {
      title: "Visite sécurité incendie annuelle",
      icon: "🧯",
      evalMode: "PER_SECTION",
      category: "Incendie",
      items: [
        "Vérification des extincteurs tracée sur l'extincteur et dans le registre",
        "Vérification de la centrale incendie tracée + rapport présent",
        "Vérification du DAAF (si présent dans le poste, à tracer dans le registre)",
        "Poteaux incendie indiqués + rapport annuel présent",
      ],
    },
    {
      title: "Visite incendie trimestrielle",
      icon: "🔥",
      evalMode: "PER_SECTION",
      category: "Incendie",
      items: [
        "Extincteurs aux bons emplacements, bien fixés",
        "Extincteurs accessibles",
        "Bon état général des extincteurs (présence goupille et scellé, flexibles)",
        "Signalétique présente",
        "BAES en état de fonctionnement (vérifier la LED de veille)",
        "Absence de stockage dans les dégagements (couloirs, escaliers, y compris dessous)",
        "Les agents présents sont ceux prévus et nécessaires à l'activité",
      ],
    },
    // === 2 - Locaux Incendie / Électrique ===
    {
      title: "Vérification annuelle électrique",
      icon: "⚡",
      evalMode: "PER_SECTION",
      category: "Électrique",
      items: [
        "Rapport VRE présent",
        "Rapport de MEC présent",
        "Registre incendie émargé par les entreprises extérieures",
      ],
    },
    {
      title: "Installations électriques",
      icon: "🔌",
      evalMode: "PER_SECTION",
      category: "Électrique",
      items: [
        "Multiprises absentes",
        "Câbles électriques sans protection absents",
        "Câbles agencés correctement",
        "Prise et interrupteurs en bon état",
        "Accès à l'armoire électrique fermé",
        "Flèche de Jupiter présente sur l'armoire électrique",
        "Appareils en bon état général, absence de dommages",
        "Présence uniquement d'appareils prévus pour l'activité et fournis par l'entreprise",
      ],
    },
    // === 2 - Locaux Prévention ===
    {
      title: "Pistes et itinéraires",
      icon: "🛤️",
      evalMode: "PER_SECTION",
      category: "Prévention",
      precisions: "Consignes de particularités locales.",
      items: [
        "Schéma présent et à jour",
        "Pistes et itinéraires en bon état",
        "Traversées piétons en bon état",
        "Éclairage suffisant",
      ],
    },
    {
      title: "Produits psychoactifs (dispositifs de dépistage)",
      icon: "🧪",
      evalMode: "PER_SECTION",
      category: "Prévention",
      items: [
        "4 éthylotests (2 × 0,5 g/l, 2 × 0,25 g/l) présents dans la trousse de secours",
        "2 tests salivaires drogue (THC) présents",
        "Dates de péremption non dépassées",
      ],
    },
    {
      title: "Alcool",
      icon: "🚫",
      evalMode: "PER_SECTION",
      category: "Prévention",
      items: [
        "Boisson alcoolisée et drogues absentes",
        "Autocollant interdiction de stocker de l'alcool collé sur le frigo",
        "Les agents connaissent la réglementation / RPPA",
      ],
    },
    {
      title: "Matériel et produits divers",
      icon: "🧰",
      evalMode: "PER_SECTION",
      category: "Prévention",
      items: [
        "Échelles, escabeaux, marchepieds en bon état et sécurisés (patins antidérapants…)",
        "Climatisation portative en bon état",
        "Chauffage d'appoint en bon état + autorisation écrite du DET",
        "FDS pour les produits chimiques mis à disposition présentes",
        "Produits chimiques nécessaires et prévus pour l'activité",
        "Les agents connaissent l'emplacement des FDS",
        "Les agents connaissent les risques liés aux produits chimiques",
        "Pas de produits sans étiquette ou dans un mauvais contenant",
        "Stockage des produits chimiques/dangereux dans armoire spécifique fermée",
        "Absence de matériel personnel pouvant remettre en cause la sécurité (TV, téléphone perso, PC perso…)",
      ],
    },
    // === 2 - Coactivité ===
    {
      title: "Travaux EE — Inspection Commune Préalable",
      icon: "🚧",
      evalMode: "PER_SECTION",
      category: "Coactivité",
      items: [
        "ICP des opérations annuelles réalisées pour l'année en cours (Ménage, VRE, MEC, Maintenance multi-technique, ABE…)",
      ],
    },
    {
      title: "Travaux EE — Plan de prévention",
      icon: "📑",
      evalMode: "PER_SECTION",
      category: "Coactivité",
      items: [
        "Plans de prévention en cours présents et mis à disposition",
        "Mesures de prévention respectées",
        "Connaissance par les occupants des mesures de prévention",
      ],
    },
    {
      title: "Opérations de chargement / déchargement / livraison gaz, fioul",
      icon: "🚚",
      evalMode: "PER_SECTION",
      category: "Coactivité",
      items: [
        "Protocole de sécurité rédigé si nécessaire et mis à disposition",
        "Connaissance par le personnel des mesures de prévention",
      ],
    },
    {
      title: "Propreté des locaux et hygiène",
      icon: "🧹",
      evalMode: "PER_SECTION",
      category: "Hygiène",
      items: [
        "Propreté des locaux (y compris sanitaires et réfectoires)",
        "Éviers et WC suffisants (mixité + nombre d'agents) et en bon état",
        "Appareils électroménagers propres (frigo, cuisson…)",
        "Douches non utilisées condamnées",
        "Plafonds en bon état (dalles, peintures…)",
        "Murs en bon état (peintures…)",
      ],
    },
    {
      title: "Amiante",
      icon: "⚠️",
      evalMode: "PER_SECTION",
      category: "Coactivité",
      precisions: "Sans objet pour les bâtiments construits après 2000.",
      items: [
        "Fiche Récapitulative Amiante accessible",
        "Dossier Technique Amiante accessible",
      ],
    },
    // === 3 - Locaux de graissage (uniquement si site.hasGreasingArea) ===
    {
      title: "Sécurité incendie (graissage)",
      icon: "🧯",
      evalMode: "PER_SECTION",
      category: "Graissage",
      items: [
        "Extincteur à poudre présent et accessible",
        "Extincteur conforme",
        "BAES présents et en état",
        "Vérifications annuelles",
        "Consigne incendie présente et à jour",
      ],
    },
    {
      title: "Équipement du local (graissage)",
      icon: "🛢️",
      evalMode: "PER_SECTION",
      category: "Graissage",
      items: [
        "FDS présentes et à jour",
        "Notices de poste affichées et à jour",
        "Absence de produits alimentaires et de lieux de prise de repas dans le local de stockage et de manipulation de la graisse",
        "Affichages sur les obligations et les interdictions présents",
        "EPI présents et en état (lunettes + gants)",
        "Produits chimiques stockés sur bacs de rétention",
        "Sol de la zone de stockage propre et imperméable",
        "Produits inflammables stockés dans une armoire de sécurité",
      ],
    },
    {
      title: "Ventilation / Aération (graissage)",
      icon: "💨",
      evalMode: "PER_SECTION",
      category: "Graissage",
      items: [
        "Présence d'une ventilation haute et d'une ventilation basse",
      ],
    },
    {
      title: "Gestion des déchets de l'activité graissage",
      icon: "♻️",
      evalMode: "PER_SECTION",
      category: "Graissage",
      items: [
        "Documentation et moyens",
        "Contenant spécifique pour chiffons souillés",
        "Retrait des déchets (plateformes de traitement de déchets INFP, EISE, EIC)",
      ],
    },
    // === 4 - Véhicules de service ===
    {
      title: "Véhicules d'entreprise",
      icon: "🚐",
      evalMode: "PER_SECTION",
      category: "Véhicules",
      items: [
        "Bon état général du véhicule (feux, pneus, rétroviseurs…)",
        "Équipements de sécurité et agrès présents (gilet jaune, triangle, roue de secours ou kit)",
        "Documents réglementaires présents et en cours de validité",
        "Kit de signalement des dangers présent et complet",
        "Interdictions de fumer, vapoter, téléphoner, conduire au-delà de 18h d'éveil présentes",
        "4 éthylotests (2 × 0,5 g/l + 2 × 0,2 g/l) présents et non périmés",
        "Les agents possèdent leur autorisation de conduite en service",
        "Les agents connaissent les points de vérification avant départ",
        "Trousse de secours conforme",
        "Règles de transport produits chimiques respectées et véhicule équipé (bac de rétention + sangles)",
        "FDS et notices de poste présentes (VS graisseurs)",
      ],
    },
    // === 5 - EPI ===
    {
      title: "EPI (EIC RA RH00003)",
      icon: "🦺",
      evalMode: "PER_SECTION",
      category: "EPI",
      precisions:
        "L'EIC RA RH00003 reprend les situations nécessitant le port des EPI ainsi qu'en annexe les points à vérifier.",
      items: [
        "Gilet HV présent et en bon état",
        "Casque présent et en bon état (durée de vie 5 ans non dépassée) + coiffes de propreté si casque collectif",
        "2 kits d'intervention d'urgence (passage train désherbeur)",
        "THV en bon état",
        "Masques de fuite présents à Sibelin (péremption, état)",
        "Chaussures ou sur-chaussures de sécurité présentes et en bon état",
        "Gants présents et en bon état",
        "Lunettes présentes et en bon état",
        "Masques chirurgicaux jetables (cas pandémie)",
        "Les agents connaissent les EPI nécessaires à leur activité",
        "Les EPI sont portés",
      ],
    },
    // === 6 - Environnement ===
    {
      title: "Environnement",
      icon: "♻️",
      evalMode: "PER_SECTION",
      category: "Environnement",
      items: [
        "Documentations & moyens",
        "Gestion des déchets",
        "Traitement des déchets",
        "Propreté & rangement",
      ],
    },
  ],
};

export const SEED_VISIT_TEMPLATES: SeedTemplate[] = [
  TEMPLATE_TRIMESTRIELLE,
  TEMPLATE_PLANIFIEE,
];
