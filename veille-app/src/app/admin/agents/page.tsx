import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, effectiveTeamIds, getSessionUser } from "@/lib/auth";
import AgentsAdminClient from "./AgentsAdminClient";

export const dynamic = "force-dynamic";

export default async function AgentsAdminPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN" && u.role !== "EDITOR") redirect("/procedures");
  // Cloisonnement : un EDITOR / ADMIN scopé ne voit que les agents et les
  // équipes de son périmètre (effectiveTeamIds null = global).
  const scopeIds = effectiveTeamIds(u);
  const [agents, teams] = await Promise.all([
    prisma.agent.findMany({
      where: agentScope(u),
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
    prisma.team.findMany({
      where: scopeIds === null ? {} : { id: { in: scopeIds } },
      orderBy: { name: "asc" },
    }),
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
