/**
 * Runner standalone : synchronise uniquement les modèles de visite.
 *
 * Utilisé en déploiement (update.sh) après `prisma migrate deploy` pour
 * poser les templates de visite en base sans lancer tout le seed (n'ajoute
 * ni admin, ni procédures). Idempotent — voir `syncVisitTemplates`.
 *
 *   npm run db:sync-templates
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncVisitTemplates } from "./sync-visit-templates";

async function main() {
  await syncVisitTemplates();
  console.log("Modèles de visite synchronisés.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
