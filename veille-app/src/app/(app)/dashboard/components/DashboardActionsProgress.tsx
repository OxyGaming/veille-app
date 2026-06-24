import Link from "next/link";
import type { DashboardActionsProgress as Data } from "@/lib/dashboard-aggregator";

/**
 * Actions en cours regroupées par titre (C13).
 *
 * Pour chaque keyPoint distinct ayant au moins 1 action ACTIVE, barre
 * de progression `done/total`. Tri : moins avancés d'abord (priorité
 * visuelle). Top 10 affiché, lien vers `/admin/actions` pour le détail.
 */
export function DashboardActionsProgress({ data }: { data: Data }) {
  return (
    <section className="px-4 lg:px-8 mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Actions en cours par titre
          {data.totalGroups > data.items.length && (
            <span className="ml-1.5 normal-case font-sans text-slate-400">
              ({data.items.length} / {data.totalGroups})
            </span>
          )}
        </h2>
        <Link
          href="/echeances"
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        >
          Hub échéances →
        </Link>
      </div>
      {data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">
            Aucune action en cours dans votre périmètre.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {data.items.map((g) => {
            const widthPct = Math.max(0, Math.min(100, g.percent));
            return (
              <li
                key={g.title}
                className="rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-800 truncate font-medium">
                    {g.title}
                  </span>
                  <span className="text-xs font-mono text-slate-600 shrink-0">
                    {g.done} / {g.total}
                    <span className="ml-1.5 text-slate-400">
                      ({g.percent}%)
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={g.percent}
                  aria-label={`${g.title} : ${g.percent}% validées`}
                >
                  <div
                    className={
                      g.percent >= 80
                        ? "h-full bg-emerald-500"
                        : g.percent >= 50
                          ? "h-full bg-amber-500"
                          : "h-full bg-rose-500"
                    }
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
