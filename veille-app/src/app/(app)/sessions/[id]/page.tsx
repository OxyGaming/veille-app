import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, effectiveTeamIds, getSessionUser, teamScope } from "@/lib/auth";
import { getAgentsPlanningHints } from "@/lib/today/planning";
import SessionClient from "./SessionClient";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const session = await prisma.veilleSession.findFirst({
    where: { id, ...teamScope(u) },
    include: {
      agent: true,
      observer: { select: { id: true, name: true } },
      poste: true,
      secteur: true,
      procedures: {
        include: {
          procedure: true,
          items: {
            include: {
              checklistItem: true,
              photos: { select: { id: true, storagePath: true, legend: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });
  if (!session) notFound();
  const agents = await prisma.agent.findMany({
    where: { isVisible: true, isActive: true, ...agentScope(u) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });
  // C4 — enrichit chaque agent avec son statut planning du jour, en une
  // seule requête SQL (pas de N+1). Le scope est déjà appliqué sur `agents`
  // ci-dessus : la map planning ne réintroduit JAMAIS d'agent hors scope.
  const planningHints = await getAgentsPlanningHints(
    agents.map((a) => a.id),
    new Date(),
    effectiveTeamIds(u),
  );
  return (
    <SessionClient
      session={JSON.parse(JSON.stringify(session))}
      agents={agents.map((a) => ({
        id: a.id,
        label: `${a.lastName} ${a.firstName} (${a.matricule})`,
        hint: planningHints.get(a.id),
      }))}
    />
  );
}
