import Link from "next/link";
import type { DashboardTopSite } from "@/lib/dashboard-aggregator";

/**
 * Top 5 sites prioritaires (C13).
 *
 * Score composite : `openNCs × 2 + openActions`. Permet de cibler les
 * sites où concentrer l'effort de visite.
 */
export function DashboardTopSites({ sites }: { sites: DashboardTopSite[] }) {
  return (
    <section className="px-4 lg:px-8 mt-8">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Sites prioritaires
      </h2>
      {sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">
            Aucun site avec NC ou action en cours.
          </p>
        </div>
      ) : (
        <ol className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
          {sites.map((s, i) => (
            <li
              key={s.siteId}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
            >
              <span className="w-6 text-xs font-mono font-semibold text-slate-400 text-right">
                {i + 1}.
              </span>
              <Link
                href={`/sites/${s.siteId}`}
                className="flex-1 min-w-0 text-sm font-medium text-slate-800 hover:text-indigo-700 truncate"
              >
                {s.siteName}
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {s.openNCs > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-rose-700"
                    title="Non-conformités non redressées"
                  >
                    {s.openNCs} NC
                  </span>
                )}
                {s.openActions > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-amber-700"
                    title="Actions en cours"
                  >
                    {s.openActions} act.
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
