/**
 * Centre d'audit ADMIN (Sprint 5 C6).
 *
 * Server Component, ADMIN-only via `requireRole`. Lecture seule du
 * journal d'audit. Filtres dans l'URL (cohérent avec Hub Échéances).
 */

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  aggregateAuditLogs,
  getAuditUserScopeIds,
  getAuditUsersOptions,
  getDistinctAuditActions,
  type AuditFilters,
} from "@/lib/audit-aggregator";
import { AuditFiltersBar } from "./components/AuditFiltersBar";
import { AuditTable } from "./components/AuditTable";

export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };

function parseDate(raw: string | string[] | undefined): Date | null {
  if (typeof raw !== "string" || !raw) return null;
  // YYYY-MM-DD attendu (input type=date). On considère le fuseau local Paris.
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFilters(raw: SearchParams): AuditFilters {
  return {
    from: parseDate(raw.from),
    to: parseDate(raw.to),
    userId:
      typeof raw.userId === "string" && raw.userId ? raw.userId : null,
    action:
      typeof raw.action === "string" && raw.action ? raw.action : null,
  };
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let user;
  try {
    user = await requireRole(["ADMIN"]);
  } catch {
    redirect("/today");
  }
  const raw = await searchParams;
  const filters = parseFilters(raw);
  // Sprint 6 C8 — scope ADMIN sur l'audit. GLOBAL → null (audit complet).
  const userScope = await getAuditUserScopeIds(user);
  const [payload, actions, usersOpts] = await Promise.all([
    aggregateAuditLogs({ filters, userScope }),
    getDistinctAuditActions(userScope),
    getAuditUsersOptions(userScope),
  ]);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Administration
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Audit</h1>
        <p className="mt-1 text-sm text-slate-500">
          Historique des modifications sensibles. Réservé ADMIN.
        </p>
      </header>
      <AuditFiltersBar
        actions={actions}
        users={usersOpts}
        filters={filters}
      />
      <AuditTable
        initialItems={payload.items}
        initialNextCursor={payload.nextCursor}
        filters={filters}
      />
    </div>
  );
}
