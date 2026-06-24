import Link from "next/link";
import type { DashboardOpenNCs as Data } from "@/lib/dashboard-aggregator";

/**
 * NC non redressées par type de visite (C13).
 *
 * Barres horizontales proportionnelles au total. Lien vers `/history`
 * filtré au clic du compteur.
 */
export function DashboardOpenNCs({ data }: { data: Data }) {
  const max = Math.max(1, ...data.byKind.map((k) => k.count));
  return (
    <section className="px-4 lg:px-8 mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Non-conformités non redressées
        </h2>
        <Link
          href="/history?type=visit"
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        >
          Détail →
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-rose-700">{data.total}</span>
          <span className="text-xs text-slate-500">
            NC ouvertes au total
          </span>
        </div>
        {data.byKind.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune non-conformité ouverte.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {data.byKind.map((k) => {
              const widthPct = Math.round((k.count / max) * 100);
              return (
                <li key={k.kind}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {k.label}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {k.count}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={k.count}
                    aria-label={`${k.label} : ${k.count} non-conformités`}
                  >
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.max(2, widthPct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
