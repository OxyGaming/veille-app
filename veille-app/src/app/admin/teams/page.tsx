import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import TeamsClient from "./TeamsClient";

export const dynamic = "force-dynamic";

/**
 * Sprint 8 C1 — Vue globale des équipes.
 *
 * Compteurs basés sur les liens M2M (UserTeam/AgentTeam/SiteTeam) qui
 * sont la source de vérité du scope. Les relations legacy `*.teamId`
 * (équipe principale) ne sont pas utilisées ici car elles ne reflètent
 * pas toujours l'appartenance opérationnelle.
 *
 * Sécurité : ADMIN uniquement. Le layout /admin/layout.tsx accepte
 * ADMIN + EDITOR ; cette page resserre l'accès aux ADMIN car c'est
 * une opération sensible (cf. spec Sprint 8 : « ADMIN uniquement »).
 * Un EDITOR est redirigé vers /admin sans erreur explicite.
 */
export default async function TeamsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN") redirect("/admin");
  const [teams, kpis] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            userMemberships: true,
            agentMemberships: true,
            siteMemberships: true,
          },
        },
      },
    }),
    computeKpis(),
  ]);

  return (
    <TeamsClient
      initial={teams.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        isActive: t.isActive,
        users: t._count.userMemberships,
        agents: t._count.agentMemberships,
        sites: t._count.siteMemberships,
      }))}
      kpis={kpis}
    />
  );
}

/**
 * KPI globaux affichés en tête de la vue.
 *
 *  - `teams`  : nombre total d'équipes (toutes confondues, actives + inactives).
 *  - `users`  : nombre d'utilisateurs ayant au moins UNE appartenance M2M.
 *  - `agents` : idem pour les agents.
 *  - `sites`  : idem pour les sites.
 *
 * On compte les entités DISTINCTES, pas la somme des liens — un user
 * dans 3 équipes compte pour 1.
 */
async function computeKpis(): Promise<{
  teams: number;
  users: number;
  agents: number;
  sites: number;
}> {
  const [teams, users, agents, sites] = await Promise.all([
    prisma.team.count(),
    prisma.user.count({ where: { memberships: { some: {} } } }),
    prisma.agent.count({ where: { memberships: { some: {} } } }),
    prisma.site.count({ where: { memberships: { some: {} } } }),
  ]);
  return { teams, users, agents, sites };
}
