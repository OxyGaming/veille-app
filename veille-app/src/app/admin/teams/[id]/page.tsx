import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import TeamDetailClient from "./TeamDetailClient";

export const dynamic = "force-dynamic";

/**
 * Sprint 8 C2/C3 — détail d'une équipe avec 3 onglets (Users / Agents / Sites)
 * + gestion ajout/retrait des rattachements (C3).
 *
 * Données chargées :
 *  - L'équipe et ses 3 listes de membres effectifs (M2M).
 *  - Les listes complètes de candidats (users/agents/sites actifs) pour
 *    permettre l'ajout via picker. Filtrage côté client (volumes
 *    raisonnables en admin).
 *
 * Sécurité : ADMIN uniquement (cf. /admin/teams/page.tsx pour le
 * raisonnement). Un EDITOR est redirigé vers /admin.
 */
export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN") redirect("/admin");
  const { id } = await params;
  const [team, allUsers, allAgents, allSites] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        userMemberships: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        agentMemberships: {
          orderBy: { joinedAt: "asc" },
          include: {
            agent: {
              select: {
                id: true,
                matricule: true,
                firstName: true,
                lastName: true,
                isActive: true,
                isVisible: true,
              },
            },
          },
        },
        siteMemberships: {
          orderBy: { joinedAt: "asc" },
          include: {
            site: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
                isActive: true,
                isVisible: true,
              },
            },
          },
        },
      },
    }),
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
      },
    }),
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, type: true },
    }),
  ]);
  if (!team) notFound();

  return (
    <TeamDetailClient
      team={{
        id: team.id,
        name: team.name,
        code: team.code,
        isActive: team.isActive,
      }}
      users={team.userMemberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        isActive: m.user.isActive,
        membershipRole: m.role,
        joinedAt: m.joinedAt.toISOString(),
      }))}
      agents={team.agentMemberships.map((m) => ({
        id: m.agent.id,
        matricule: m.agent.matricule,
        firstName: m.agent.firstName,
        lastName: m.agent.lastName,
        isActive: m.agent.isActive,
        isVisible: m.agent.isVisible,
        joinedAt: m.joinedAt.toISOString(),
      }))}
      sites={team.siteMemberships.map((m) => ({
        id: m.site.id,
        name: m.site.name,
        code: m.site.code,
        type: m.site.type,
        isActive: m.site.isActive,
        isVisible: m.site.isVisible,
        joinedAt: m.joinedAt.toISOString(),
      }))}
      candidates={{
        users: allUsers,
        agents: allAgents,
        sites: allSites,
      }}
    />
  );
}
