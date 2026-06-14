"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { DashboardPeriod } from "@/lib/dashboard-aggregator";

type Props = {
  period: DashboardPeriod;
  teamId: string | null;
  teamsAvailable: { id: string; name: string }[];
  showTeamFilter: boolean;
};

export function DashboardFiltersBar({
  period,
  teamId,
  teamsAvailable,
  showTeamFilter,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", {
        scroll: false,
      });
    });
  }

  function setPeriod(p: DashboardPeriod) {
    const next = new URLSearchParams(params.toString());
    if (p === 30) next.delete("period");
    else next.set("period", String(p));
    pushParams(next);
  }

  function setTeam(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("teamId", value);
    else next.delete("teamId");
    pushParams(next);
  }

  return (
    <section
      className="px-4 lg:px-8 mt-4"
      data-pending={pending ? "1" : undefined}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Période
          </span>
          <div className="flex gap-1.5">
            {([30, 90] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p} j
              </button>
            ))}
          </div>
        </div>
        {showTeamFilter && (
          <label className="block sm:w-72">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Équipe
            </span>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeam(e.target.value)}
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
        )}
      </div>
    </section>
  );
}
