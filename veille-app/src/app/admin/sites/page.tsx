import { prisma } from "@/lib/prisma";
import SitesAdminClient from "./SitesAdminClient";

export const dynamic = "force-dynamic";

export default async function SitesAdminPage() {
  const [sites, teams] = await Promise.all([
    prisma.site.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: { include: { team: true } },
        _count: {
          select: {
            visits: true,
            importedActions: { where: { localStatus: "ACTIVE" } },
          },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <SitesAdminClient
      initial={sites.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
        address: s.address,
        isActive: s.isActive,
        isVisible: s.isVisible,
        hasGreasingArea: s.hasGreasingArea,
        teamIds: s.memberships.map((m) => m.teamId),
        teamNames: s.memberships.map((m) => m.team.name),
        visitsCount: s._count.visits,
        actionsCount: s._count.importedActions,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
