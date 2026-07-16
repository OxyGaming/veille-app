import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import ContactsListClient from "./ContactsListClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // Cloisonnement (décision §4) : contact sans équipe = commun (visible par
  // tous) ; contact rattaché à une équipe = visible uniquement par cette équipe.
  const [contacts, teams] = await Promise.all([
    prisma.contact.findMany({
      where: { OR: [{ teamId: null }, { ...teamScope(u) }] },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  // Équipes proposées pour la création front-office : restreintes aux
  // équipes de l'utilisateur (jamais "commun"/teamId=null depuis ce front).
  // Un ADMIN global sans équipe propre (`teamIds` vide) garde la liste
  // complète — cohérent avec `canActOnTeam` qui l'autorise sur toute équipe.
  const myTeams =
    u.teamIds.length > 0
      ? teams
          .filter((t) => u.teamIds.includes(t.id))
          .map((t) => ({ id: t.id, name: t.name }))
      : teams.map((t) => ({ id: t.id, name: t.name }));
  return (
    <ContactsListClient
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        teamId: c.teamId,
        teamName: c.teamId ? teamById.get(c.teamId) ?? null : null,
      }))}
      myTeams={myTeams}
      lockedTeamId={myTeams.length === 1 ? myTeams[0].id : null}
    />
  );
}
