"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import type { AuditFilters } from "@/lib/audit-aggregator";

type Props = {
  actions: string[];
  users: { id: string; label: string }[];
  filters: AuditFilters;
};

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  // YYYY-MM-DD pour <input type="date">
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Filtres URL : période (from/to), utilisateur, action. Cohérent avec
 * EcheancesFilters (S4 C6). Bouton « Télécharger CSV » qui propage les
 * filtres actuels.
 */
export function AuditFiltersBar({ actions, users, filters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.from || filters.to || filters.userId || filters.action,
    );
  }, [filters]);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/audit?${qs}` : "/admin/audit", {
        scroll: false,
      });
    });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  }

  function reset() {
    pushParams(new URLSearchParams());
  }

  const exportHref = `/api/admin/audit/export.csv${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <section
      className="px-4 lg:px-8 mt-4"
      aria-label="Filtres"
      data-pending={pending ? "1" : undefined}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Du
            </span>
            <input
              type="date"
              defaultValue={toInputDate(filters.from)}
              onChange={(e) => setParam("from", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Au
            </span>
            <input
              type="date"
              defaultValue={toInputDate(filters.to)}
              onChange={(e) => setParam("to", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Utilisateur
            </span>
            <select
              defaultValue={filters.userId ?? ""}
              onChange={(e) => setParam("userId", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les utilisateurs</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Action
            </span>
            <select
              defaultValue={filters.action ?? ""}
              onChange={(e) => setParam("action", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1 transition-colors"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
              Réinitialiser
            </button>
          ) : (
            <span />
          )}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            download
          >
            Télécharger CSV
          </a>
        </div>
      </div>
    </section>
  );
}
