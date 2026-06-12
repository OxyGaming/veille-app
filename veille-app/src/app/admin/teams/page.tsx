import { prisma } from "@/lib/prisma";
import TeamsClient from "./TeamsClient";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, agents: true, sessions: true } },
    },
  });
  return (
    <TeamsClient
      initial={teams.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        isActive: t.isActive,
        users: t._count.users,
        agents: t._count.agents,
        sessions: t._count.sessions,
      }))}
    />
  );
}
