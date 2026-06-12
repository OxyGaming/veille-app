import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import { Icon } from "@/components/icons";
import SessionsListClient from "./SessionsListClient";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const sessions = await prisma.veilleSession.findMany({
    where: teamScope(u),
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      agent: true,
      observer: { select: { name: true } },
      procedures: { include: { procedure: { select: { title: true } } } },
    },
  });
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            Sessions de veille
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Démarrer une nouvelle depuis l&apos;onglet Veilles.
          </p>
        </div>
        <Link href="/procedures" className="btn btn-primary">
          <Icon.Plus className="w-4 h-4" /> Nouvelle session
        </Link>
      </div>
      <SessionsListClient
        sessions={sessions.map((s) => ({
          id: s.id,
          status: s.status,
          startedAt: s.startedAt.toISOString(),
          agentName: s.agent
            ? `${s.agent.firstName} ${s.agent.lastName}`
            : null,
          agentMatricule: s.agent?.matricule ?? null,
          observerName: s.observer.name,
          procedureTitles: s.procedures.map((p) => p.procedure.title),
        }))}
      />
    </div>
  );
}
