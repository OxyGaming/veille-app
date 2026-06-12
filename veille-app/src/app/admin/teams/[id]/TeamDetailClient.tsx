"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

type User = { id: string; name: string; email: string; role: string };
type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  isVisible: boolean;
};
type Team = { id: string; name: string; code: string | null; isActive: boolean };

export default function TeamDetailClient({
  team,
  memberIds,
  agentIds,
  allUsers,
  allAgents,
}: {
  team: Team;
  memberIds: string[];
  agentIds: string[];
  allUsers: User[];
  allAgents: Agent[];
}) {
  const [tab, setTab] = useState<"users" | "agents">("users");
  const [users, setUsers] = useState<Set<string>>(new Set(memberIds));
  const [agents, setAgents] = useState<Set<string>>(new Set(agentIds));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Édition des infos d'équipe (nom, code) — boutons distincts pour éviter
  // les patchs accidentels pendant la frappe.
  const [editName, setEditName] = useState(team.name);
  const [editCode, setEditCode] = useState(team.code ?? "");
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  async function saveTeamInfo() {
    setEditBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Impossible de modifier l'équipe.");
        return;
      }
      setEditing(false);
      setSaved("Équipe renommée.");
    } finally {
      setEditBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: [...users],
          agentIds: [...agents],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Erreur");
        return;
      }
      setSaved(`${users.size} utilisateur(s) · ${agents.size} agent(s) enregistré(s).`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/admin/teams"
            className="text-xs text-indigo-600 inline-flex items-center gap-1"
          >
            <Icon.ChevronLeft className="w-3 h-3" /> Équipes
          </Link>
          {editing ? (
            <div className="mt-2 flex flex-col md:flex-row gap-2 md:items-center">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input md:flex-1 md:max-w-md text-lg font-bold"
                autoFocus
                placeholder="Nom de l'équipe"
              />
              <input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="input md:max-w-[160px] font-mono text-xs"
                placeholder="Code (optionnel)"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveTeamInfo}
                  disabled={!editName.trim() || editBusy}
                  className="btn btn-primary"
                >
                  {editBusy ? "…" : "Enregistrer"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(team.name);
                    setEditCode(team.code ?? "");
                  }}
                  className="text-sm text-slate-600 px-3 py-2 rounded hover:bg-slate-100"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{editName}</h1>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                title="Modifier le nom et le code"
              >
                <Icon.FileEdit className="w-3 h-3" /> Renommer
              </button>
            </div>
          )}
          {!editing && (
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {editCode || "—"} ·{" "}
              <span
                className={team.isActive ? "text-emerald-700" : "text-slate-500"}
              >
                {team.isActive ? "Active" : "Inactive"}
              </span>
            </p>
          )}
        </div>
        <button onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? "Enregistrement…" : "Enregistrer la composition"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon.Check className="w-4 h-4" /> {saved}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-3">
        <Tab
          active={tab === "users"}
          onClick={() => setTab("users")}
          label="Utilisateurs"
          count={users.size}
        />
        <Tab
          active={tab === "agents"}
          onClick={() => setTab("agents")}
          label="Agents"
          count={agents.size}
        />
      </div>

      {tab === "users" ? (
        <CheckList
          items={allUsers.map((u) => ({
            id: u.id,
            primary: u.name,
            secondary: `${u.email} · ${u.role}`,
          }))}
          selected={users}
          onChange={setUsers}
        />
      ) : (
        <CheckList
          items={allAgents.map((a) => ({
            id: a.id,
            primary: `${a.lastName} ${a.firstName}`,
            secondary: `${a.matricule}${a.isVisible ? "" : " · masqué"}`,
            muted: !a.isVisible,
          }))}
          selected={agents}
          onChange={setAgents}
        />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}{" "}
      <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded ml-1">
        {count}
      </span>
    </button>
  );
}

function CheckList({
  items,
  selected,
  onChange,
}: {
  items: {
    id: string;
    primary: string;
    secondary?: string;
    muted?: boolean;
  }[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      i.primary.toLowerCase().includes(q) ||
      (i.secondary ?? "").toLowerCase().includes(q)
    );
  });
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }
  function selectAllFiltered() {
    const next = new Set(selected);
    filtered.forEach((i) => next.add(i.id));
    onChange(next);
  }
  function deselectAllFiltered() {
    const next = new Set(selected);
    filtered.forEach((i) => next.delete(i.id));
    onChange(next);
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-slate-200 flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="input pl-9"
          />
        </div>
        <button
          type="button"
          onClick={selectAllFiltered}
          className="text-xs text-indigo-600 underline"
        >
          Tout cocher
        </button>
        <button
          type="button"
          onClick={deselectAllFiltered}
          className="text-xs text-indigo-600 underline"
        >
          Tout décocher
        </button>
      </div>
      <ul className="max-h-96 overflow-auto divide-y divide-slate-100">
        {filtered.map((i) => {
          const sel = selected.has(i.id);
          return (
            <li
              key={i.id}
              onClick={() => toggle(i.id)}
              className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer ${
                sel ? "bg-indigo-50" : "hover:bg-slate-50"
              } ${i.muted ? "text-slate-400" : ""}`}
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
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{i.primary}</div>
                {i.secondary && (
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {i.secondary}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-slate-500 text-center">
            Aucun élément.
          </li>
        )}
      </ul>
    </div>
  );
}
