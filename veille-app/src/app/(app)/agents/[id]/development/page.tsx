import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agentScope, getSessionUser } from "@/lib/auth";
import { aggregateAgentDevelopment } from "@/lib/agent-development-aggregator";
import DevelopmentClient from "./DevelopmentClient";

export const dynamic = "force-dynamic";

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Fiche de développement individuel — support de dialogue managérial.
 * Accès réservé ADMIN/EDITOR (les USER n'ont pas accès à la vue agrégée).
 * Période : 12 mois glissants par défaut, override via ?from=… &to=…
 */
export default async function AgentDevelopmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    // USER : pas d'accès à la fiche de développement.
    redirect(`/agents/${id}`);
  }
  // Vérif scope équipe : on charge l'agent avec agentScope.
  const agent = await prisma.agent.findFirst({
    where: { id, ...agentScope(u) },
    select: { id: true },
  });
  if (!agent) notFound();

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setFullYear(now.getFullYear() - 1);
  const from = parseDate(sp.from) ?? defaultFrom;
  const to = parseDate(sp.to) ?? now;

  const summary = await aggregateAgentDevelopment(id, from, to);
  if (!summary) notFound();

  return (
    <DevelopmentClient
      summary={JSON.parse(JSON.stringify(summary))}
      defaultFrom={from.toISOString().slice(0, 10)}
      defaultTo={to.toISOString().slice(0, 10)}
    />
  );
}
