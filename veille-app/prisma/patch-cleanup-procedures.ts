/**
 * Patch idempotent — Nettoyage des procédures après import du référentiel
 * « Procédures.xlsx » (juillet 2026).
 *
 * Deux opérations, par CLÉS NATURELLES (domain + title) — jamais par id,
 * car les cuid diffèrent entre dev et prod :
 *
 *   ÉTAPE 1 — Fusion des doublons EXACTS (même domaine + même titre, tous
 *   deux actifs). Détectés génériquement. La copie conservée est celle qui
 *   porte le plus d'observations (départage : la plus ancienne). Les
 *   observations de la/les copie(s) en trop sont rapatriées sur la copie
 *   conservée (re-pointage `ProcedureObservation.procedureId`, et remise en
 *   correspondance des `ObservationItem` par libellé). La copie en trop est
 *   ensuite désactivée (soft-delete). Aucune observation n'est perdue.
 *   Cas connu : « Gares temporaires / Gares permanentes autorisées à
 *   s'absenter » (domaine « Circulation »), présent en double.
 *
 *   ÉTAPE 2 — Désactivation des 30 procédures abandonnées (laissées sans
 *   checklist dans le référentiel, cf. décision périmètre). Soft-delete
 *   (`isActive=false`) : elles disparaissent des nouvelles veilles, mais
 *   l'historique reste intact et l'opération est réversible.
 *
 * Sûreté :
 *   - Idempotent : rejouable sans effet de bord (skip si déjà traité).
 *   - Chaque fusion de doublon est atomique (transaction).
 *   - Mode simulation : `DRY_RUN=1 npx tsx prisma/patch-cleanup-procedures.ts`
 *     n'écrit rien, se contente de logger ce qui serait fait.
 *
 * ⚠️ SAUVEGARDER LA BASE PROD AVANT (copie du fichier .db, ou dump).
 *
 * Ordre recommandé sur prod :
 *   1) sauvegarde de la base
 *   2) import de `procedures-2026-07-01.json` via Admin → Procédures (Fusion)
 *   3) ce script
 *
 * Lancement : npx tsx prisma/patch-cleanup-procedures.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const DRY_RUN = process.env.DRY_RUN === "1";


// Jeux de code points d'apostrophe a unifier : droites/typographiques
// (U+2018/2019/201B/02BC), accent grave/aigu (U+0060/U+00B4), et surtout
// les octets Windows-1252 mal decodes (U+0091/U+0092) que la base contient
// la ou le fichier source avait une apostrophe droite -- voire aucune.
const APOSTROPHES = new Set([
  0x2018, 0x2019, 0x201b, 0x02bc, 0x0060, 0x00b4, 0x0091, 0x0092, 0x0027,
]);

/** Normalisation robuste d'une cle texte (casse, espaces, apostrophes). */
const norm = (s: string) =>
  Array.from(s, (c) => (APOSTROPHES.has(c.codePointAt(0)!) ? "'" : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// ─── Les 30 procédures abandonnées (sans checklist, hors référentiel) ────────
const ABANDONED: { domain: string; title: string }[] = [
  { domain: "Acheminement des transports avec particularités", title: "Transport Exceptionnel (TE)" },
  { domain: "Acheminement des transports avec particularités", title: "Conditions météorologiques extrêmes (neige, givre, verglas, vents)" },
  { domain: "Acheminement des transports avec particularités", title: "Acheminement de matières radioactives" },
  { domain: "Circulation", title: "Suivi de la circulation en DV" },
  { domain: "Dégagement des VP", title: "Annulation de la demande de secours" },
  { domain: "Manœuvre et utilisation des IS", title: "Manœuvre individuelle des appareils de voie" },
  { domain: "Manœuvre et utilisation des IS", title: "Manœuvre individuelle des signaux" },
  { domain: "Mouvement", title: "Voie Unique Temporaire (VUT) inopinée" },
  { domain: "Mouvement", title: "Réception d'un train sur un bloc" },
  { domain: "SECURITE DU PERSONNEL", title: "Connaissance des Régles qui Sauvent" },
  // NB : la base stocke des apostrophes (m'engage / n'engage) là où le fichier
  // source les avait omises ; `norm()` unifie les styles d'apostrophe.
  { domain: "SST opérationnelle", title: "RQS : Je ne m'engage jamais et n'engage jamais du matériel dans la ZD sans mesures de protection (Risque de heurt ferroviaire)" },
  { domain: "SST opérationnelle", title: "Risque de heurt ferroviaire" },
  { domain: "STEM", title: "Exécution de la STEM" },
  { domain: "Situations perturbées / Incidents", title: "Incidents Passages à Niveau" },
  { domain: "Situations perturbées / Incidents", title: "Présence de personnes sur ou aux abords des voies" },
  { domain: "Situations perturbées / Incidents", title: "Émission du SAR (Signal d'Alarme Radio)" },
  { domain: "Situations perturbées / Incidents", title: "Anomalies de signalisation portée par les trains" },
  { domain: "Situations perturbées / Incidents", title: "Évacuation et transbordement train voyageurs" },
  { domain: "Situations perturbées / Incidents", title: "Dérive d'un train ou d'un véhicule" },
  { domain: "Situations perturbées / Incidents", title: "Détection incendie dans un local d'IS" },
  { domain: "Situations perturbées / Incidents", title: "Coupure d'urgence en cas de risque électrique" },
  { domain: "Situations perturbées / Incidents", title: "Intervention des agents de la Sûreté Ferroviaire (SUGE)" },
  { domain: "Situations perturbées / Incidents", title: "Anomalie MD sur un train en circulation" },
  { domain: "Situations perturbées / Incidents", title: "Indisponibilité des outils digitaux - Mise en oeuvre des PCA" },
  { domain: "Situations perturbées / Incidents", title: "Train circulant dans des conditions dangereuses" },
  { domain: "Traction électrique", title: "Mise hors tension / condamnation" },
  { domain: "Traction électrique", title: "Passage d'une circulation bimode sous caténaire privée de tension" },
  { domain: "Traction électrique", title: "Protection C" },
  { domain: "Traction électrique", title: "Suppression de la tension sur El. de caténaire secondaire" },
  { domain: "Traitement des dérangements", title: "Dérangement des IS et IS sensibles" },
];

/**
 * Fusionne une procédure « doublon » dans une procédure « conservée » de même
 * (domaine, titre). Chaque observation du doublon est simplement rattachée à
 * la copie conservée (re-pointage `ProcedureObservation.procedureId`), puis le
 * doublon est désactivé (procédure + items).
 *
 * On ne re-mappe PAS les `ObservationItem` : le rapport lit le libellé/état
 * directement depuis l'item observé (`ObservationItem → checklistItem`, cf.
 * sessions/[id]/page.tsx), pas depuis les items courants de la procédure. Le
 * re-pointage de la seule observation suffit donc, et l'historique reste fidèle
 * à ce qui a été observé (y compris si un libellé d'item avait divergé entre
 * les deux copies). Les items du doublon sont conservés en base (désactivés) —
 * la FK RESTRICT `ObservationItem → ChecklistItem` reste satisfaite.
 *
 * Retourne true si le doublon a été entièrement fusionné et désactivé.
 */
async function mergeDuplicate(keeperId: string, dupId: string, label: string) {
  const dupObs = await prisma.procedureObservation.findMany({
    where: { procedureId: dupId },
    select: { id: true, sessionId: true },
  });

  // Sessions déjà observées côté conservée → risque de collision sur la
  // contrainte unique [sessionId, procedureId].
  const keeperSessions = new Set(
    (
      await prisma.procedureObservation.findMany({
        where: { procedureId: keeperId },
        select: { sessionId: true },
      })
    ).map((o) => o.sessionId)
  );

  let movedObs = 0;
  let blocked = false;

  for (const po of dupObs) {
    if (keeperSessions.has(po.sessionId)) {
      // La session a observé les DEUX copies → re-pointer violerait l'unicité.
      // On laisse ce doublon en l'état (non désactivé) et on signale : fusion
      // manuelle requise pour ce cas (non rencontré à ce jour).
      console.warn(
        `      ⚠ collision session ${po.sessionId} sur « ${label} » — ` +
          `observation laissée sur le doublon, fusion manuelle requise`
      );
      blocked = true;
      continue;
    }
    if (!DRY_RUN) {
      await prisma.procedureObservation.update({
        where: { id: po.id },
        data: { procedureId: keeperId },
      });
    }
    keeperSessions.add(po.sessionId);
    movedObs++;
  }

  // Désactivation du doublon (procédure + items) uniquement si toutes ses
  // observations ont pu être rattachées.
  const fullyMerged = !blocked;
  if (fullyMerged && !DRY_RUN) {
    await prisma.$transaction([
      prisma.checklistItem.updateMany({
        where: { procedureId: dupId },
        data: { isActive: false },
      }),
      prisma.procedure.update({
        where: { id: dupId },
        data: { isActive: false },
      }),
    ]);
  }

  console.log(
    `      → ${movedObs} observation(s) rattachée(s)` +
      (fullyMerged
        ? " — doublon désactivé"
        : " — doublon CONSERVÉ (voir avertissements)")
  );
  return fullyMerged;
}

async function main() {
  console.log(
    `\n=== Nettoyage procédures ${DRY_RUN ? "(DRY-RUN — aucune écriture)" : ""} ===\n`
  );

  // ─── ÉTAPE 1 : fusion des doublons exacts ──────────────────────────────────
  console.log("--- Étape 1 : fusion des doublons exacts (domaine + titre) ---");
  const actives = await prisma.procedure.findMany({
    where: { isActive: true },
    select: { id: true, domain: true, title: true, createdAt: true },
  });

  // Regroupement par clé naturelle normalisée.
  const groups = new Map<string, typeof actives>();
  for (const p of actives) {
    const key = `${norm(p.domain)}||${norm(p.title)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
  }

  let dupGroups = 0;
  let mergedCount = 0;
  for (const [, rows] of groups) {
    if (rows.length < 2) continue;
    dupGroups++;
    const label = `${rows[0].domain} / ${rows[0].title}`;
    console.log(`  ▸ Doublon (${rows.length} copies actives) : « ${label} »`);

    // Comptage des observations par copie pour choisir la copie conservée.
    const withCounts = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        obs: await prisma.procedureObservation.count({
          where: { procedureId: r.id },
        }),
      }))
    );
    // Conservée = plus d'observations, puis la plus ancienne (déterministe).
    withCounts.sort(
      (a, b) => b.obs - a.obs || a.createdAt.getTime() - b.createdAt.getTime()
    );
    const keeper = withCounts[0];
    console.log(
      `      conservée : id=${keeper.id} (${keeper.obs} obs) ; ` +
        `${withCounts.length - 1} copie(s) à fusionner`
    );
    for (const dup of withCounts.slice(1)) {
      if (await mergeDuplicate(keeper.id, dup.id, label)) mergedCount++;
    }
  }
  if (dupGroups === 0) console.log("  (aucun doublon exact détecté)");

  // ─── ÉTAPE 2 : désactivation des procédures abandonnées ────────────────────
  // Matching par clé naturelle NORMALISÉE (apostrophes/espaces) contre toutes
  // les procédures chargées, plutôt qu'un `where` exact — la base peut stocker
  // des variantes de ponctuation (apostrophe typographique) absentes de la
  // liste ci-dessous.
  console.log("\n--- Étape 2 : désactivation des procédures abandonnées ---");
  const all = await prisma.procedure.findMany({
    select: { id: true, domain: true, title: true, isActive: true },
  });
  const byKey = new Map<string, typeof all>();
  for (const p of all) {
    const key = `${norm(p.domain)}||${norm(p.title)}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(p);
    else byKey.set(key, [p]);
  }

  let deactivated = 0;
  let alreadyOff = 0;
  let notFound = 0;
  for (const { domain, title } of ABANDONED) {
    const rows = byKey.get(`${norm(domain)}||${norm(title)}`) ?? [];
    if (rows.length === 0) {
      notFound++;
      console.log(`  [absente] ${domain} / ${title}`);
      continue;
    }
    for (const r of rows) {
      if (!r.isActive) {
        alreadyOff++;
        continue;
      }
      if (!DRY_RUN) {
        await prisma.procedure.update({
          where: { id: r.id },
          data: { isActive: false },
        });
      }
      deactivated++;
      console.log(`  [désactivée] ${r.domain} / ${r.title}`);
    }
  }

  // ─── Bilan ────────────────────────────────────────────────────────────────
  const activeAfter = await prisma.procedure.count({ where: { isActive: true } });
  console.log(
    `\n=== Bilan ${DRY_RUN ? "(simulation)" : ""} ===\n` +
      `  Doublons fusionnés     : ${mergedCount}\n` +
      `  Abandonnées désactivées: ${deactivated} ` +
      `(déjà inactives : ${alreadyOff}, absentes : ${notFound})\n` +
      `  Procédures actives ${DRY_RUN ? "(inchangé)" : "restantes"} : ${activeAfter}\n`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
