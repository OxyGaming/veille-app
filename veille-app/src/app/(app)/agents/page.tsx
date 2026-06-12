import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, getSessionUser } from "@/lib/auth";
import AgentsListClient from "./AgentsListClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // On charge tous les agents visibles globalement ; la couche personnelle
  // (UserAgentHidden) est appliquée côté client pour permettre le toggle
  // « Afficher les masqués » sans nouvelle requête.
  const [agents, hidden] = await Promise.all([
    prisma.agent.findMany({
      where: { isActive: true, isVisible: true, ...agentScope(u) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        _count: {
          select: {
            importedActions: { where: { localStatus: "ACTIVE" } },
            sessions: true,
          },
        },
      },
    }),
    prisma.userAgentHidden.findMany({
      where: { userId: u.id },
      select: { agentId: true },
    }),
  ]);
  const hiddenSet = new Set(hidden.map((h) => h.agentId));
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Agents</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {agents.length} agent(s) — créés/mis à jour à chaque import Excel.
        </p>
      </div>
      <AgentsListClient
        agents={agents.map((a) => ({
          id: a.id,
          matricule: a.matricule,
          firstName: a.firstName,
          lastName: a.lastName,
          actionsCount: a._count.importedActions,
          sessionsCount: a._count.sessions,
          hiddenForMe: hiddenSet.has(a.id),
        }))}
      />
    </div>
  );
}
