/**
 * Nettoyage du jeu de données de PRÉPRODUCTION / TEST.
 *
 * Supprime TOUT ce que le seed a créé **et** les données générées par
 * l'application pendant les tests (validations, sightings, sessions, visites,
 * activités, notifications…), en restant strictement borné au périmètre
 * préprod :
 *  - entités cœur identifiées par leur `id` préfixé `pp-` (cf. constants.ts) ;
 *  - données rattachées supprimées par `teamId` / `userId` du périmètre préprod.
 *
 * Aucune donnée réelle n'est touchée : les `id` `pp-…` ne sont posés que par
 * le seed préprod, jamais par l'application.
 *
 * Usage :
 *   npm run db:seed:preprod:clean
 *   npm run db:seed:preprod:clean -- --force   # ignore le garde-fou prod
 *
 * Ne modifie AUCUN code applicatif.
 */
import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { PP, assertSafeEnvironment, hasFlag } from "./constants";

async function idsWithPrefix<T extends { id: string }>(
  rows: Promise<T[]>,
): Promise<string[]> {
  return (await rows).map((r) => r.id);
}

async function main() {
  assertSafeEnvironment(hasFlag("--force"));
  console.log("→ Cleanup PRÉPROD : résolution du périmètre…");

  // Entités cœur : uniquement celles posées par le seed (id `pp-…`).
  const [teamIds, userIds, agentIds, siteIds, vehicleIds] = await Promise.all([
    idsWithPrefix(prisma.team.findMany({ where: { id: { startsWith: PP } }, select: { id: true } })),
    idsWithPrefix(prisma.user.findMany({ where: { id: { startsWith: PP } }, select: { id: true } })),
    idsWithPrefix(prisma.agent.findMany({ where: { id: { startsWith: PP } }, select: { id: true } })),
    idsWithPrefix(prisma.site.findMany({ where: { id: { startsWith: PP } }, select: { id: true } })),
    idsWithPrefix(prisma.vehicle.findMany({ where: { id: { startsWith: PP } }, select: { id: true } })),
  ]);

  if (teamIds.length === 0 && userIds.length === 0) {
    console.log("✓ Rien à nettoyer (aucune donnée préprod détectée).");
    return;
  }
  console.log(
    `  périmètre : ${teamIds.length} équipes, ${userIds.length} comptes, ` +
      `${agentIds.length} agents, ${siteIds.length} sites, ${vehicleIds.length} véhicule(s)`,
  );

  const byTeam = { teamId: { in: teamIds } };
  const counts: Record<string, number> = {};
  const run = async (label: string, p: Promise<{ count: number }>) => {
    counts[label] = (await p).count;
  };

  // Ordre FK-safe : enfants → parents. Les relations en Cascade/SetNull sont
  // gérées par la base ; on supprime explicitement les relations en Restrict.
  await run("actionValidation", prisma.actionValidation.deleteMany({ where: byTeam }));
  await run("siteVisit", prisma.siteVisit.deleteMany({ where: byTeam })); // cascade NC/obs/participants/reports
  await run("veilleSession", prisma.veilleSession.deleteMany({ where: byTeam })); // cascade procObs/items/comments/photos/reports
  await run("vehicleRound", prisma.vehicleRound.deleteMany({ where: byTeam })); // cascade observations/NC/reports
  await run("agentSighting", prisma.agentSighting.deleteMany({ where: byTeam }));
  await run("siteSighting", prisma.siteSighting.deleteMany({ where: byTeam }));
  await run("importedAction", prisma.importedAction.deleteMany({ where: byTeam }));
  await run("actionImport", prisma.actionImport.deleteMany({ where: byTeam }));
  await run("planningShift", prisma.planningShift.deleteMany({ where: byTeam }));
  await run("planningImport", prisma.planningImport.deleteMany({ where: byTeam }));
  await run("teamActivity", prisma.teamActivity.deleteMany({ where: byTeam }));
  await run("notification", prisma.notification.deleteMany({ where: { userId: { in: userIds } } }));

  // Référentiel préprod (procédures + items via cascade) — id `pp-…` only.
  await run("procedure", prisma.procedure.deleteMany({ where: { id: { startsWith: PP } } }));

  // Entités cœur (cascade des tables de jonction et liens restants).
  await run("vehicle", prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } }));
  await run("agent", prisma.agent.deleteMany({ where: { id: { in: agentIds } } }));
  await run("site", prisma.site.deleteMany({ where: { id: { in: siteIds } } }));
  await run("user", prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  await run("team", prisma.team.deleteMany({ where: { id: { in: teamIds } } }));

  console.log("✓ Cleanup PRÉPROD terminé. Lignes supprimées :");
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) console.log(`     - ${k}: ${v}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✗ Cleanup PRÉPROD échoué :", e);
    await prisma.$disconnect();
    process.exit(1);
  });
