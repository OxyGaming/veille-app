/**
 * Patch idempotent — DC01560 v12 (07-01-2026) + DC03858 v2 (26-03-2014)
 * "Poste tout Relais à Transit Souple (PRS)" et
 * "Poste d'aiguillage à leviers individuels".
 *
 * Les 2 documents traitent du même sujet (poste d'aiguillage) mais pour
 * 2 technologies distinctes :
 *   - DC01560 : PRS = technologie moderne, document récent
 *   - DC03858 : leviers individuels = technologie ancienne (12 ans)
 *
 *   1) Soft-delete : "Poste à commande d'itinéraire" (sous-ensemble
 *      strict de "Manoeuvre des installations" qui couvre PCI + IPCS).
 *
 *   2) Enrichissement de 5 procédures (+24 items) :
 *        - Manoeuvre des installations (+12 — DC01560 Fiches 100-113,
 *          DC03858 Articles 201-222 + Chapitre 5)
 *        - Modification d'itinéraire (+5 — DC01560 Fiches 203, 204,
 *          DC03858 Articles 302, 303, 304)
 *        - Parcours non prévus (+3 — DC01560 Fiche 202,
 *          DC03858 Article 301)
 *        - Franchissement des signaux (+2 — dérangements signaux
 *          DC01560 Fiche 309.4, DC03858 Article 415)
 *        - 1ère Cat. / DATIS (+2 — chapitres dérangements DC01560
 *          et DC03858 référencés pour les travaux sur IS)
 *
 *   Idempotence : (procedureTitle, label) — pas de doublons si rejoué.
 *
 *   Lancement : npx tsx prisma/patch-dc01560-dc03858.ts
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

const TO_SOFT_DELETE = ["Poste à commande d'itinéraire"];

const ENRICHMENTS: Record<string, NewItem[]> = {
  // ───────────────────────────────────────────────────────────────────────
  // Manoeuvre des installations (+12 items — PRS + leviers individuels)
  // ───────────────────────────────────────────────────────────────────────
  "Manoeuvre des installations": [
    {
      label:
        "PRS — Caractéristiques générales (table de commande, TCO, principes de contrôle)",
      helpReference: "DC01560 Fiche 101",
      helpText:
        "Sur un Poste tout Relais à Transit Souple : connaître la table de commande, le Tableau de Contrôle Optique (TCO), les principes des contrôles (signaux, appareils de voie, enclenchements). La maîtrise de ces caractéristiques est préalable à toute manœuvre.",
    },
    {
      label:
        "PRS — Commande, formation et établissement d'un itinéraire",
      helpReference: "DC01560 Fiche 102",
      helpText:
        "Procédure standard PRS : commande (déclenchement par l'aiguilleur), formation (mise en place des éléments), établissement (verrouillage et ouverture du signal). Chaque étape est tracée par le TCO et par l'enregistrement.",
    },
    {
      label:
        "PRS — Destruction d'un itinéraire (DA automatique, DM manuelle, DMT temporisée)",
      helpReference: "DC01560 Fiches 103, 103.1, 103.2",
      helpText:
        "3 modes de destruction d'itinéraire en PRS : Destruction Automatique (DA, au passage du train), Destruction Manuelle (DM, par l'aiguilleur), Destruction Manuelle Temporisée (DMT, après délai si conditions sécurité). Choix selon contexte.",
    },
    {
      label:
        "PRS — Tracé permanent d'un itinéraire (TP) et prise d'autorisations",
      helpReference: "DC01560 Fiches 104 à 107",
      helpText:
        "Le tracé permanent (TP) maintient un itinéraire en place pour des passages successifs. Les autorisations (commande, formation, prise, restitution, destruction) suivent un cycle de vie tracé à l'enregistrement (Fiche 107).",
    },
    {
      label:
        "PRS — Enclenchements (transit, approche, parcours, sens contraires)",
      helpReference: "DC01560 Fiches 108-110",
      helpText:
        "Les enclenchements protègent contre les manœuvres conflictuelles : transit (zone isolée), approche/parcours (s'opposent à la destruction manuelle), entre itinéraires de sens contraires (DMT, parcours banalisé, voie unique, voie stationnement, affrontement, sens).",
    },
    {
      label:
        "PRS — Enclenchements convergence, interpénétration, CIP, zone protection/espacement, proximité",
      helpReference: "DC01560 Fiches 111, 112",
      helpText:
        "Convergence et interpénétration : Fiche 111. Autres enclenchements s'opposant à l'établissement : Contrôle Impératif Permanent d'aiguilles (CIP), zone de protection, zone d'espacement automatique, enclenchement de proximité (Fiche 112).",
    },
    {
      label:
        "PRS — Dispositions diverses (boulon calage, cadenas, dispositifs attention/réflexion)",
      helpReference: "DC01560 Fiche 113",
      helpText:
        "Dispositifs annexes : boulons de calage (immobilisation mécanique), cadenas (interdiction de manœuvre), dispositifs d'attention et spéciaux d'attention, dispositifs de réflexion, dispositifs de contrôle d'utilisation. Mesures spécifiques temps de neige/grand froid.",
    },
    {
      label:
        "Leviers individuels — Enclenchements mécaniques et électriques",
      helpReference: "DC03858 Articles 201, 202, 212-222",
      helpText:
        "Sur poste à leviers individuels : enclenchements mécaniques (Art. 201), enclenchements électriques (Art. 202), CIP et CIF (Art. 212-213), zone isolée (Art. 214), transit (Art. 215), approche (Art. 216), parcours (Art. 217). Chaque enclenchement a son protocole de gestion.",
    },
    {
      label:
        "Leviers individuels — Signalisation, AdV, contrôles, espacement",
      helpReference: "DC03858 Articles 203-211",
      helpText:
        "Signalisation (Art. 203), appareils de voie (Art. 204), dispositifs de contrôle (Art. 205), répétition et appui acoustique (Art. 206), contrôle de vitesse (Art. 207), espacement (Art. 208), détecteurs danger (Art. 209), dispositifs PN gardés (Art. 210), PN à SAL voisins de gare (Art. 211).",
    },
    {
      label:
        "Leviers individuels — Dispositifs annexes (boulon, cadenas, réflexion, interdiction)",
      helpReference: "DC03858 Chapitre 5 (Art. 501-508)",
      helpText:
        "Mêmes dispositifs annexes que le PRS, gestion adaptée aux leviers individuels : boulon de calage, dispositifs d'attention, dispositifs de réflexion, dispositifs d'interdiction, cadenas, coupons, compteur, conditions d'utilisation annulateurs et garage.",
    },
    {
      label:
        "Mesures à prendre par temps de neige ou grand froid (PRS et leviers)",
      helpReference: "DC01560 Fiche 113 + DC03858 Art. 509",
      helpText:
        "Conditions météo extrêmes : risque de blocage des appareils de voie, gel des contacts, vérification renforcée. Mesures spécifiques décrites pour chaque type de poste. Coordination avec mainteneur en cas de difficulté.",
    },
    {
      label:
        "Vérifications avant et après manœuvre — bonnes pratiques transverses",
      helpReference: "DC01560 Fiche 101 + DC03858 Art. 105",
      helpText:
        "Avant manœuvre : connaître l'état des installations (TCO, levée enclenchements en cours), respecter la position prévue. Après : vérifier l'effectivité de la manœuvre (contrôle de fermeture/ouverture, position attendue), tracer dans le registre.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Modification d'itinéraire (+5)
  // ───────────────────────────────────────────────────────────────────────
  "Modification d'itinéraire": [
    {
      label:
        "PRS — Modification d'itinéraire : procédure standard",
      helpReference: "DC01560 Fiche 203",
      helpText:
        "Sur PRS : la modification d'itinéraire nécessite d'abord la destruction de l'itinéraire en cours (DM ou DMT selon enclenchements actifs), puis la commande du nouvel itinéraire. Vérification que le signal d'origine est compatible avec la modification.",
    },
    {
      label:
        "PRS — Arrêt accidentel d'une circulation sur un itinéraire",
      helpReference: "DC01560 Fiche 204",
      helpText:
        "Arrêt accidentel : le train s'est arrêté avant le point de destruction automatique. L'aiguilleur applique la procédure spécifique (vérification position, gestion enclenchements, redémarrage ou destruction manuelle si abandon).",
    },
    {
      label:
        "Leviers individuels — Modification avec signal soumis à enclenchement d'approche",
      helpReference: "DC03858 Article 302",
      helpText:
        "Quand le signal d'origine est soumis à l'enclenchement d'approche : la modification ne peut se faire que dans certaines conditions (avant que l'enclenchement ne se réalise, OU après son annulation). Procédure spécifique à respecter.",
    },
    {
      label:
        "Leviers individuels — Modification avec signal soumis à enclenchement de parcours",
      helpReference: "DC03858 Article 303",
      helpText:
        "Quand le signal d'origine est soumis à l'enclenchement de parcours (circulation a franchi le signal) : la modification d'itinéraire en aval suit des règles distinctes. Vérification de l'absence de la circulation sur la portion à modifier.",
    },
    {
      label:
        "Leviers individuels — Arrêt accidentel d'une circulation sur un itinéraire",
      helpReference: "DC03858 Article 304",
      helpText:
        "Procédure équivalente à DC01560 Fiche 204 mais adaptée aux postes à leviers individuels : pas de TCO mais des indications mécaniques. Vérification de la position du train via les contrôles disponibles, gestion des enclenchements en place.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Parcours non prévus (+3)
  // ───────────────────────────────────────────────────────────────────────
  "Parcours non prévus": [
    {
      label:
        "PRS — Parcours non prévus : procédure générale",
      helpReference: "DC01560 Fiche 202",
      helpText:
        "Un parcours non prévu est un mouvement n'ayant pas d'itinéraire enregistré standard (manœuvre exceptionnelle, dévoiement). En PRS : vérification compatibilité avec enclenchements en place, commande pas-à-pas si possible, tracé spécifique au registre.",
    },
    {
      label:
        "Leviers individuels — Parcours non prévus : procédure",
      helpReference: "DC03858 Article 301",
      helpText:
        "Sur poste à leviers individuels : la commande pas-à-pas est plus mécanique. L'aiguilleur vérifie chaque levier, chaque enclenchement. La traçabilité passe par le registre manuel. Cas d'usage : manœuvres techniques, mouvements de récupération.",
    },
    {
      label:
        "Vérification compatibilité avec enclenchements existants avant tout parcours non prévu",
      helpReference: "DC01560 § 7 + DC03858 Art. 201-222",
      helpText:
        "Avant tout parcours non prévu, vérification systématique : enclenchements CIP/CIF actifs, présence de zones isolées en transit, position des AdV. Le moindre conflit empêche la manœuvre — diagnostic avec mainteneur si blocage.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // Franchissement des signaux (+2 — dérangements signaux)
  // ───────────────────────────────────────────────────────────────────────
  "Franchissement des signaux": [
    {
      label: "PRS — Dérangement des signaux",
      helpReference: "DC01560 Fiche 309.4",
      helpText:
        "Un signal en dérangement (refus d'ouverture, ouverture intempestive, extinction) déclenche une procédure spécifique : arrêt circulations, vérification visuelle, ordre de franchissement formel via formulaire IN37/IN38/IN84 selon le type de signal. Avis au mainteneur.",
    },
    {
      label: "Leviers individuels — Dérangement des signaux",
      helpReference: "DC03858 Article 415",
      helpText:
        "Sur poste à leviers individuels : dérangement signaux traité avec les mêmes principes (formulaires de franchissement) mais sans appui du TCO. L'aiguilleur s'appuie sur les contrôles mécaniques disponibles et les communications conducteur.",
    },
  ],

  // ───────────────────────────────────────────────────────────────────────
  // 1ère Cat. / DATIS (+2 — référencement chapitres dérangements)
  // ───────────────────────────────────────────────────────────────────────
  "1ère Cat. / DATIS": [
    {
      label:
        "Référencement des chapitres « Dérangements » des consignes de poste lors d'une DATIS",
      helpReference: "DC01560 Chapitre 3 + DC03858 Chapitre 4",
      helpText:
        "Lors d'une Demande d'Aide pour Travaux sur IS (DATIS), le poste concerné (PRS ou leviers individuels) applique le chapitre Dérangements de sa consigne propre : DC01560 Chap. 3 (Fiches 300-317) pour PRS, DC03858 Chap. 4 (Art. 401-420) pour leviers individuels.",
    },
    {
      label:
        "Annulation de transit (zone en dérangement) — procédure à respecter pour libérer un AdV",
      helpReference: "DC01560 Fiches 314-316",
      helpText:
        "Avant d'annuler une zone en dérangement bloquant un AdV : vérification que la zone est physiquement libre, mesures préalables tracées (Fiche 314), annulation directe (315) ou autorisation d'annulation (316). Procédure tracée et avis mainteneur.",
    },
  ],
};

async function main() {
  console.log(
    `\n=== Patch DC01560 v12 (07-01-2026) + DC03858 v2 (26-03-2014) ===\n`
  );

  // Étape 1 : soft-delete du doublon.
  console.log("--- Soft-delete du doublon ---");
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

  // Étape 2 : enrichissement.
  console.log("\n--- Enrichissement des procédures ---");
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
