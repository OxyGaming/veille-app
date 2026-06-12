// Auto-extrait depuis Veille_procedures_AC.html — ne pas éditer à la main.
export type SeedProcedure = {
  domain: string;
  theme: string | null;
  title: string;
  gravity: number;
  documents: string[];
  risk: string | null;
  items: { label: string; gravity: number | null; histPct: number | null; histN: number | null }[];
};

export const SEED_PROCEDURES: SeedProcedure[] = [
  {
    "domain": "Acheminement des transports avec particularités",
    "theme": "Transports avec particularités",
    "title": "Acheminement d'un transport particulier",
    "gravity": 4,
    "documents": [
      "DC1792",
      "DC01503"
    ],
    "risk": "Heurt d'obstacle (gabarit, transport exceptionnel).",
    "items": [
      {
        "label": "Circulation d'un convoi avec particularité",
        "gravity": 3,
        "histPct": 80,
        "histN": 5
      },
      {
        "label": "Garage d'un convoi avec particularité",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement d'un incident lié à la circulation d'un convoi avec particularité",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement d'un incident MD",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circuits de voie",
    "theme": "Itinéraires",
    "title": "Circuits de voie peu empruntés",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC1556"
    ],
    "risk": "Circuit de voie non révélateur, réception sur voie occupée.",
    "items": [
      {
        "label": "Emprunt des itinéraires désignés",
        "gravity": 3,
        "histPct": 100,
        "histN": 17
      },
      {
        "label": "Respect et suivi du programme de circulation",
        "gravity": 2,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circuits de voie",
    "theme": "Circulations",
    "title": "Circulations de catégorie A, B, C",
    "gravity": 3,
    "documents": [
      "DC1556",
      "DC01133"
    ],
    "risk": "Circulation hors conditions de catégorie.",
    "items": [
      {
        "label": "Annonce",
        "gravity": 2,
        "histPct": 100,
        "histN": 18
      },
      {
        "label": "Prise des mesures",
        "gravity": 3,
        "histPct": 97,
        "histN": 31
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Gares temporaires",
    "gravity": 4,
    "documents": [
      "DC01503",
      "DC07292"
    ],
    "risk": "Circulation non protégée lors d'une cessation / reprise.",
    "items": [
      {
        "label": "Informations si dernier train MI, Départ, Origine , Terminus",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Processus de cessation ou de reprise",
        "gravity": 2,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Report de mesures de sécurité",
        "gravity": 3,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Gares temporaires / Gares permanentes autorisées à s'absenter",
    "gravity": 4,
    "documents": [
      "DC01503",
      "DC07292"
    ],
    "risk": "Circulation non protégée lors d'une cessation / reprise.",
    "items": [
      {
        "label": "Processus de cessation ou de reprise du service de la circulation",
        "gravity": 2,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Report de mesures de sécurité",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Communications de sécurité",
    "title": "Principes de communication",
    "gravity": 2,
    "documents": [
      "DC07202",
      "DC03978"
    ],
    "risk": "Dépassement de vitesse, collision, déraillement, heurt par mauvaise transmission.",
    "items": [
      {
        "label": "Utilisation des moyens de communication",
        "gravity": 2,
        "histPct": 100,
        "histN": 51
      },
      {
        "label": "Règles des échanges verbaux",
        "gravity": 3,
        "histPct": 89,
        "histN": 62
      },
      {
        "label": "Règles de collationnement",
        "gravity": 3,
        "histPct": 98,
        "histN": 44
      },
      {
        "label": "Sacralisation de la remise des ordres",
        "gravity": 3,
        "histPct": 94,
        "histN": 33
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Suivi de la circulation",
    "gravity": 2,
    "documents": [
      "DC03978",
      "DC01560"
    ],
    "risk": "Perte de suivi, réception ou expédition erronée.",
    "items": [
      {
        "label": "Mise à jour des outils et systèmes de suivi des trains (TST, Oléron, fichier 2000, )",
        "gravity": 1,
        "histPct": 100,
        "histN": 13
      },
      {
        "label": "Tenue de l'état de circulation ou du registre de cantonnement",
        "gravity": 2,
        "histPct": 100,
        "histN": 13
      },
      {
        "label": "Tenue du registre de circulation de voie unique, annotations cadre B ou C",
        "gravity": 2,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Suivi de la circulation en DV",
    "gravity": 2,
    "documents": [
      "DC03978",
      "DC01560"
    ],
    "risk": "Perte de suivi, réception ou expédition erronée.",
    "items": [
      {
        "label": "Mise à jour des outils et systèmes de suivi des trains (TST, Oléron, fichier 2000, …)",
        "gravity": 1,
        "histPct": 96,
        "histN": 23
      },
      {
        "label": "Tenue de l'EC ou du registre de cantonnement",
        "gravity": 2,
        "histPct": 100,
        "histN": 26
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Transmission ou cessation du service",
    "gravity": 3,
    "documents": [
      "DC03978",
      "DC08043"
    ],
    "risk": "Perte d'information à la relève, situation non transmise.",
    "items": [
      {
        "label": "Prise de service avec opérations de sécurité en cours",
        "gravity": 3,
        "histPct": 90,
        "histN": 10
      },
      {
        "label": "Transmission ou cessation de service avec opérations de sécurité en cours",
        "gravity": 3,
        "histPct": 100,
        "histN": 13
      },
      {
        "label": "Transmission ou cessation du service",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Circulation",
    "theme": "Service de la circulation",
    "title": "Transmission, cessation ou prise du service",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Transmission ou cessation du service",
        "gravity": 3,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Prise de service",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      }
    ]
  },
  {
    "domain": "Compétences non techniques",
    "theme": "Compétences non techniques",
    "title": "Compétences non techniques",
    "gravity": 0,
    "documents": [
      "—"
    ],
    "risk": "Erreur humaine (communication, charge de travail, coopération).",
    "items": [
      {
        "label": "Conscience de la situation",
        "gravity": 1,
        "histPct": 88,
        "histN": 33
      },
      {
        "label": "Coopération",
        "gravity": 1,
        "histPct": 97,
        "histN": 37
      },
      {
        "label": "Rigueur professionnelle",
        "gravity": 1,
        "histPct": 91,
        "histN": 46
      },
      {
        "label": "Communication",
        "gravity": 1,
        "histPct": 90,
        "histN": 40
      },
      {
        "label": "Gestion de la charge de travail",
        "gravity": 1,
        "histPct": 81,
        "histN": 21
      },
      {
        "label": "Gestion de soi",
        "gravity": 1,
        "histPct": 88,
        "histN": 17
      },
      {
        "label": "Prise de décision",
        "gravity": 1,
        "histPct": 77,
        "histN": 22
      }
    ]
  },
  {
    "domain": "Dégagement des VP",
    "theme": "Secours",
    "title": "Annulation de la demande de secours",
    "gravity": 3,
    "documents": [
      "DC01505",
      "DC08043"
    ],
    "risk": "Reprise de marche d'un EMS non avisé.",
    "items": [
      {
        "label": "Autorisation de remise en marche",
        "gravity": 2,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Réception de l'annulation et demande de remise en marche",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Dégagement des VP",
    "theme": "Secours",
    "title": "Mesures préalables au secours",
    "gravity": 4,
    "documents": [
      "DC01505",
      "DC01133"
    ],
    "risk": "Secours engagé sans autorisation / sans protection.",
    "items": [
      {
        "label": "Lancement des avis",
        "gravity": 1,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "Mesures de protection du train en détresse",
        "gravity": 2,
        "histPct": 100,
        "histN": 11
      },
      {
        "label": "Prise des mesures pour mouvement à contre-voie",
        "gravity": 3,
        "histPct": 100,
        "histN": 11
      },
      {
        "label": "Traitement de la DSEC",
        "gravity": 1,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Dégagement des VP",
    "theme": "Secours",
    "title": "Réalisation du secours",
    "gravity": 3,
    "documents": [
      "DC01505",
      "DC01560"
    ],
    "risk": "Secours mal exécuté, retour non maîtrisé.",
    "items": [
      {
        "label": "Expédition de l'EMS",
        "gravity": 3,
        "histPct": 100,
        "histN": 11
      },
      {
        "label": "Ordre au conducteur de l'EMS",
        "gravity": 2,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "Dégagement de la voie",
        "gravity": 2,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Vérification train revenu entier",
        "gravity": 3,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Autorisation de remise en marche",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Réception de l'annulation de la demande de secours et demande de remise en marche",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Particularités en IPCS",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Vérification train revenu complet/dégagement de la voie",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Dégagement des VP",
    "theme": "Secours",
    "title": "Traitement d'un secours",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Lancement des avis",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Mesures de protection du train en détresse",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement de la DSEC",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Gestes métiers dans les emprises ferroviaires",
    "theme": "Sauvegarde de soi-même, des collègues, des clients, des tiers",
    "title": "Connaissance des Règles Qui Sauvent (RQS)",
    "gravity": 2,
    "documents": [
      "S2"
    ],
    "risk": "Accident corporel (heurt ferroviaire).",
    "items": [
      {
        "label": "Je ne réalise que les missions pour lesquelles je suis autorisé",
        "gravity": 2,
        "histPct": 100,
        "histN": 72
      },
      {
        "label": "Je ne travaille jamais en ayant consommé de l'alcool ou un produit stupéfiant",
        "gravity": 2,
        "histPct": 100,
        "histN": 72
      },
      {
        "label": "Je n'utilise jamais de téléphone en conduisant",
        "gravity": 2,
        "histPct": 100,
        "histN": 72
      },
      {
        "label": "Je respecte les consignes d'utilisation des engins et des outils",
        "gravity": 2,
        "histPct": 100,
        "histN": 72
      },
      {
        "label": "J'utilise systématiquement et correctement tous les EPI et agrès adaptés à ma mission",
        "gravity": 2,
        "histPct": 100,
        "histN": 73
      },
      {
        "label": "J'utilise un téléphone ou une tablette numérique uniquement dans une situation ne présentant pas de danger",
        "gravity": 2,
        "histPct": 100,
        "histN": 72
      },
      {
        "label": "Je participe au briefing et je m'assure de l'avoir compris",
        "gravity": 2,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "NVNP : Je considère toute installation électrique et tout câble électrique comme étant sous tension",
        "gravity": 2,
        "histPct": 100,
        "histN": 38
      },
      {
        "label": "NVNP : Je ne m'engage jamais et je n'engage jamais de matériel dans la zone dangereuse sans mesures de protection",
        "gravity": 2,
        "histPct": 100,
        "histN": 38
      },
      {
        "label": "NVNP : Je ne pénètre jamais sans autorisation, à moins de 3 mètres d'un engin, d'une machine ou d'une charge",
        "gravity": 2,
        "histPct": 100,
        "histN": 38
      },
      {
        "label": "Je considère toute installation électrique et tout câble électrique comme étant sous tension",
        "gravity": 2,
        "histPct": 100,
        "histN": 34
      },
      {
        "label": "Je ne chemine jamais dans les voies sans nécessité de service et prise en compte du risque ferroviaire",
        "gravity": 2,
        "histPct": 100,
        "histN": 34
      },
      {
        "label": "Je ne circule jamais dans la zone d’action d’un engin ou la zone d’évolution d’une charge sans avoir sécurisé mon intervention",
        "gravity": 2,
        "histPct": 100,
        "histN": 34
      },
      {
        "label": "Je ne commence le travail qu'après avoir participé au briefing et l'avoir compris",
        "gravity": 2,
        "histPct": 100,
        "histN": 34
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans des conditions particulières",
    "title": "Franchissement des signaux",
    "gravity": 3,
    "documents": [
      "DC01560",
      "DC01505"
    ],
    "risk": "Déraillement sur ADV, prise en écharpe, nez-à-nez, dépassement de vitesse.",
    "items": [
      {
        "label": "Conditions de transmission ou de remise",
        "gravity": 2,
        "histPct": 100,
        "histN": 26
      },
      {
        "label": "Qualité des communications",
        "gravity": 2,
        "histPct": 100,
        "histN": 16
      },
      {
        "label": "Traçabilité, formulaire",
        "gravity": 2,
        "histPct": 100,
        "histN": 26
      },
      {
        "label": "Vérification des conditions d'ouverture",
        "gravity": 3,
        "histPct": 100,
        "histN": 27
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Rédaction/remise du formulaire",
        "gravity": 4,
        "histPct": 33,
        "histN": 3
      },
      {
        "label": "Vérification préalable au franchissement du signal",
        "gravity": 4,
        "histPct": 33,
        "histN": 3
      },
      {
        "label": "Suivi de l'éclatement des appuis accoustiques",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des installations dans les conditions normales",
    "title": "Manoeuvre des installations",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Poste à commande d'itinéraire : commande/formation/établissement/destruction",
        "gravity": 3,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "IPCS",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Prise en compte des dispositifs (DA, DR, DSA, dialogue )",
        "gravity": 3,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Respect de la position prévue des installations",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Vérifications après manoeuvre",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Vérifications avant manoeuvre",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans les conditions normales",
    "title": "Manœuvre individuelle des appareils de voie",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Prise en compte des dispositifs (DA, DR)",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Respect de la position normale",
        "gravity": 2,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Technique gestuelle et gestes métier",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Vérification position et collage",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans les conditions normales",
    "title": "Manœuvre individuelle des signaux",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Ouverture en temps utile",
        "gravity": 2,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Prise en compte des dispositifs (DA, DR)",
        "gravity": 3,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Respect de la position normale",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Vérification contrôle de fermeture",
        "gravity": 3,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Utilisation de la fermeture d'urgence",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans des conditions particulières",
    "title": "Modification d'itinéraire",
    "gravity": 3,
    "documents": [
      "DC01560",
      "DC01505"
    ],
    "risk": "Itinéraire incompatible, arrêt accidentel mal traité.",
    "items": [
      {
        "label": "Arrêt accidentel d'une circulation sur un itinéraire",
        "gravity": 3,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Itinéraire non pourvu d'Eap, d'Epa ou de DMT",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Itinéraire pourvu de DMT",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Itinéraire pourvu d'EAp ou d'Epa",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans des conditions particulières",
    "title": "Parcours non prévus",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Itinéraire inverse d'un itinéraire existant",
        "gravity": 3,
        "histPct": 100,
        "histN": 14
      },
      {
        "label": "Parcours ne correspondant à aucun itinéraire existant",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Itinéraire FSO",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Itinéraire \"formation sans ouverture\"",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Manœuvre et utilisation des IS",
    "theme": "Utilisation des IS dans les conditions normales",
    "title": "Poste à commande d'itinéraire",
    "gravity": 3,
    "documents": [
      "DC01560"
    ],
    "risk": "Commande erronée d'itinéraire ou d'aiguille.",
    "items": [
      {
        "label": "Commande/formation/établissement/destruction",
        "gravity": 3,
        "histPct": 100,
        "histN": 25
      },
      {
        "label": "Fermeture d'urgence",
        "gravity": 3,
        "histPct": 100,
        "histN": 17
      },
      {
        "label": "Prise en compte des dispositifs (DA, DR, dialogues)",
        "gravity": 3,
        "histPct": 100,
        "histN": 16
      },
      {
        "label": "Rappel des appareils en position de protection",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mise en mouvement des trains",
    "theme": "Départ des trains",
    "title": "Autorisation de mouvement",
    "gravity": 3,
    "documents": [
      "OP56529",
      "OP56531"
    ],
    "risk": "Départ non autorisé / mouvement non protégé.",
    "items": [
      {
        "label": "Autorisation de mouvement",
        "gravity": 3,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Modalités de transmission de l'AuM",
        "gravity": 1,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Train prêt au départ",
        "gravity": 2,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Absence exceptionnelle de l'agent chargé de donner l'AuM",
        "gravity": 1,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Présence exceptionnelle de l'agent chargé de donner l'AuM",
        "gravity": 1,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Absence/Présence exceptionnelle de l'agent chargé de donner l'AuM",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Coordination de site",
    "title": "Attribution d'un bloc",
    "gravity": 3,
    "documents": [
      "S9",
      "OP56529"
    ],
    "risk": "Bloc attribué sans vérification.",
    "items": [
      {
        "label": "Attribution / restitution",
        "gravity": 3,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Tenue du tableau de suivi du/des blocs",
        "gravity": 3,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Réquisition d'une voie d'un bloc pour besoin SGC",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Travaux sur bloc",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Circulation des trains et des mouvements de manoeuvre et des manoeuvres guidées",
    "title": "Circulation des manoeuvres guidées et non guidées",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Ententes et opérations préalables à la mise en mouvement",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Circulation des trains et des manœuvres guidées",
    "title": "Circulation des manœuvres guidées",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC03978"
    ],
    "risk": "Manœuvre vers domaine fermé, collision.",
    "items": [
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Ententes préalables à la mise en mouvement",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Tracé des itinéraires",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Exploitation en mode dégradé",
    "title": "Contre-voie",
    "gravity": 4,
    "documents": [
      "DC01505",
      "DC3858"
    ],
    "risk": "Engagement non protégé à contre-voie.",
    "items": [
      {
        "label": "Exécution du mouvement à contre-voie",
        "gravity": 3,
        "histPct": 97,
        "histN": 30
      },
      {
        "label": "Fin du mouvement à contre-voie",
        "gravity": 2,
        "histPct": 100,
        "histN": 25
      },
      {
        "label": "Avis aux agents intéressés",
        "gravity": 2,
        "histPct": 100,
        "histN": 21
      },
      {
        "label": "Mesures préalables",
        "gravity": 3,
        "histPct": 100,
        "histN": 23
      },
      {
        "label": "Préparation du mouvement à contrevoie",
        "gravity": 4,
        "histPct": 86,
        "histN": 7
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Coordination de site",
    "title": "Gestion d'un bloc",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Procédures d'engagement/dégagement d'un bloc",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Attribution / restitution",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Gestion des travaux sur bloc",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Réquisition d'une voie d'un bloc pour besoin SGC",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Tenue du tableau de suivi du/des blocs",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Réception des trains",
    "title": "Mesures postérieures à la réception",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Mise à jour du TOV, GOV ou autre outil en tenant lieu",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Mise en protection de la voie après réception (si possible ou prescrit)",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Protection des GF engagés non repérés",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Réception des trains",
    "title": "Mesures préalables à la réception",
    "gravity": 3,
    "documents": [
      "S9",
      "OP56529"
    ],
    "risk": "Réception inopinée sur voie occupée.",
    "items": [
      {
        "label": "Désignation de la voie de réception par le RR",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Réservation de la voie désignée sur TOV, GOV ou autre outil en tenant lieu",
        "gravity": 2,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Vérification contradictoire terrain/TOV ou GOV, si prescrit",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Réalisation des ententes avec les autres intervenants (verbales, dépêches, …)",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Tracé de l'itinéraire de réception",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Vérification de l'aptitude de la voie (Voie de réception, TE, …)",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Vérification des dispositifs de contrôle lorsqu'ils existent",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Vérification voie libre sur TOV, GOV ou autre outil en tenant lieu",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Réalisation des ententes avec les autres intervenants (verbales, dépêches, )",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Vérification voie libre",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Réception sur voie choisie occupée",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Mouvement",
    "theme": "Coordination de site",
    "title": "Réception d'un train sur un bloc",
    "gravity": 3,
    "documents": [
      "DC08043",
      "S9"
    ],
    "risk": "Réception non autorisée par le gestionnaire du bloc.",
    "items": [
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Application CLE/CLO",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Protection du personnel",
    "theme": "Protection du personnel lors d'interventions aux abords ou dans la ZD",
    "title": "Protection d'un conducteur intervenant sur son train ou sur IS",
    "gravity": 3,
    "documents": [
      "DC07202",
      "DC01560"
    ],
    "risk": "Heurt d'une personne par une circulation.",
    "items": [
      {
        "label": "Mesures de protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 16
      },
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 16
      },
      {
        "label": "Libellés et transmission des ordres ou avis (Formulaires)",
        "gravity": 2,
        "histPct": 100,
        "histN": 15
      },
      {
        "label": "Protection complémentaire sur LGV",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Communications, traçabilité",
        "gravity": 1,
        "histPct": 100,
        "histN": 14
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Protection du personnel",
    "theme": "Protection du personnel lors d'interventions aux abords ou dans la ZD",
    "title": "Protection du personnel (autre que conducteur) lors d'interventions sur intallations ou matériels, travaux aux abords des voies, traversée des voies",
    "gravity": 3,
    "documents": [
      "S9",
      "DC1560",
      "DC1503"
    ],
    "risk": "Heurt d'une ou plusieurs personnes par une circulation ferroviaire",
    "items": [
      {
        "label": "Mesures de protection",
        "gravity": 4,
        "histPct": 100,
        "histN": 17
      },
      {
        "label": "Communications, traçabilité",
        "gravity": 1,
        "histPct": 100,
        "histN": 17
      },
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 16
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Préparation de l'entente préalable",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Caractéristiques de l'opération",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Heure d'accord et de restitution",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Identification des acteurs et des opérations",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Particularités à l'initiative de l'AC ou de l'ASP",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traçabilité, tenue du carnet",
        "gravity": 2,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Protection du personnel",
    "theme": "Protection du personnel lors d'interventions aux abords ou dans la ZD",
    "title": "Protection du personnel lors d'opérations de petit entretien d'IS (graissage / détos)",
    "gravity": 3,
    "documents": [
      "DC6083",
      "S9",
      "DC7361"
    ],
    "risk": "Heurt d'une ou plusieurs personnes par une circulation ferroviaire",
    "items": [
      {
        "label": "Communications, traçabilité",
        "gravity": 1,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Mesures de protection",
        "gravity": 4,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Caractéristiques de l’opération",
        "gravity": 3,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "NVNP : Heure d’accord et de restitution de la DPGr",
        "gravity": 1,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "NVNP : Identification des acteurs et des opérations",
        "gravity": 1,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Particularités à l’initiative de l’AC ou de l’ASP",
        "gravity": 2,
        "histPct": 75,
        "histN": 4
      },
      {
        "label": "NVNP : Préparation de l’entente préalable",
        "gravity": 1,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Protection du personnel",
    "theme": "Protection du personnel lors d'interventions aux abords ou dans la ZD",
    "title": "Protection du personnel lors d'opérations de petit entretien d'IS (graissage/détos)",
    "gravity": 3,
    "documents": [
      "DC6083",
      "S9",
      "DC7361"
    ],
    "risk": "Heurt d'une ou plusieurs personnes par une circulation ferroviaire",
    "items": [
      {
        "label": "Mesures de protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Caractéristiques de l'opération",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Heure d'accord et de restitution de la DPGr",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Identification des acteurs et des opérations",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Particularités à l'initiative de l'AC ou de l'ASP",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "NVNP : Préparation de l'entente préalable",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Traçabilité, tenue du carnet",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      }
    ]
  },
  {
    "domain": "SECURITE DU PERSONNEL",
    "theme": "Les règles qui sauvent",
    "title": "Connaissance des Régles qui Sauvent",
    "gravity": 3,
    "documents": [
      "S2"
    ],
    "risk": "Accident corporel (heurt ferroviaire).",
    "items": [
      {
        "label": "L'agent applique les régles qui sauvent",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "L'agent connait les régles qui sauvent",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "SST opérationnelle",
    "theme": "SST opérationnelle",
    "title": "RQS : Je ne mengage jamais et nengage jamais du matériel dans la ZD sans mesures de protection (Risque de heurt ferroviaire)",
    "gravity": 4,
    "documents": [
      "RQS",
      "S2"
    ],
    "risk": "Heurt ferroviaire d'un agent.",
    "items": [
      {
        "label": "NVNP : Avant de travailler en ZD je m'assure de la mise en oeuvre de mesure de protection",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "NVNP : Avant de travailler en ZD je participe au briefing au pied de l'opération",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "NVNP : Dans les emprises je ne porte pas d'écouteurs. Dans la ZD je ,n'utilise ni téléphone, ni tablette",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "NVNP : Je porte les EPI adaptés",
        "gravity": 4,
        "histPct": 100,
        "histN": 44
      },
      {
        "label": "NVNP : Je suis autorisé à accéder aux emprises ferroviaires ou accompagné",
        "gravity": 4,
        "histPct": 100,
        "histN": 44
      },
      {
        "label": "NVNP : J'identifie les voies où la circulation n'est pas interdite et les emplacements de garage",
        "gravity": 4,
        "histPct": 100,
        "histN": 44
      },
      {
        "label": "Respect de la DMVC",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "Respect des particularités locales",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "Respect des règles de déplacement",
        "gravity": 4,
        "histPct": 100,
        "histN": 43
      }
    ]
  },
  {
    "domain": "SST opérationnelle",
    "theme": "SST opérationnelle",
    "title": "Risque de heurt ferroviaire",
    "gravity": 4,
    "documents": [
      "RQS",
      "S2"
    ],
    "risk": "Heurt ferroviaire d'un agent.",
    "items": [
      {
        "label": "Port des EPI adaptés",
        "gravity": 1,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "Respect de la DMVC",
        "gravity": 1,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "Respect des mesures de protection prévues en cas de travail dans et à proximité de la ZD",
        "gravity": 1,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "Respect des particularités locales",
        "gravity": 1,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "Respect des règles de déplacement",
        "gravity": 1,
        "histPct": 100,
        "histN": 39
      }
    ]
  },
  {
    "domain": "STEM",
    "theme": "Surveillance des trains en marche",
    "title": "Exécution de la STEM",
    "gravity": 3,
    "documents": [
      "DC01503",
      "DC01560"
    ],
    "risk": "Avarie non détectée (frein serré, organes de roulement), impact installations / personnes.",
    "items": [
      {
        "label": "Détection des anomalies",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Réalisation de la STEM",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Désignation d'un autre agent",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Prise des mesures en cas d'anomalies",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Prendre ou faire prendre des mesures en cas d'anomalies",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Situations perturbées / Incidents",
    "theme": "Protection des circulations ou installations",
    "title": "Anomalie MD sur un train en circulation",
    "gravity": 4,
    "documents": [
      "DC01503",
      "DC01560"
    ],
    "risk": "Événement matières dangereuses non maîtrisé.",
    "items": [
      {
        "label": "Lancement des avis",
        "gravity": 1,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Mesures de protection",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Reprise de la circulation normale",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traçabilité, dépêches",
        "gravity": 1,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement évènement type 1",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement évènement type 2",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Situations perturbées / Incidents",
    "theme": "Outils digitaux - Mise en oeuvre des plans de continuité d'activité (PCA)",
    "title": "Indisponibilité des outils digitaux - Mise en oeuvre des PCA",
    "gravity": 2,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": []
  },
  {
    "domain": "Situations perturbées / Incidents",
    "theme": "Incidents de circulation",
    "title": "Obstacles / Dangers",
    "gravity": 4,
    "documents": [
      "DC01503",
      "DC07202"
    ],
    "risk": "Heurt d'obstacle ou de personnes par une circulation.",
    "items": [
      {
        "label": "Lancement des avis",
        "gravity": 1,
        "histPct": 98,
        "histN": 48
      },
      {
        "label": "Libellés et transmission des ordres ou avis (Formulaires)",
        "gravity": 3,
        "histPct": 100,
        "histN": 39
      },
      {
        "label": "Reconnaissance",
        "gravity": 2,
        "histPct": 100,
        "histN": 17
      },
      {
        "label": "Reprise de la circulation avec restriction",
        "gravity": 3,
        "histPct": 97,
        "histN": 37
      },
      {
        "label": "Reprise de la circulation normale",
        "gravity": 3,
        "histPct": 100,
        "histN": 43
      },
      {
        "label": "Traçabilité, dépêches",
        "gravity": 2,
        "histPct": 93,
        "histN": 43
      },
      {
        "label": "Mesures en cas de SAR / SAL",
        "gravity": 3,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Mesures pour arrêter les trains",
        "gravity": 3,
        "histPct": 92,
        "histN": 50
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Mesures pour arrêter et retenir les trains",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Particularités des formulaires remis par un poste en amont",
        "gravity": 1,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Traitement d'un SAR / SAL",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Situations perturbées / Incidents",
    "theme": "Protection des circulations ou installations",
    "title": "Train circulant dans des conditions dangereuses",
    "gravity": 4,
    "documents": [
      "DC01503",
      "DC01133"
    ],
    "risk": "Prise en écharpe, heurt, déraillement.",
    "items": [
      {
        "label": "Informations conducteur",
        "gravity": 2,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Lancement des avis",
        "gravity": 1,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Libellés et transmission des ordres ou avis (Formulaires)",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Mesures de protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Mesures en cas d'alarme DBC",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Reprise de la circulation avec restrictions",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Reprise de la circulation normale",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Traçabilité, dépêches",
        "gravity": 1,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Travaux / Incidents",
    "title": "Consignation C",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC01503"
    ],
    "risk": "Intervention sous tension.",
    "items": [
      {
        "label": "Autre agent intervenant dans la protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Mise en œuvre de la protection C",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "SNOP",
        "gravity": 2,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Traçabilité",
        "gravity": 1,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Travaux / Incidents",
    "title": "Mise hors tension / condamnation",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC01560"
    ],
    "risk": "Manœuvre d'appareil d'interruption en charge.",
    "items": [
      {
        "label": "Condamnation",
        "gravity": 3,
        "histPct": 100,
        "histN": 15
      },
      {
        "label": "Manœuvre des appareils d'interruption",
        "gravity": 3,
        "histPct": 100,
        "histN": 11
      },
      {
        "label": "Réalimentation en secours",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "Vérifications préalables à la mise hors tension",
        "gravity": 3,
        "histPct": 100,
        "histN": 13
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Rôle de l'agent E",
    "title": "Ordres reçus du RSS",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Manoeuvre et Condamnation d'un appareil d'interruption",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Protection C",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "SNOP",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Rôle de l'aiguilleur",
    "title": "Passage d'une circulation bimode sous caténaire privée de tension",
    "gravity": 3,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": []
  },
  {
    "domain": "Traction électrique",
    "theme": "Travaux / Incidents",
    "title": "Passage sous caténaire privée de tension",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC01560"
    ],
    "risk": "Engin électrique sous caténaire consignée.",
    "items": [
      {
        "label": "Reconnaissance de la circulation",
        "gravity": 3,
        "histPct": 100,
        "histN": 14
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Levée et rétablissement des mesures",
        "gravity": 3,
        "histPct": 100,
        "histN": 2
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Ordres reçus du RSS ou agent E",
    "title": "Protection C",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC03978"
    ],
    "risk": "Sel privée d'alimentation / sel secondaire impactée.",
    "items": [
      {
        "label": "Réalisation de la protection C",
        "gravity": 3,
        "histPct": 100,
        "histN": 19
      },
      {
        "label": "Traçabilité",
        "gravity": 2,
        "histPct": 100,
        "histN": 18
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Rôle de l'aiguilleur",
    "title": "Protection C, protection d'une SNOP",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC03978"
    ],
    "risk": "Sel privée d'alimentation / sel secondaire impactée.",
    "items": [
      {
        "label": "Mise en oeuvre de la protection C",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Tenue de registre de traction électrique",
        "gravity": 3,
        "histPct": 100,
        "histN": 3
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Rôle de l'agent E",
    "title": "Réalimentation en secours hors consignation C",
    "gravity": 3,
    "documents": [
      "DC08043",
      "DC01503"
    ],
    "risk": "Intervention sous tension.",
    "items": [
      {
        "label": "Réalimentation en secours",
        "gravity": 3,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traction électrique",
    "theme": "Ordres reçus du RSS ou agent E",
    "title": "Suppression de la tension sur El. de caténaire secondaire",
    "gravity": 3,
    "documents": [
      "DC8043",
      "DC1556",
      "S2"
    ],
    "risk": "Dégât aux installations de T.El",
    "items": [
      {
        "label": "réalisation de la protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traitement des dérangements",
    "theme": "Traitement des dérangements",
    "title": "Dérangement des IS et IS sensibles",
    "gravity": 4,
    "documents": [
      "DC01560",
      "DC01133"
    ],
    "risk": "Déraillement sur ADV, prise en écharpe, nez-à-nez.",
    "items": [
      {
        "label": "Identification du dérangement",
        "gravity": 2,
        "histPct": 95,
        "histN": 42
      },
      {
        "label": "Lancement des avis",
        "gravity": 2,
        "histPct": 100,
        "histN": 40
      },
      {
        "label": "Reprise la circulation en mode dégradé",
        "gravity": 3,
        "histPct": 96,
        "histN": 45
      },
      {
        "label": "Traçabilité",
        "gravity": 1,
        "histPct": 98,
        "histN": 43
      },
      {
        "label": "Qualité des communications échangées",
        "gravity": 2,
        "histPct": 100,
        "histN": 15
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Traitement des dérangements",
    "theme": "Traitement des dérangements",
    "title": "Dérangement des IS et IS sensibles et contraires à la sécurité",
    "gravity": 4,
    "documents": [
      "DC01560",
      "DC01133"
    ],
    "risk": "Déraillement sur ADV, prise en écharpe, nez-à-nez.",
    "items": [
      {
        "label": "Identification du dérangement",
        "gravity": 3,
        "histPct": 67,
        "histN": 9
      },
      {
        "label": "Lancement des avis",
        "gravity": 2,
        "histPct": 71,
        "histN": 7
      },
      {
        "label": "Traçabilité",
        "gravity": 2,
        "histPct": 75,
        "histN": 8
      },
      {
        "label": "Dérangement contraire à la sécurité : mesures conservatoires",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Reprise la circulation en mode dégradé",
        "gravity": 4,
        "histPct": 86,
        "histN": 7
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur IS",
    "title": "1ère Cat. / DATIS",
    "gravity": 3,
    "documents": [
      "DC01560",
      "DC3858"
    ],
    "risk": "Raté d'ouverture / fermeture, dérangement aiguille non couvert.",
    "items": [
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "DATIS",
        "gravity": 3,
        "histPct": 92,
        "histN": 12
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "DV : Ententes et/ou fermeture de voie",
    "gravity": 3,
    "documents": [
      "DC03978",
      "S9"
    ],
    "risk": "Heurt d'une personne ou d'un obstacle par une circulation.",
    "items": [
      {
        "label": "Autre agent intervenant dans la protection",
        "gravity": 3,
        "histPct": 100,
        "histN": 22
      },
      {
        "label": "Identification train ouvrant",
        "gravity": 1,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "Mise en oeuvre de la fermeture de voie",
        "gravity": 3,
        "histPct": 97,
        "histN": 34
      },
      {
        "label": "Réalisation de la vérification ZEP libre",
        "gravity": 3,
        "histPct": 97,
        "histN": 38
      },
      {
        "label": "Mesures annexes : SAM pour retenir EM présent sur la ZEP, …",
        "gravity": 3,
        "histPct": 86,
        "histN": 7
      },
      {
        "label": "Réalisation de la vérification à postériori de la ZEP (sur demande du RPTx)",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Caractéristiques des planches travaux",
        "gravity": 2,
        "histPct": 95,
        "histN": 21
      },
      {
        "label": "NVNP : Entente sur l’heure prévue de restitution de la DFV",
        "gravity": 1,
        "histPct": 100,
        "histN": 22
      },
      {
        "label": "NVNP : Entente sur les mouvements de LAM",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Entente sur les mouvements de TTx",
        "gravity": 2,
        "histPct": 100,
        "histN": 12
      },
      {
        "label": "NVNP : Heure d’accord de la DFV",
        "gravity": 1,
        "histPct": 92,
        "histN": 25
      },
      {
        "label": "NVNP : Identification des acteurs et des opérations",
        "gravity": 2,
        "histPct": 100,
        "histN": 18
      },
      {
        "label": "NVNP : Identification du procédé d’assurance chantier",
        "gravity": 2,
        "histPct": 96,
        "histN": 23
      },
      {
        "label": "NVNP : Identification et conformité des documents travaux",
        "gravity": 2,
        "histPct": 92,
        "histN": 24
      },
      {
        "label": "NVNP : Manœuvre d’appareils de voie",
        "gravity": 3,
        "histPct": 100,
        "histN": 8
      },
      {
        "label": "NVNP : Particularités des documents travaux applicables sur le chantier",
        "gravity": 2,
        "histPct": 92,
        "histN": 24
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Qualité de la demande et ententes",
        "gravity": 2,
        "histPct": 100,
        "histN": 4
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "Fin des travaux",
    "gravity": 3,
    "documents": [
      "DC03978",
      "DC08043"
    ],
    "risk": "Déraillement sur ADV par travaux mal clôturés.",
    "items": [
      {
        "label": "Levée des mesures de protection",
        "gravity": 2,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Restitution de la DFV",
        "gravity": 1,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Tenue du carnet de DFV",
        "gravity": 2,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "Gestion des restrictions de circulation suite aux travaux",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Gestion des TTx présents si restitution de la DFV occupée",
        "gravity": 2,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "Fin des travaux et/ou traçabilité",
    "gravity": 3,
    "documents": [
      "DC03978",
      "DC08043"
    ],
    "risk": "Déraillement sur ADV par travaux mal clôturés.",
    "items": [
      {
        "label": "Autre agent concerné par la protection",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Gestion des restrictions de circulation suite aux travaux",
        "gravity": 3,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "Gestion des TTx présents si restitution de la DFV occupée",
        "gravity": 2,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "Levée des mesures de protection",
        "gravity": 2,
        "histPct": 100,
        "histN": 23
      },
      {
        "label": "Restitution de la DFV",
        "gravity": 2,
        "histPct": 100,
        "histN": 23
      },
      {
        "label": "Tenue du carnet de DFV",
        "gravity": 1,
        "histPct": 92,
        "histN": 26
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "NVNP : Ententes et fermeture de voie",
    "gravity": 4,
    "documents": [
      "—"
    ],
    "risk": "",
    "items": [
      {
        "label": "Mise en oeuvre de la fermeture de voie",
        "gravity": 4,
        "histPct": 100,
        "histN": 11
      },
      {
        "label": "NVNP : Identification des acteurs et des opérations",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "NVNP : Identification et conformité des documents travaux",
        "gravity": 2,
        "histPct": 100,
        "histN": 7
      },
      {
        "label": "Mesures prises par un autre agent",
        "gravity": 4,
        "histPct": 67,
        "histN": 9
      },
      {
        "label": "Identification du train ouvrant",
        "gravity": 3,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Caractéristiques des planches travaux",
        "gravity": 2,
        "histPct": 100,
        "histN": 3
      },
      {
        "label": "NVNP : Entente sur les mouvements de LAM",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Entente sur les mouvements de TTx",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Entente sur l'heure prévue de restitution de la DFV",
        "gravity": 2,
        "histPct": 100,
        "histN": 4
      },
      {
        "label": "NVNP : Heure d'accord de la DFV",
        "gravity": 2,
        "histPct": 100,
        "histN": 6
      },
      {
        "label": "NVNP : Identification du procédé d'assurance chantier",
        "gravity": 2,
        "histPct": 100,
        "histN": 5
      },
      {
        "label": "NVNP : Manoeuvre d'appareils de voie",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "NVNP : Particularités des documents travaux applicables sur le chantier",
        "gravity": 2,
        "histPct": 100,
        "histN": 2
      },
      {
        "label": "Réalisation de la vérification ZEP libre par l'AC",
        "gravity": 4,
        "histPct": 100,
        "histN": 9
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "TTX / LAM",
    "gravity": 3,
    "documents": [
      "DC03978",
      "DC01560"
    ],
    "risk": "Talonnage, déraillement sur ADV, collision, heurt.",
    "items": [
      {
        "label": "Dégagement de TTx - LAM",
        "gravity": 3,
        "histPct": 100,
        "histN": 10
      },
      {
        "label": "Engagement de TTx - LAM",
        "gravity": 2,
        "histPct": 100,
        "histN": 15
      },
      {
        "label": "Tracé du ou des itinéraires",
        "gravity": 3,
        "histPct": 100,
        "histN": 14
      },
      {
        "label": "Respect de la consigne de convoyage (LAM)",
        "gravity": 2,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Rétablissement des mesures de protection après engagement",
        "gravity": 3,
        "histPct": 100,
        "histN": 9
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "TTx déclencheur",
        "gravity": 2,
        "histPct": null,
        "histN": null
      }
    ]
  },
  {
    "domain": "Travaux sur les voies ou les IS",
    "theme": "Travaux sur les voies : procédé DFV",
    "title": "Vérifications préalables et/ou accord de la DFV",
    "gravity": 3,
    "documents": [
      "DC03978",
      "S9"
    ],
    "risk": "Talonnage / sortie intempestive du DF, collision ou déraillement sur ADV.",
    "items": [
      {
        "label": "Qualité de l'accord de la DFV",
        "gravity": 2,
        "histPct": 100,
        "histN": 34
      },
      {
        "label": "Signaux sur domaine fermé",
        "gravity": 3,
        "histPct": 100,
        "histN": 14
      },
      {
        "label": "Restrictions de circulation sur domaine fermé",
        "gravity": 3,
        "histPct": 100,
        "histN": 9
      },
      {
        "label": "Aiguilles sur domaine fermé",
        "gravity": 3,
        "histPct": 100,
        "histN": 15
      },
      {
        "label": "Notification à l'agent exploitation devant engager/degager un TTx",
        "gravity": 1,
        "histPct": 100,
        "histN": 9
      },
      {
        "label": "Savoir être au travail",
        "gravity": 4,
        "histPct": null,
        "histN": null
      },
      {
        "label": "Notification ou avis à l'agent exploitation concerné",
        "gravity": 1,
        "histPct": 67,
        "histN": 3
      }
    ]
  }
];
