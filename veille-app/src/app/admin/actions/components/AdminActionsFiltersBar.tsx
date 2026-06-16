"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  AdminActionsFilters,
  AdminActionStatus,
} from "@/lib/admin-actions-aggregator";

/**
 * Délai (ms) avant d'émettre la requête après la dernière frappe.
 * 250 ms : assez court pour rester réactif sans poster un fetch par caractère.
 */
const SEARCH_DEBOUNCE_MS = 250;

type Props = {
  filters: AdminActionsFilters;
  teamsAvailable: { id: string; name: string }[];
  totalCount: number;
};

const STATUS_OPTIONS: { value: AdminActionStatus; label: string }[] = [
  { value: "ACTIVE", label: "Actives" },
  { value: "OBSOLETE", label: "Obsolètes" },
  { value: "VALIDATED_LOCAL", label: "Validées" },
  { value: "REPLACED", label: "Remplacées" },
  { value: "all", label: "Tous statuts" },
];

/**
 * Filtres URL pour /admin/actions (Sprint 7 C3).
 *
 * Pattern cohérent avec AuditFiltersBar / EcheancesFilters : params
 * sérialisés dans l'URL, `router.replace` non-bloquant via `startTransition`.
 */
export function AdminActionsFiltersBar({
  filters,
  teamsAvailable,
  totalCount,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // État local de l'input — séparé de filters.q (qui ne s'actualise qu'au
  // round-trip serveur). Évite l'effet "saisie en décalé" : on tape vite,
  // on voit toujours sa frappe, et la requête part 250 ms après la dernière.
  const [searchValue, setSearchValue] = useState(filters.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.status !== "ACTIVE" ||
        filters.teamId ||
        filters.agentId ||
        filters.siteId ||
        filters.late ||
        filters.q,
    );
  }, [filters]);

  function pushParams(next: URLSearchParams) {
    next.delete("cursor");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/actions?${qs}` : "/admin/actions", {
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

  function toggleLate() {
    const next = new URLSearchParams(params.toString());
    if (filters.late) next.delete("late");
    else next.set("late", "1");
    pushParams(next);
  }

  function reset() {
    setSearchValue("");
    pushParams(new URLSearchParams());
  }

  // Re-synchro côté input si filters.q change indépendamment (reset URL,
  // navigation arrière…), pour éviter une divergence local vs URL.
  useEffect(() => {
    setSearchValue(filters.q ?? "");
  }, [filters.q]);

  function onSearchChange(v: string) {
    setSearchValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.length === 0 || v.length >= 2) setParam("q", v);
    }, SEARCH_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <section
      className="px-4 lg:px-8 mt-4"
      aria-label="Filtres actions"
      data-pending={pending ? "1" : undefined}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Statut
            </span>
            <select
              value={filters.status}
              onChange={(e) => setParam("status", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Équipe
            </span>
            <select
              value={filters.teamId ?? ""}
              onChange={(e) => setParam("teamId", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les équipes</option>
              {teamsAvailable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Recherche (titre / commentaire / ID)
            </span>
            <div className="relative mt-1">
              <input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Mot-clé…"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {pending && (
                <span
                  aria-live="polite"
                  aria-label="Recherche en cours"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin"
                />
              )}
            </div>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={toggleLate}
              aria-pressed={filters.late}
              className={`flex-1 sm:flex-none rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.late
                  ? "bg-rose-50 border-rose-300 text-rose-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filters.late ? "✓ En retard" : "En retard"}
            </button>
          </div>
        </div>
        {(filters.agentId || filters.siteId) && (
          <div className="text-[11px] text-slate-500 font-mono">
            {filters.agentId && (
              <span className="bg-slate-100 px-2 py-0.5 rounded mr-2">
                agent: {filters.agentId.slice(0, 8)}…
              </span>
            )}
            {filters.siteId && (
              <span className="bg-slate-100 px-2 py-0.5 rounded">
                site: {filters.siteId.slice(0, 8)}…
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            {totalCount.toLocaleString("fr-FR")} action
            {totalCount > 1 ? "s" : ""}
          </span>
          {hasActiveFilters && (
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
          )}
        </div>
      </div>
    </section>
  );
}
