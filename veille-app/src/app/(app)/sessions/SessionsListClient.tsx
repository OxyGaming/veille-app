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
  const [list, setList] = useState(sessions);
  const filtered = useMemo(
    () =>
      list.filter((s) =>
        matchesQuery(
          q,
          `${s.agentName ?? ""} ${s.agentMatricule ?? ""} ${s.observerName} ${s.status} ${s.procedureTitles.join(" ")}`
        )
      ),
    [list, q]
  );

  async function archive(s: Session) {
    if (!confirm(`Archiver la session de ${s.agentName ?? "sans agent"} ?\n\nElle ne sera plus affichée ici mais reste consultable.`)) return;
    const res = await fetch(`/api/sessions/${s.id}?mode=soft`, { method: "DELETE" });
    if (res.ok) setList((arr) => arr.filter((x) => x.id !== s.id));
    else alert("Erreur");
  }
  async function hardDelete(s: Session) {
    if (!confirm(`Supprimer DÉFINITIVEMENT la session de ${s.agentName ?? "sans agent"} ?\n\nRefusé si la session est clôturée ou contient des observations.`)) return;
    const res = await fetch(`/api/sessions/${s.id}?mode=hard`, { method: "DELETE" });
    if (res.ok) setList((arr) => arr.filter((x) => x.id !== s.id));
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Suppression refusée");
    }
  }

  return (
    <>
      <div className="mb-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher (agent, observateur, procédure, statut)…"
          totalCount={list.length}
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
              <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-3">
                <span className="flex-1 truncate">Observateur : {s.observerName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    archive(s);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-1.5 py-0.5 rounded"
                  title="Archiver"
                >
                  Archiver
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hardDelete(s);
                  }}
                  className="text-rose-400 hover:text-rose-700 hover:bg-rose-50 p-0.5 rounded"
                  title="Supprimer (refusé si clôturée ou avec observations)"
                >
                  <Icon.Trash className="w-3.5 h-3.5" />
                </button>
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
