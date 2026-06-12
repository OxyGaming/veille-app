/**
 * Patch idempotent — Circulation et Communications de sécurité.
 *
 *   1) Soft-delete des procédures redondantes (sous-ensembles d'autres) :
 *        - "Gares temporaires / Gares permanentes autorisées à s'absenter"
 *          (sous-ensemble de "Gares temporaires")
 *        - "Transmission, cessation ou prise du service"
 *          (sous-ensemble de "Transmission ou cessation du service")
 *        - "Traitement d'un secours"
 *          (sous-ensemble de "Mesures préalables au secours")
 *        - "Protection du personnel lors d'opérations de petit entretien
 *          d'IS (graissage/détos)" — version sans espace, doublon import
 *          de la version avec espace
 *
 *   2) Renommage : "Gares temporaires" → "Gares temporaires / Gares
 *      permanentes autorisées à s'absenter" (titre élargi qui absorbe le
 *      périmètre du soft-delete précédent).
 *
 *   3) Enrichissement de 14 procédures avec ~46 items calés sur :
 *        - DC01506 v02 du 30-07-2025 (Gare temporaire DV BA — Reprise/cessation)
 *        - DC07202 v02 du 07-10-2025 (Communications de sécurité — Formulaires)
 *      Chaque item porte `helpReference` (article §, fiche, code formulaire)
 *      et `helpText` (1-3 phrases d'explication).
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-circulation-communications.ts
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

// ─── Soft-delete des procédures redondantes ───────────────────────────────
const TO_SOFT_DELETE = [
  "Gares temporaires / Gares permanentes autorisées à s'absenter",
  "Transmission, cessation ou prise du service",
  "Traitement d'un secours",
  "Protection du personnel lors d'opérations de petit entretien d'IS (graissage/détos)",
];

// ─── Renommages (titre exact actuel → nouveau titre) ──────────────────────
const TO_RENAME: Record<string, string> = {
  "Gares temporaires":
    "Gares temporaires / Gares permanentes autorisées à s'absenter",
};

// ─── Enrichissements par procédure ────────────────────────────────────────
// Clé : titre ACTUEL de la procédure (avant renommage). Les ajouts sont
// appliqués après le renommage éventuel, donc on cible bien la même row.
const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // 1. Gares temporaires (renommée en "Gares temp / Gares perm. autorisées")
  // ───────────────────────────────────────────────────────────────────────
  "Gares temporaires": [
    {
      label:
        "Conditions préalables à la reprise (absence d'opération de sécurité, absence de mesures liées au dépassement de durée admise sans circulation)",
      helpReference: "DC01506 § 6.3",
      helpText:
        "Avant d'autoriser la reprise de la gare temporaire B, les AC des gares encadrantes A et C vérifient qu'aucune opération de sécurité en cours ne s'y oppose (travaux, mouvement à contre-voie, etc.) et qu'aucune mesure liée au dépassement de la durée admise sans circulation n'est prescrite par la doc locale.",
    },
    {
      label:
        "Conditions préalables à la cessation (trains passés OU pas de garage / dépassement / origine / terminus à B)",
      helpReference: "DC01506 § 6.3",
      helpText:
        "L'AC de B ne cesse le service que si aucune opération de sécurité ne s'y oppose et si les trains pour lesquels B était ouverte sont passés. Si un ou plusieurs trains ne sont pas passés, aucun ne doit avoir à B un garage, un dépassement, son origine ou son terminus.",
    },
    {
      label:
        "Sur ligne électrifiée : autorisation RSS pour reprendre / cesser le service de la traction électrique",
      helpReference: "DC01506 § 6.3 — Fiches 1 et 3",
      helpText:
        "L'AC de B doit recevoir du Régulateur Sous-Station (RSS) l'autorisation de reprendre ou de cesser le service de la traction électrique. Texte de la dépêche normalisé : « RSS à B : pouvez reprendre/cesser le service de la traction électrique à ..h..mn ».",
    },
    {
      label:
        "Sur ligne régulée 1ère catégorie A : avis verbal au Régulateur + renseignements sur la circulation",
      helpReference: "DC01506 § 6.3 — Fiche 1",
      helpText:
        "Si la gare B est de 1ère catégorie A, le Régulateur transmet à l'AC les renseignements concernant : trains de la période fermée non passés, trains à passer avec mise en marche/suppression/avance annoncées pendant la fermeture.",
    },
    {
      label:
        "Sur ligne non régulée : renseignements sur la circulation transmis par A et C en même temps que l'autorisation de reprise",
      helpReference: "DC01506 § 6.3 — Fiche 2",
      helpText:
        "Les AC des gares encadrantes A et C indiquent verbalement à l'AC de B les trains de la période fermée non encore passés et ceux annoncés en avance / suppression / mise en marche pendant la fermeture.",
    },
    {
      label:
        "Reprise avant l'heure fixée (non prescrite S2A n°5) : renseignement sur trains en marche + avis au conducteur si arrêt normal à B",
      helpReference: "DC01506 § 6.4",
      helpText:
        "L'AC de B se renseigne sur les trains à passer pendant la période exceptionnellement ouverte. Les AC de A et C avisent les conducteurs des trains à arrêt normal à B de la présence exceptionnelle de l'agent SGC chargé de transmettre l'AuM (selon DC01505).",
    },
    {
      label:
        "Prolongation de l'ouverture (non prescrite S2A n°5) : renseignement sur trains en marche + avis au conducteur",
      helpReference: "DC01506 § 6.5",
      helpText:
        "Quand l'AC de B prolonge l'ouverture sans avis S2A temporaire, il se renseigne sur les trains à passer pendant cette période. Les AC encadrantes avisent les conducteurs ayant un arrêt normal à B de la présence exceptionnelle de l'agent SGC.",
    },
    {
      label:
        "Consignation C de caténaire secondaire en cours à la cessation : maintien protection C + avis dépêche au RSS",
      helpReference: "DC01506 Fiche 3 (cessation, encart traction électrique)",
      helpText:
        "Si une consignation C de caténaire secondaire est en cours au moment de la cessation, l'AC de B maintient la protection C et avise par dépêche le RSS de cette situation avant de cesser le service de la traction électrique.",
    },
    {
      label:
        "Vigilance sur la durée d'absence de circulation sur un itinéraire (délai max fixé par documentation locale)",
      helpReference: "DC01506 Commentaires fiches 1 et 2",
      helpText:
        "Lors de la reprise, l'AC s'assure qu'il n'y a pas eu, pendant la fermeture, d'absence de circulation dépassant le délai d'interruption de trafic maximum fixé par la doc locale (interruption longue durée). Évolution introduite par v02 du 30-07-2025.",
    },
    {
      label:
        "Avis aux AC encadrantes de la présence d'agents M&T hors période travail (Consigne contre-sens, contre-voie)",
      helpReference: "DC01506 Commentaires fiche 1",
      helpText:
        "Si les gares encadrantes disposent d'informations de sécurité — par exemple la présence sur les voies d'agents de maintenance de l'infrastructure en dehors de la période de travail indiquée à la Consigne contre-sens, contre-voie — elles en font part à l'AC de B.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 2. Suivi de la circulation en DV
  // ───────────────────────────────────────────────────────────────────────
  "Suivi de la circulation en DV": [
    {
      label:
        "Connaissance du dernier train reçu (gare amont → B) : demande verbale, réponse par dépêche",
      helpReference: "DC01506 § 8.1.2 — Fiche 4.1",
      helpText:
        "Avant un mouvement à contre-voie, VUT ou DFV alors qu'aucun train n'a circulé depuis la reprise, l'AC de B se renseigne auprès de la gare aval (si permanente 1ère cat. A) ou du Régulateur. Demande verbale, réponse par dépêche normalisée.",
    },
    {
      label:
        "Connaissance du dernier train expédié (B → gare aval) : demande verbale, réponse par dépêche",
      helpReference: "DC01506 § 8.1.2 — Fiche 4.1",
      helpText:
        "Symétrique du précédent. L'AC de B se renseigne auprès de la gare amont (si permanente 1ère cat. A) ou du Régulateur. Texte de la dépêche : « A à B : dernier train expédié vers la gare C avant votre reprise est le train n°… à ..h..mn ».",
    },
    {
      label:
        "Vérification croisée AC amont/AC aval du dernier train depuis la cessation de B",
      helpReference: "DC01506 § 8.2.2 — Fiche 5",
      helpText:
        "Quand aucun train n'a circulé depuis la cessation de B et qu'un mouvement contre-voie / VUT / DFV est demandé, l'AC amont vérifie que le dernier train qu'il a expédié vers B est arrivé, puis que le dernier train expédié par B vers la gare aval est bien celui indiqué par cette dernière.",
    },
    {
      label:
        "Adaptation locale si poste régulateur équipé d'un système de suivi (consigne locale spécifique)",
      helpReference: "DC01506 § 8.1.2",
      helpText:
        "Quand le poste de régulation est équipé d'un système de suivi (TST, Oléron, etc.), une consigne locale définit les modalités particulières d'application de la fiche 4.1. La procédure standard est remplacée par les particularités du système.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 3. Transmission ou cessation du service
  // ───────────────────────────────────────────────────────────────────────
  "Transmission ou cessation du service": [
    {
      label:
        "Dérangement du téléphone à la reprise : autorisation transmise via une autre gare ou le Régulateur",
      helpReference: "DC01506 § 7.1.1",
      helpText:
        "L'AC de B ne reprend qu'après autorisation des gares encadrantes A et C. Si le téléphone est dérangé, l'autorisation peut être transmise par l'intermédiaire de l'AC d'une autre gare ou du Régulateur. L'avis de reprise peut être retransmis dans les mêmes conditions.",
    },
    {
      label:
        "Dérangement à la reprise : différer si conditions trains non remplies (pas d'origine, terminus, garage, dépassement à B)",
      helpReference: "DC01506 § 7.1.2",
      helpText:
        "Si à l'heure fixée l'AC de B ne s'est pas manifesté, A et C tentent de le joindre. Sinon ils s'entendent pour différer la reprise sous réserve : pas d'origine/terminus à B, garage ou dépassement possibles en un autre point, suppression possible entre A et B ou C et B.",
    },
    {
      label:
        "Tant que pas d'autorisation RSS sur ligne électrifiée : circulations non électriques OU électriques sans changement de voie / manœuvre uniquement",
      helpReference: "DC01506 § 7.1.3",
      helpText:
        "Sur ligne électrifiée, sans autorisation RSS de reprendre la traction électrique, seules sont autorisées à B : les circulations non électriques, et les circulations électriques franchissant la gare sans changer de voie ni y manœuvrer.",
    },
    {
      label:
        "Dérangement à la cessation : avis par train ou exprès si impossibilité de transmettre la dépêche",
      helpReference: "DC01506 § 7.2.2",
      helpText:
        "L'AC de B transmet la dépêche de cessation via une autre gare ou le Régulateur. En cas d'impossibilité, il avise A ou C par un train ou par exprès, puis cesse le service si rien ne s'y oppose. La gare avisée renseigne l'autre gare par dépêche.",
    },
    {
      label:
        "Absence d'avis de cessation : considérer B non cessée → vérifier physiquement par un agent envoyé à B avant DFV ou contre-voie",
      helpReference: "DC01506 § 7.2.3",
      helpText:
        "En l'absence d'avis, A et C doivent considérer que B n'a pas cessé. Avant d'autoriser une opération de sécurité entre A et C (DFV, mouvement à contre-voie), ils font vérifier par un agent envoyé à B que l'AC y a effectivement cessé le service.",
    },
    {
      label:
        "Textes des dépêches type adaptables localement par documentation opérationnelle",
      helpReference: "DC01506 Fiche 3 note (1)",
      helpText:
        "Les textes de dépêches indiqués (« B à A : dernier train reçu de A est train n°… »…) peuvent être adaptés aux particularités locales (absence de train expédié, etc.) dans la documentation locale opérationnelle. Évolution introduite par v02 du 30-07-2025.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 4. Principes de communication (DC07202)
  // ───────────────────────────────────────────────────────────────────────
  "Principes de communication": [
    {
      label:
        "Choix du moyen de communication adapté (vive voix, exprès, téléphonie, radios, écrit, télécopie, transmission numérique)",
      helpReference: "DC07202 § 2.2",
      helpText:
        "Le DC07202 répertorie 10 moyens de communication possibles : vive voix, exprès, haut-parleur, téléphonie, liaisons radios, documents écrits, interphonie, télécopie, transmission numérique, dispositif d'avertissement sonore. Le choix dépend du contexte (urgence, traçabilité, distance).",
    },
    {
      label:
        "Étapes des communications de sécurité (ouverture, transmission, fermeture)",
      helpReference: "DC07202 § 2.3.2",
      helpText:
        "Une communication de sécurité suit une séquence normalisée : identification émetteur/destinataire, annonce du message, transmission, collationnement par le destinataire, accusé de réception par l'émetteur, fermeture. Le non-respect peut invalider l'ordre transmis.",
    },
    {
      label:
        "Terminologie standardisée et code d'épellation pour noms / numéros de train",
      helpReference: "DC07202 § 2.4 et § 2.5",
      helpText:
        "Le DC07202 fixe la terminologie à utiliser (mots normalisés sans équivoque) et un code d'épellation pour transmettre sans ambiguïté noms de gares, numéros de train, codes formulaires lorsque la qualité audio l'exige.",
    },
    {
      label:
        "Messages à caractère urgent et impératif : annonce préalable et accusé de réception",
      helpReference: "DC07202 § 2.6",
      helpText:
        "Les messages à caractère urgent et impératif (arrêt d'un train, alerte radio, urgence sécurité) bénéficient de règles spécifiques d'annonce préalable, de priorité sur le réseau de communication, et d'accusé de réception explicite.",
    },
    {
      label:
        "Conditions de validité d'une dépêche : émetteur identifié, destinataire confirmé, traçabilité",
      helpReference: "DC07202 § 2.1.2",
      helpText:
        "Une dépêche n'est valide que si l'émetteur s'identifie sans ambiguïté, le destinataire confirme l'identification, le message est tracé (carnet, dispositif d'enregistrement), et l'heure de transmission est notée par les deux parties.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 5. Franchissement des signaux (DC07202 — formulaires d'ordres)
  // ───────────────────────────────────────────────────────────────────────
  "Franchissement des signaux": [
    {
      label:
        "Choix du formulaire selon le signal franchi : IN37 (CBA), IN38 (C), IN82 (MV), IN84 (S)",
      helpReference: "DC07202 Fiches 2 et 12",
      helpText:
        "IN37 CBA : carré de BA, guidon d'arrêt ou TLC damier R/B. IN38 C : carré, guidon d'arrêt ou TLC damier R/B (situation différente). IN82 MV : entrée en canton occupé et marche à vue. IN84 S : sémaphore S. Le choix dépend du signal et de la cause d'arrêt.",
    },
    {
      label:
        "Vérification des conditions d'ouverture avant remise du formulaire de franchissement",
      helpReference: "DC07202 Fiche 12",
      helpText:
        "Avant de remettre un IN37/IN38, l'AC vérifie que les conditions d'ouverture du signal sont réunies hors causes empêchant l'ouverture effective. Cette vérification est tracée dans le carnet de dérangements IS si applicable.",
    },
    {
      label:
        "Rédaction et amortissement du formulaire selon les règles d'annotation",
      helpReference: "DC07202 Fiche 12 — § 12.2 à 12.6",
      helpText:
        "Le formulaire suit des règles précises de remplissage (cases obligatoires alphabétiques/numériques, signature), d'identification émetteur/destinataire, et d'amortissement après usage. Les particularités par formulaire sont en § 12.7.",
    },
    {
      label:
        "Délivrance du formulaire via opérateur intermédiaire (Fiche 10) si l'émetteur ne peut se rendre auprès du conducteur",
      helpReference: "DC07202 Fiche 10",
      helpText:
        "Quand l'opérateur chargé de la remise ne peut se rendre auprès de l'émetteur, le DC07202 décrit deux variantes : (10.1) il peut s'y rendre par anticipation, (10.2) il ne peut pas. Les modalités de transmission et de signature changent selon le cas.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 6. Manœuvre individuelle des appareils de voie (IN39, IN43)
  // ───────────────────────────────────────────────────────────────────────
  "Manœuvre individuelle des appareils de voie": [
    {
      label:
        "Ordre IN39 MAIL — manœuvre d'une aiguille : formulaire normalisé et conditions",
      helpReference: "DC07202 Formulaire IN39",
      helpText:
        "L'ordre IN39 MAIL est remis lorsqu'une aiguille doit être manœuvrée dans des conditions particulières (intervention, contrôle, dérangement). Il identifie l'aiguille, la position requise, et le motif. Doit être amorti après exécution.",
    },
    {
      label:
        "Ordre IN43 VAIG — vérification d'aiguille : formulaire normalisé et conditions",
      helpReference: "DC07202 Formulaire IN43",
      helpText:
        "L'ordre IN43 VAIG prescrit la vérification d'une aiguille (collage, position, état). Émis par l'AC lorsque le contrôle automatique n'est pas concluant ou en cas de doute après dérangement. Tracé au carnet de dérangements IS.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 7. Manœuvre individuelle des signaux (IN40)
  // ───────────────────────────────────────────────────────────────────────
  "Manœuvre individuelle des signaux": [
    {
      label:
        "Ordre IN40 MEQI — manœuvre d'un équipement de sécurité : formulaire normalisé",
      helpReference: "DC07202 Formulaire IN40",
      helpText:
        "L'ordre IN40 MEQI est utilisé lorsqu'un équipement de sécurité (signal, dispositif d'annonce, etc.) doit être manœuvré dans des conditions particulières. Émis par l'AC, il précise l'équipement, l'action, et le motif. Amortissement obligatoire.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 8. Autorisation de mouvement (IE1, IE2, IE7)
  // ───────────────────────────────────────────────────────────────────────
  "Autorisation de mouvement": [
    {
      label:
        "Formulaire IE1 — autorisation de franchir un EOA (End of Authority) : conditions et amortissement",
      helpReference: "DC07202 Formulaire IE1",
      helpText:
        "L'IE1 autorise un conducteur à franchir un EOA en signalisation cabine. Il est utilisé quand le franchissement ne peut pas être autorisé par la signalisation seule. Identification du train, point de franchissement, vitesse maximale précisés.",
    },
    {
      label:
        "Formulaire IE7 — autorisation de se remettre en marche après préparation d'un mouvement",
      helpReference: "DC07202 Formulaire IE7",
      helpText:
        "L'IE7 est remis au conducteur pour autoriser la remise en marche après une préparation d'un mouvement (manœuvre, changement d'extrémité). Il s'inscrit dans une chaîne d'ordres incluant souvent IN61 CHEX (changement d'extrémité).",
    },
    {
      label:
        "Formulaire IE2 — autorisation de circuler après un train trip (déclenchement KVB/ETCS)",
      helpReference: "DC07202 Formulaire IE2",
      helpText:
        "L'IE2 autorise la circulation après le déclenchement d'un train trip (KVB, ETCS). Après vérification des conditions de remise en marche, le formulaire est rédigé et remis au conducteur en respectant les modalités de transmission Fiches 9/10.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 9. Mesures préalables au secours (BC57 DSEC)
  // ───────────────────────────────────────────────────────────────────────
  "Mesures préalables au secours": [
    {
      label:
        "Demande BC57 DSEC — formulaire normalisé d'une demande de secours par le conducteur",
      helpReference: "DC07202 Formulaire BC57",
      helpText:
        "Le BC57 DSEC est la demande de secours formalisée par le conducteur d'un train en détresse. Identifie le train, sa position, la nature de la détresse, et la nécessité de secours. Transmise à l'AC qui en accuse réception.",
    },
    {
      label:
        "Procédure d'envoi du DSEC à l'AC compétent et retransmission éventuelle (Fiche 9)",
      helpReference: "DC07202 Formulaire BC57 — Fiche 9",
      helpText:
        "Le conducteur transmet le DSEC à l'AC en charge. Si l'AC compétent pour organiser le secours est différent (gare aval, régulateur), le compte rendu est retransmis selon Fiche 9. La traçabilité doit être préservée.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 10. Réalisation du secours (BC65 SECO)
  // ───────────────────────────────────────────────────────────────────────
  "Réalisation du secours": [
    {
      label:
        "Ordre BC65 SECO — secours à un train : formulaire normalisé et conditions",
      helpReference: "DC07202 Formulaire BC65",
      helpText:
        "Le BC65 SECO est l'ordre formalisé donné au conducteur de l'EMS (Engin Moteur de Secours) pour porter secours à un train en détresse. Précise le train à secourir, le point de jonction, les conditions de circulation, et le mode de secours.",
    },
    {
      label:
        "Compte rendu de réception du formulaire transmis à l'émetteur (Fiche 9)",
      helpReference: "DC07202 Fiche 9",
      helpText:
        "Après réception d'un ordre, le conducteur transmet un compte rendu à l'OPS émetteur du formulaire (9.1) ou à un autre OPS — gare aval, régulateur — qui retransmettra (9.2). Garantit la chaîne de responsabilité et la traçabilité.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 11. Annulation de la demande de secours (BC58 REMA)
  // ───────────────────────────────────────────────────────────────────────
  "Annulation de la demande de secours": [
    {
      label:
        "Formulaire BC58 REMA — 3 fonctions distinctes : annulation DSEC, demande remise en marche, autorisation remise en marche",
      helpReference: "DC07202 Formulaire BC58",
      helpText:
        "Le BC58 REMA cumule trois fonctions : (1) annulation d'une demande de secours BC57, (2) demande d'autorisation de remise en marche, (3) autorisation de remise en marche. La case cochée détermine la fonction utilisée. Lecture attentive obligatoire.",
    },
    {
      label:
        "Conditions de remise au conducteur après vérification des conditions de remise en marche",
      helpReference: "DC07202 Formulaire BC58 — Fiche 3",
      helpText:
        "L'autorisation de remise en marche (BC58 fonction 3) n'est délivrée qu'après vérification : voie libre devant le train, équipements fonctionnels, absence d'obstacle. La remise au conducteur suit les règles générales d'utilisation des formulaires (Fiche 3).",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 12. Protection d'un conducteur intervenant sur son train ou sur IS
  // ───────────────────────────────────────────────────────────────────────
  "Protection d'un conducteur intervenant sur son train ou sur IS": [
    {
      label:
        "Demande BC56 PERS — formulaire normalisé de protection du personnel",
      helpReference: "DC07202 Formulaire BC56",
      helpText:
        "Le BC56 PERS est la demande formalisée de protection personnel émise par un conducteur ou un agent intervenant sur ou à proximité des voies. Elle ouvre l'application de la procédure d'entente préalable (Fiches 7 ou 8) selon LC ou LGV.",
    },
    {
      label:
        "Différenciation Lignes Conventionnelles (Fiche 7) vs Lignes à Grande Vitesse (Fiche 8) : conditions et vitesse voie contiguë",
      helpReference: "DC07202 Fiches 7 et 8",
      helpText:
        "Sur LC (Fiche 7), 6 situations (intervention côté piste, le long du train, en avant/arrière, entrevoie) avec gradation selon vitesse voie contiguë (≤160 km/h vs 160-220 km/h). Sur LGV (Fiche 8), 4 situations spécifiques (tunnel, tranchée couverte, etc.).",
    },
    {
      label:
        "Protection assurée de fait : cas particuliers où la protection n'a pas à être demandée",
      helpReference: "DC07202 § 7.4 (LC) / § 8.4 (LGV)",
      helpText:
        "Dans certaines situations (train à l'arrêt en gare, absence de voie contiguë circulée, présence de dispositifs de protection collective), la protection du personnel est assurée de fait sans demande PERS. Conditions cumulatives à vérifier.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 13. Protection du personnel (autre que conducteur)
  // ───────────────────────────────────────────────────────────────────────
  "Protection du personnel (autre que conducteur) lors d'interventions sur intallations ou matériels, travaux aux abords des voies, traversée des voies":
    [
      {
        label:
          "Demande BC56 PERS adaptée pour agents non conducteurs (mainteneurs, M&T, prestataires)",
        helpReference: "DC07202 Formulaire BC56",
        helpText:
          "Le BC56 PERS est aussi utilisé par les agents non conducteurs intervenant sur installations, matériels, ou à proximité des voies. La demande indique la nature de l'intervention, la zone concernée, et le périmètre de protection demandé.",
      },
    ],

  // ───────────────────────────────────────────────────────────────────────
  // 14. Petit entretien d'IS (graissage / détos)
  // ───────────────────────────────────────────────────────────────────────
  "Protection du personnel lors d'opérations de petit entretien d'IS (graissage / détos)":
    [
      {
        label:
          "Référence au formulaire BC56 PERS si protection ZD requise pendant l'opération",
        helpReference: "DC07202 Formulaire BC56",
        helpText:
          "Quand le petit entretien d'IS nécessite l'engagement ou le risque d'engagement de la Zone Dangereuse (ZD), la demande PERS BC56 est requise. Pour les opérations sans engagement ZD, l'entente préalable simplifiée (DPGr) suffit.",
      },
    ],
};

async function main() {
  console.log(
    `\n=== Patch Circulation + Communications (DC01506 v02 + DC07202 v02) ===\n`
  );

  // Étape 1 : soft-delete des redondances.
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

  // Étape 2 : renommages.
  console.log("\n--- Renommages ---");
  for (const [oldTitle, newTitle] of Object.entries(TO_RENAME)) {
    const proc = await prisma.procedure.findFirst({
      where: { title: oldTitle, isActive: true },
      select: { id: true },
    });
    if (!proc) {
      // Peut-être déjà renommée (rejeu du script).
      const alreadyRenamed = await prisma.procedure.findFirst({
        where: { title: newTitle, isActive: true },
        select: { id: true },
      });
      if (alreadyRenamed) {
        console.log(`  [skip] "${oldTitle}" → "${newTitle}" — déjà renommée`);
      } else {
        console.log(`  [skip] "${oldTitle}" — introuvable`);
      }
      continue;
    }
    await prisma.procedure.update({
      where: { id: proc.id },
      data: { title: newTitle },
    });
    console.log(`  [rename] "${oldTitle}" → "${newTitle}"`);
  }

  // Étape 3 : enrichissement.
  console.log("\n--- Enrichissement des items ---");
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const [originalTitle, items] of Object.entries(ENRICHMENTS)) {
    // La procédure peut avoir été renommée à l'étape 2 — on cherche
    // d'abord par le nouveau titre, sinon par l'ancien.
    const targetTitle = TO_RENAME[originalTitle] ?? originalTitle;
    const proc =
      (await prisma.procedure.findFirst({
        where: { title: targetTitle, isActive: true },
        select: { id: true, gravity: true, title: true },
      })) ??
      (await prisma.procedure.findFirst({
        where: { title: originalTitle, isActive: true },
        select: { id: true, gravity: true, title: true },
      }));

    if (!proc) {
      console.log(
        `\n  [skip procedure] "${originalTitle}" — introuvable (renommée ?)`
      );
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
          console.log(`    [help-only] ${it.label.slice(0, 60)}…`);
        } else {
          console.log(`    [skip] ${it.label.slice(0, 60)}…`);
        }
        totalSkipped++;
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
