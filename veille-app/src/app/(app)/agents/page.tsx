import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, getSessionUser, teamScope } from "@/lib/auth";
import AgentsListClient from "./AgentsListClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // On charge tous les agents visibles globalement ; la couche personnelle
  // (UserAgentHidden) est appliquée côté client pour permettre le toggle
  // « Afficher les masqués » sans nouvelle requête.
  const agents = await prisma.agent.findMany({
    where: { isActive: true, isVisible: true, ...agentScope(u) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, matricule: true, firstName: true, lastName: true },
  });
  const agentIds = agents.map((a) => a.id);

  // Compteurs alignés EXACTEMENT sur la fiche agent (cf. agents/[id]/page.tsx) :
  //  - actions : cloisonnées par teamScope ET dédupliquées par (teamId, dedupHash)
  //    — sinon le badge affiche un nombre brut ≠ celui de la fiche ;
  //  - sessions (veilles) : cloisonnées par teamScope.
  const [hidden, activeActions, sessionGroups] = await Promise.all([
    prisma.userAgentHidden.findMany({
      where: { userId: u.id },
      select: { agentId: true },
    }),
    agentIds.length
      ? prisma.importedAction.findMany({
          where: { agentId: { in: agentIds }, localStatus: "ACTIVE", ...teamScope(u) },
          select: { id: true, agentId: true, teamId: true, dedupHash: true },
        })
      : Promise.resolve([]),
    agentIds.length
      ? prisma.veilleSession.groupBy({
          by: ["agentId"],
          where: { agentId: { in: agentIds }, ...teamScope(u) },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const hiddenSet = new Set(hidden.map((h) => h.agentId));

  // Dédup actions par agent : clé (teamId|dedupHash) ; sans dedupHash, chaque
  // ligne compte (clé = id), comme sur la fiche.
  const actionKeysByAgent = new Map<string, Set<string>>();
  for (const a of activeActions) {
    if (!a.agentId) continue;
    const key = a.dedupHash ? `${a.teamId}|${a.dedupHash}` : `id:${a.id}`;
    let set = actionKeysByAgent.get(a.agentId);
    if (!set) {
      set = new Set<string>();
      actionKeysByAgent.set(a.agentId, set);
    }
    set.add(key);
  }
  const actionsCountByAgent = new Map<string, number>();
  for (const [agentId, keys] of actionKeysByAgent) {
    actionsCountByAgent.set(agentId, keys.size);
  }
  const sessionsCountByAgent = new Map<string, number>(
    (sessionGroups as { agentId: string | null; _count: { _all: number } }[])
      .filter((g): g is { agentId: string; _count: { _all: number } } => !!g.agentId)
      .map((g) => [g.agentId, g._count._all]),
  );
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
          actionsCount: actionsCountByAgent.get(a.id) ?? 0,
          sessionsCount: sessionsCountByAgent.get(a.id) ?? 0,
          hiddenForMe: hiddenSet.has(a.id),
        }))}
      />
    </div>
  );
}
