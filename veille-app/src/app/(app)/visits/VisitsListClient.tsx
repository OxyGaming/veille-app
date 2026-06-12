"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { Icon } from "@/components/icons";

type Visit = {
  id: string;
  visitDate: string;
  status: string;
  templateName: string;
  templateSlug: string;
  siteName: string;
  siteCode: string | null;
  observerName: string;
  ncCount: number;
};

/**
 * Code couleur par type de visite — sert à la barre latérale de la carte et
 * au pill à côté du nom du modèle. Reproduit la sémantique "incendie =
 * orange/rose", "planifiée = indigo".
 */
const TEMPLATE_THEME: Record<
  string,
  { bar: string; pill: string; short: string }
> = {
  "trimestrielle-incendie": {
    bar: "bg-orange-500",
    pill: "bg-orange-50 text-orange-700 border-orange-200",
    short: "Trimestrielle",
  },
  "planifiee-eic-ra": {
    bar: "bg-indigo-500",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
    short: "Planifiée",
  },
};
const DEFAULT_THEME = {
  bar: "bg-slate-300",
  pill: "bg-slate-50 text-slate-600 border-slate-200",
  short: "Autre",
};

export default function VisitsListClient({ visits }: { visits: Visit[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      visits.filter((v) =>
        matchesQuery(
          q,
          `${v.siteName} ${v.siteCode ?? ""} ${v.templateName} ${v.observerName} ${v.status}`
        )
      ),
    [visits, q]
  );

  return (
    <>
      <div className="mb-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher (site, modèle, observateur, statut)…"
          totalCount={visits.length}
          filteredCount={filtered.length}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((v) => {
          const theme = TEMPLATE_THEME[v.templateSlug] ?? DEFAULT_THEME;
          return (
            <li key={v.id}>
              <Link
                href={`/visits/${v.id}`}
                className="card flex items-stretch hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden"
              >
                <span
                  className={`w-1.5 shrink-0 ${theme.bar}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                        v.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : v.status === "active"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {v.status.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${theme.pill}`}
                      title={v.templateName}
                    >
                      {theme.short}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {format(new Date(v.visitDate), "P", { locale: fr })}
                    </span>
                    {v.ncCount > 0 && (
                      <span className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        {v.ncCount} NC
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold mt-1.5">{v.siteName}</div>
                  {v.siteCode && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {v.siteCode}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">
                    {v.templateName}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Observateur : {v.observerName}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="col-span-full text-center py-16 text-slate-500">
            <Icon.ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {visits.length === 0
              ? "Aucune visite — cliquez « Nouvelle visite »."
              : "Aucune visite ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
