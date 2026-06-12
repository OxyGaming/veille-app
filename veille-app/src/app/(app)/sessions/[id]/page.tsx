import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, getSessionUser, teamScope } from "@/lib/auth";
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
  return (
    <SessionClient
      session={JSON.parse(JSON.stringify(session))}
      agents={agents.map((a) => ({
        id: a.id,
        label: `${a.lastName} ${a.firstName} (${a.matricule})`,
      }))}
    />
  );
}
