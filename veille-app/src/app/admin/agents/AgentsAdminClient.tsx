"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";

type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVisible: boolean;
  teamIds: string[];
  teamNames: string[];
  actionsCount: number;
  sessionsCount: number;
};
type Team = { id: string; name: string };

export default function AgentsAdminClient({
  initial,
  teams,
}: {
  initial: Agent[];
  teams: Team[];
}) {
  const [agents, setAgents] = useState(initial);
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (!showHidden && !a.isVisible) return false;
      if (!q) return true;
      return `${a.lastName} ${a.firstName} ${a.matricule}`
        .toLowerCase()
        .includes(q);
    });
  }, [agents, query, showHidden]);

  async function toggleVisibility(a: Agent) {
    const res = await fetch(`/api/admin/agents/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !a.isVisible }),
    });
    if (res.ok) {
      setAgents((arr) =>
        arr.map((x) =>
          x.id === a.id ? { ...x, isVisible: !x.isVisible } : x
        )
      );
    }
  }
  async function saveTeams(teamIds: string[]) {
    if (!editing) return;
    const res = await fetch(`/api/admin/agents/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamIds }),
    });
    if (res.ok) {
      const newNames = teamIds
        .map((id) => teams.find((t) => t.id === id)?.name ?? id)
        .filter(Boolean);
      setAgents((arr) =>
        arr.map((x) =>
          x.id === editing.id ? { ...x, teamIds, teamNames: newNames } : x
        )
      );
      setEditing(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {agents.length} agent(s). Gérez la visibilité et l&apos;appartenance
            aux équipes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, prénom, matricule)…"
            className="input pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Afficher les agents masqués
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Agent</th>
              <th className="text-left px-4 py-2.5">Matricule</th>
              <th className="text-left px-4 py-2.5">Équipes</th>
              <th className="text-right px-4 py-2.5">Actions</th>
              <th className="text-right px-4 py-2.5">Sessions</th>
              <th className="text-center px-4 py-2.5">Visibilité</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  !a.isVisible ? "bg-slate-50/60 text-slate-500" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-semibold">
                  {a.lastName} {a.firstName}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.matricule}</td>
                <td className="px-4 py-2.5 text-xs">
                  {a.teamNames.length ? (
                    <span className="flex flex-wrap gap-1">
                      {a.teamNames.map((n) => (
                        <span
                          key={n}
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-mono text-[10px]"
                        >
                          {n}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {a.actionsCount}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {a.sessionsCount}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => toggleVisibility(a)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.isVisible
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        a.isVisible ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {a.isVisible ? "Visible" : "Masqué"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditing(a)}
                    className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    Équipes
                  </button>
                  <button
                    onClick={async () => {
                      const ok = confirm(
                        `Supprimer définitivement « ${a.lastName} ${a.firstName} » ?\n\n` +
                          `Refusé si l'agent a déjà des sessions, vu, actions ou validations.`
                      );
                      if (!ok) return;
                      const res = await fetch(
                        `/api/admin/agents/${a.id}?mode=hard`,
                        { method: "DELETE" }
                      );
                      if (res.ok) {
                        setAgents((arr) => arr.filter((x) => x.id !== a.id));
                      } else {
                        const j = await res.json().catch(() => ({}));
                        alert(j.error || "Suppression refusée");
                      }
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                    title="Supprimer définitivement (refusé si données rattachées)"
                  >
                    <Icon.Trash className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Aucun agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TeamPicker
          agent={editing}
          teams={teams}
          onCancel={() => setEditing(null)}
          onSave={saveTeams}
        />
      )}
    </div>
  );
}

function TeamPicker({
  agent,
  teams,
  onCancel,
  onSave,
}: {
  agent: Agent;
  teams: Team[];
  onCancel: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(agent.teamIds));
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Équipes
          </div>
          <div className="text-sm font-bold">
            {agent.lastName} {agent.firstName}
          </div>
        </header>
        <div className="p-3 space-y-1 max-h-80 overflow-auto">
          {teams.map((t) => {
            const sel = selected.has(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                  sel ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={() => toggle(t.id)}
                />
                <span className="text-sm">{t.name}</span>
              </label>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave([...selected])}
            className="btn btn-primary"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
