/**
 * /admin/actions — page admin ADMIN-only (Sprint 7 C3).
 *
 * Liste les actions avec filtres simples + sélection multiple + batch
 * « Marquer obsolètes ». Scope ADMIN Sprint 6 hérité via `actionScope(u)`.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  aggregateAdminActions,
  parseAdminActionsStatus,
  type AdminActionsFilters,
} from "@/lib/admin-actions-aggregator";
import { AdminActionsFiltersBar } from "./components/AdminActionsFiltersBar";
import { AdminActionsTable } from "./components/AdminActionsTable";

export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };

function pickString(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" && v ? v : null;
}

function pickBool(raw: string | string[] | undefined): boolean {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "1" || v === "true";
}

function parseFilters(raw: SearchParams): AdminActionsFilters {
  return {
    status: parseAdminActionsStatus(raw.status),
    teamId: pickString(raw.teamId),
    agentId: pickString(raw.agentId),
    siteId: pickString(raw.siteId),
    late: pickBool(raw.late),
    q: pickString(raw.q),
  };
}

export default async function AdminActionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Gestion des actions ouverte à tout utilisateur authentifié ; le cloisonnement
  // par équipe est appliqué par l'agrégateur (teamScope) et les routes de mutation.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const cursor = pickString(raw.cursor);
  const payload = await aggregateAdminActions(user, filters, { cursor });

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Administration
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestion des actions importées. Sélection multiple pour retirer
          plusieurs actions du suivi (transition <code>OBSOLETE</code>).
        </p>
      </header>
      <AdminActionsFiltersBar
        filters={filters}
        teamsAvailable={payload.teamsAvailable}
        totalCount={payload.total}
        logicalCount={payload.logicalTotal}
      />
      <AdminActionsTable
        initialItems={payload.items}
        initialNextCursor={payload.nextCursor}
        filters={filters}
      />
    </div>
  );
}
