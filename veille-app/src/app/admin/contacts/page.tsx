import { prisma } from "@/lib/prisma";
import ContactsClient from "./ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, teams] = await Promise.all([
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <ContactsClient
      initial={contacts}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
