import { prisma } from "@/lib/prisma";
import AgentsAdminClient from "./AgentsAdminClient";

export const dynamic = "force-dynamic";

export default async function AgentsAdminPage() {
  const [agents, teams] = await Promise.all([
    prisma.agent.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        memberships: { include: { team: true } },
        _count: {
          select: {
            importedActions: { where: { localStatus: "ACTIVE" } },
            sessions: true,
          },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <AgentsAdminClient
      initial={agents.map((a) => ({
        id: a.id,
        matricule: a.matricule,
        firstName: a.firstName,
        lastName: a.lastName,
        isActive: a.isActive,
        isVisible: a.isVisible,
        teamIds: a.memberships.map((m) => m.teamId),
        teamNames: a.memberships.map((m) => m.team.name),
        actionsCount: a._count.importedActions,
        sessionsCount: a._count.sessions,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
