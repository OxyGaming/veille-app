/**
 * Crée (ou met à jour) un utilisateur avec mot de passe hashé.
 *
 * Usage :
 *   npx tsx prisma/create-user.ts <email> <password> <role> [team-name]
 *
 *   role ∈ ADMIN | EDITOR | USER
 *   team-name : nom exact d'une équipe existante (optionnel) ;
 *               défaut = première équipe trouvée
 *
 * Exemple :
 *   npx tsx prisma/create-user.ts jessie.achille@reseau.sncf.fr 'D8ix3Bisncf!' ADMIN
 *
 * Idempotent : si l'email existe déjà, on met à jour le rôle et le mot
 * de passe (utile pour reset).
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const [email, password, role, teamName] = process.argv.slice(2);
  if (!email || !password || !role) {
    console.error(
      "Usage : npx tsx prisma/create-user.ts <email> <password> <role> [team-name]"
    );
    process.exit(1);
  }
  if (!["ADMIN", "EDITOR", "USER"].includes(role)) {
    console.error("Role invalide. Choisis : ADMIN, EDITOR ou USER");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Mot de passe trop court (6 caractères minimum).");
    process.exit(1);
  }

  // Équipe cible.
  const team = teamName
    ? await prisma.team.findFirst({ where: { name: teamName } })
    : await prisma.team.findFirst({ orderBy: { name: "asc" } });
  if (!team) {
    console.error(
      teamName
        ? `Équipe « ${teamName} » introuvable.`
        : "Aucune équipe en base — lance d'abord le seed."
    );
    process.exit(1);
  }

  const lowerEmail = email.trim().toLowerCase();
  const name = lowerEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

  // Upsert.
  const existing = await prisma.user.findUnique({
    where: { email: lowerEmail },
  });
  const hashed = hashPassword(password);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashed,
        role,
        teamId: team.id,
        isActive: true,
      },
    });
    console.log(
      `✓ Utilisateur ${lowerEmail} mis à jour (rôle ${role}, équipe « ${team.name} »).`
    );
  } else {
    const u = await prisma.user.create({
      data: {
        email: lowerEmail,
        name,
        password: hashed,
        role,
        teamId: team.id,
        memberships: { create: { teamId: team.id } },
      },
    });
    console.log(
      `✓ Utilisateur créé : ${u.email} — nom « ${u.name} » — rôle ${role} — équipe « ${team.name} »`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
