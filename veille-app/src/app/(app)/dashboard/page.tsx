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
  const teamId =
    user.role === "ADMIN" && typeof raw.teamId === "string" && raw.teamId
      ? raw.teamId
      : null;

  const payload = await aggregateDashboard(user, new Date(), {
    period,
    teamId,
  });

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Pilotage
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === "ADMIN"
            ? "Vue globale toutes équipes."
            : "Périmètre de mes équipes."}
        </p>
      </header>
      <DashboardFiltersBar
        period={payload.filters.period}
        teamId={payload.filters.teamId ?? null}
        teamsAvailable={payload.teamsAvailable}
        showTeamFilter={user.role === "ADMIN"}
      />
      <DashboardKpiGrid kpis={payload.kpis} />
      <DashboardTrends trends={payload.trends} period={payload.filters.period} />
    </div>
  );
}
