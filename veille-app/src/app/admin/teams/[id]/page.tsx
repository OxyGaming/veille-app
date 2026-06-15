import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TeamDetailClient from "./TeamDetailClient";

export const dynamic = "force-dynamic";

/**
 * Sprint 8 C2 — détail d'une équipe avec 3 onglets (Users / Agents / Sites).
 *
 * On charge UNIQUEMENT les membres effectifs (M2M) — pas la liste
 * complète de tous les users/agents/sites du système. La gestion des
 * rattachements (ajout/retrait) viendra en C3.
 *
 * Sécurité : ADMIN-only via /admin/layout.tsx.
 */
export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      userMemberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, isActive: true },
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
  });
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
    />
  );
}
