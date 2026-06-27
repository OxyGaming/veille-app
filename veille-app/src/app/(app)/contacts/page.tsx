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
    />
  );
}
