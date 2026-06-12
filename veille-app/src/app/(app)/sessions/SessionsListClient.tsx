"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { Icon } from "@/components/icons";

type Session = {
  id: string;
  status: string;
  startedAt: string;
  agentName: string | null;
  agentMatricule: string | null;
  observerName: string;
  procedureTitles: string[];
};

export default function SessionsListClient({
  sessions,
}: {
  sessions: Session[];
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      sessions.filter((s) =>
        matchesQuery(
          q,
          `${s.agentName ?? ""} ${s.agentMatricule ?? ""} ${s.observerName} ${s.status} ${s.procedureTitles.join(" ")}`
        )
      ),
    [sessions, q]
  );

  return (
    <>
      <div className="mb-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher (agent, observateur, procédure, statut)…"
          totalCount={sessions.length}
          filteredCount={filtered.length}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sessions/${s.id}`}
              className="card block px-4 py-3 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    s.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : s.status === "active"
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.status.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {format(new Date(s.startedAt), "Pp", { locale: fr })}
                </span>
              </div>
              <div className="text-sm font-bold mt-1.5">
                {s.agentName ?? "Sans agent"}
              </div>
              {s.agentMatricule && (
                <div className="text-[11px] font-mono text-slate-500">
                  {s.agentMatricule}
                </div>
              )}
              <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                {s.procedureTitles.join(" · ")}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5">
                Observateur : {s.observerName}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="col-span-full text-center py-16 text-slate-500">
            <Icon.FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {sessions.length === 0
              ? "Aucune session pour le moment."
              : "Aucune session ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
