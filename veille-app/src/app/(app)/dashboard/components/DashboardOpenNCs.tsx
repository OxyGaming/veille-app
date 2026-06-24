import Link from "next/link";
import type { DashboardOpenNCs as Data } from "@/lib/dashboard-aggregator";
import { ActionValidateButton } from "@/components/ActionValidateButton";

/**
 * NC non redressées (C13 + C13.3).
 *
 * Compteurs par catégorie en haut (chips colorés), puis liste détaillée
 * des NC avec site + description + date + lien direct vers le rapport
 * de visite. Pas de bouton « Détail » — chaque NC est cliquable.
 */
export function DashboardOpenNCs({ data }: { data: Data }) {
  return (
    <section className="px-4 lg:px-8 mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Non-conformités non redressées
          {data.total > 0 && (
            <span className="ml-1.5 normal-case font-sans text-slate-400">
              ({data.total})
            </span>
          )}
        </h2>
      </div>
      {data.total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">
            Aucune non-conformité ouverte.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          {/* Compteurs par catégorie en chips colorés. */}
          <div className="flex items-center gap-2 flex-wrap">
            {data.byKind.map((k) => (
              <span
                key={k.kind}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs"
                title={`${k.count} NC ${k.label}`}
              >
                <span className="font-mono font-semibold text-rose-700">
                  {k.count}
                </span>
                <span className="text-slate-700">{k.label}</span>
              </span>
            ))}
          </div>
          {/* Liste détaillée — un item par NC. */}
          <ul className="divide-y divide-slate-100">
            {data.items.map((nc) => (
              <li key={nc.id} className="py-2.5">
                {/* C15 — Ligne 2-actions : (1) clic sur la zone texte
                    → rapport visite, (2) bouton à droite → validation
                    inline de l'action liée. */}
                <div className="flex items-start gap-2">
                  <Link
                    href={nc.visitReportUrl}
                    className="group flex-1 min-w-0 hover:bg-slate-50 -mx-2 px-2 py-1 rounded-md block"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 uppercase">
                            {nc.kindLabel}
                          </span>
                          <span className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-700">
                            {nc.siteName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                          {nc.description}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {formatDetected(nc.detectedAt)}
                      </span>
                    </div>
                  </Link>
                  {nc.actionId && (
                    <div className="shrink-0 mt-0.5">
                      <ActionValidateButton
                        actionId={nc.actionId}
                        contextLabel={`${nc.siteName} — ${nc.description}`}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
            {data.extra > 0 && (
              <li className="py-2 text-center text-[11px] text-slate-500">
                + {data.extra} non listée{data.extra > 1 ? "s" : ""}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Date ISO → "JJ/MM/AA" pour économiser la largeur. */
function formatDetected(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}
