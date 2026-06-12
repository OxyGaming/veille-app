"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";

type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  teamIds: string[];
};
type Team = { id: string; name: string };

/**
 * Sélecteur multi-agents avec :
 *  - filtres par équipe (chips) ;
 *  - recherche par nom/matricule ;
 *  - tout sélectionner / désélectionner ;
 *  - exclusion individuelle (clic sur la ligne).
 */
export default function AgentMultiPicker({
  agents,
  teams,
  value,
  onChange,
  initialMode = "all",
}: {
  agents: Agent[];
  teams: Team[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** "all" = tout coché au montage ; "none" = rien. */
  initialMode?: "all" | "none";
}) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const valueSet = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (value.length === 0 && initialMode === "all") {
      onChange(agents.map((a) => a.id));
    }
    // ne se déclenche qu'au montage initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (teamFilter && !a.teamIds.includes(teamFilter)) return false;
      if (!q) return true;
      const hay = `${a.lastName} ${a.firstName} ${a.matricule}`.toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [agents, query, teamFilter]);

  const visibleSelected = filtered.filter((a) => valueSet.has(a.id)).length;
  const allFilteredSelected =
    filtered.length > 0 && visibleSelected === filtered.length;

  function toggle(id: string) {
    const next = new Set(valueSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }
  function selectAllFiltered() {
    const next = new Set(valueSet);
    filtered.forEach((a) => next.add(a.id));
    onChange([...next]);
  }
  function deselectAllFiltered() {
    const next = new Set(valueSet);
    filtered.forEach((a) => next.delete(a.id));
    onChange([...next]);
  }

  /** Pour chaque équipe, renvoie l'état de sélection courant + ses membres. */
  function teamMembers(teamId: string) {
    return agents.filter((a) => a.teamIds.includes(teamId));
  }
  function teamState(teamId: string): "empty" | "none" | "partial" | "all" {
    const members = teamMembers(teamId);
    if (!members.length) return "empty";
    let sel = 0;
    for (const m of members) if (valueSet.has(m.id)) sel++;
    if (sel === 0) return "none";
    if (sel === members.length) return "all";
    return "partial";
  }
  function toggleTeam(teamId: string) {
    const members = teamMembers(teamId);
    const next = new Set(valueSet);
    const state = teamState(teamId);
    if (state === "all") {
      // Tout désélectionner pour cette équipe.
      for (const m of members) next.delete(m.id);
    } else {
      // Partiel ou aucun → on coche tout le monde.
      for (const m of members) next.add(m.id);
    }
    onChange([...next]);
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {teams.length > 0 && (
        <div className="px-3 py-2 bg-indigo-50/40 border-b border-slate-200">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            Sélection par équipe
          </div>
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            {teams.map((t) => {
              const members = teamMembers(t.id);
              const state = teamState(t.id);
              let sel = 0;
              for (const m of members) if (valueSet.has(m.id)) sel++;
              const disabled = state === "empty";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => !disabled && toggleTeam(t.id)}
                  disabled={disabled}
                  className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded border transition-colors ${
                    disabled
                      ? "bg-white border-slate-200 text-slate-300 cursor-not-allowed"
                      : state === "all"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                      : state === "partial"
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  title={
                    disabled
                      ? "Aucun agent dans cette équipe"
                      : state === "all"
                      ? "Tout décocher pour cette équipe"
                      : "Cocher toute l'équipe"
                  }
                >
                  <span
                    className={`w-4 h-4 rounded border-2 grid place-items-center text-white text-[10px] shrink-0 ${
                      state === "all"
                        ? "bg-indigo-600 border-indigo-600"
                        : state === "partial"
                        ? "bg-amber-500 border-amber-500"
                        : "bg-white border-slate-300"
                    }`}
                  >
                    {state === "all" && "✓"}
                    {state === "partial" && "–"}
                  </span>
                  <span className="flex-1 truncate text-left font-semibold">
                    {t.name}
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {sel}/{members.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
        <div className="relative">
          <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, prénom, matricule)…"
            className="input pl-9"
          />
        </div>
        {teams.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setTeamFilter(null)}
              className={`shrink-0 text-[11px] font-mono px-2 py-1 rounded border ${
                teamFilter === null
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              Toutes
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamFilter(t.id)}
                className={`shrink-0 text-[11px] font-mono px-2 py-1 rounded border ${
                  teamFilter === t.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">
            <b className="font-mono text-slate-900">{value.length}</b>{" "}
            sélectionné(s){" · "}
            <b className="font-mono">{filtered.length}</b> filtré(s)
          </span>
          <div className="flex gap-2">
            {allFilteredSelected ? (
              <button
                type="button"
                onClick={deselectAllFiltered}
                className="text-indigo-600 underline"
              >
                Tout décocher (filtre)
              </button>
            ) : (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-indigo-600 underline"
              >
                Tout cocher (filtre)
              </button>
            )}
          </div>
        </div>
      </div>
      <ul className="max-h-64 overflow-auto divide-y divide-slate-100">
        {filtered.map((a) => {
          const sel = valueSet.has(a.id);
          return (
            <li
              key={a.id}
              onClick={() => toggle(a.id)}
              className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer ${
                sel ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`w-4 h-4 rounded border-2 grid place-items-center text-white text-[10px] ${
                  sel
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-slate-300"
                }`}
              >
                {sel && "✓"}
              </span>
              <span className="text-sm flex-1 truncate">
                <b>
                  {a.lastName} {a.firstName}
                </b>{" "}
                <span className="font-mono text-[11px] text-slate-500">
                  {a.matricule}
                </span>
              </span>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-slate-500 text-center">
            Aucun agent ne correspond.
          </li>
        )}
      </ul>
    </div>
  );
}
