import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { resolveAdminScope } from "@/lib/admin-scope";
import { isEcheancesEnabled, isTodayEnabled } from "@/lib/featureFlags";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Sprint 6 C4 — pour les ADMIN uniquement : on fetch la liste des
  // équipes (ID + nom) pour peupler le sélecteur de périmètre et
  // résoudre le label "Équipe X". USER / EDITOR : passthrough sans
  // overhead (le composant n'est pas rendu pour eux).
  let adminScope: ReturnType<typeof resolveAdminScope> | null = null;
  let teams: { id: string; name: string }[] = [];
  if (user.role === "ADMIN") {
    teams = await prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const teamsMap: Record<string, string> = {};
    for (const t of teams) teamsMap[t.id] = t.name;
    adminScope = resolveAdminScope(
      {
        role: user.role,
        teamIds: user.teamIds,
        adminScopeMode: user.adminScopeMode ?? null,
        adminTeamId: user.adminTeamId ?? null,
      },
      { teamsMap },
    );
  }

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      }}
      todayEnabled={isTodayEnabled()}
      echeancesEnabled={isEcheancesEnabled()}
      adminScope={adminScope}
      adminTeams={teams}
      adminHasMemberships={user.teamIds.length > 0}
    >
      {children}
    </AppShell>
  );
}
