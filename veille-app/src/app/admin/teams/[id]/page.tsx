import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TeamDetailClient from "./TeamDetailClient";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      userMemberships: { include: { user: true } },
      agentMemberships: { include: { agent: true } },
    },
  });
  if (!team) notFound();
  const [allUsers, allAgents] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.agent.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        matricule: true,
        firstName: true,
        lastName: true,
        isVisible: true,
      },
    }),
  ]);
  return (
    <TeamDetailClient
      team={{
        id: team.id,
        name: team.name,
        code: team.code,
        isActive: team.isActive,
      }}
      memberIds={team.userMemberships.map((m) => m.userId)}
      agentIds={team.agentMemberships.map((m) => m.agentId)}
      allUsers={allUsers}
      allAgents={allAgents}
    />
  );
}
