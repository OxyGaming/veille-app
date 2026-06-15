import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, getSessionUser } from "@/lib/auth";
import NewSessionClient from "./NewSessionClient";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string }>;
}) {
  const { agentId } = await searchParams;
  const u = await getSessionUser();
  if (!u) redirect("/login");

  const [procedures, agent] = await Promise.all([
    prisma.procedure.findMany({
      where: { isActive: true },
      include: {
        items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ domain: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    }),
    agentId
      ? prisma.agent.findFirst({
          where: { id: agentId, isVisible: true, ...agentScope(u) },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (agentId && !agent) notFound();

  return (
    <NewSessionClient
      agent={
        agent
          ? {
              id: agent.id,
              name:
                `${agent.lastName ?? ""} ${agent.firstName ?? ""}`.trim() ||
                "Agent",
              matricule: agent.matricule,
            }
          : null
      }
      procedures={procedures.map((p) => ({
        id: p.id,
        domain: p.domain,
        theme: p.theme,
        title: p.title,
        gravity: p.gravity,
        documents: safeParseDocs(p.documents),
        risk: p.risk,
        itemCount: p.items.length,
      }))}
    />
  );
}

function safeParseDocs(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
