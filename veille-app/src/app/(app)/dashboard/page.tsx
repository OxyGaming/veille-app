/**
 * Dashboard Pilotage (Sprint 5 C7).
 *
 * Server Component, accessible EDITOR + ADMIN (D5). Filtres dans
 * l'URL (cohérent Hub Échéances / Audit) :
 *  - period : 30 (défaut) | 90
 *  - teamId : ADMIN uniquement
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  aggregateDashboard,
  type DashboardPeriod,
} from "@/lib/dashboard-aggregator";
import { DashboardFiltersBar } from "./components/DashboardFiltersBar";
import { DashboardKpiGrid } from "./components/DashboardKpiGrid";
import { DashboardTrends } from "./components/DashboardTrends";
import { DashboardOpenNCs } from "./components/DashboardOpenNCs";
import { DashboardActionsProgress } from "./components/DashboardActionsProgress";
import { DashboardTopSites } from "./components/DashboardTopSites";

export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };

function parsePeriod(raw: string | string[] | undefined): DashboardPeriod {
  if (raw === "90" || (Array.isArray(raw) && raw[0] === "90")) return 90;
  return 30;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "USER") redirect("/today");

  const raw = await searchParams;
  const period = parsePeriod(raw.period);
  // Sprint 6 C6 : le filtre teamId local a été retiré. Le scope ADMIN
  // est désormais résolu via le badge header (resolveAdminScope).

  const payload = await aggregateDashboard(user, new Date(), {
    period,
  });

  // Sprint 6 C6 : sous-titre dynamique selon le mode ADMIN actuel.
  const subtitle =
    user.role === "ADMIN"
      ? user.adminScopeMode === "MY_TEAMS"
        ? "Périmètre de mes équipes (sélecteur header)."
        : user.adminScopeMode === "TEAM"
          ? "Équipe sélectionnée via le sélecteur header."
          : "Vue globale toutes équipes."
      : "Périmètre de mes équipes.";

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Pilotage
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </header>
      <DashboardFiltersBar period={payload.filters.period} />
      <DashboardKpiGrid kpis={payload.kpis} />
      <DashboardOpenNCs data={payload.openNonConformities} />
      <DashboardActionsProgress data={payload.actionsProgress} />
      <DashboardTopSites sites={payload.topSites} />
      <DashboardTrends trends={payload.trends} period={payload.filters.period} />
    </div>
  );
}
