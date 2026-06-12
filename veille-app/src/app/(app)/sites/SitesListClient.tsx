"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { Icon } from "@/components/icons";

type Site = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  address: string | null;
  visitsCount: number;
  actionsCount: number;
};

export default function SitesListClient({ sites }: { sites: Site[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      sites.filter((s) =>
        matchesQuery(
          q,
          `${s.name} ${s.code ?? ""} ${s.type ?? ""} ${s.address ?? ""}`
        )
      ),
    [sites, q]
  );

  return (
    <>
      <div className="mb-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher un site (nom, code, type, adresse)…"
          totalCount={sites.length}
          filteredCount={filtered.length}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sites/${s.id}`}
              className="card block px-3.5 py-3 hover:border-indigo-300 hover:shadow-md transition-all flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 text-white grid place-items-center shrink-0 shadow-sm">
                🏛️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{s.name}</div>
                <div className="text-[11px] font-mono text-slate-500">
                  {[s.code, s.type].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                    s.actionsCount > 0
                      ? "bg-rose-50 text-rose-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {s.actionsCount} act.
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {s.visitsCount} visite(s)
                </div>
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-center py-16 text-slate-500 col-span-full">
            <Icon.Building className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {sites.length === 0
              ? "Aucun site disponible."
              : "Aucun site ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
