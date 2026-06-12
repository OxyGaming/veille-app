"use client";

import { useState } from "react";

type Team = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  users: number;
  agents: number;
  sessions: number;
};

export default function TeamsClient({ initial }: { initial: Team[] }) {
  const [teams, setTeams] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, code: form.code || null }),
      });
      if (res.ok) {
        const t = await res.json();
        setTeams((arr) => [
          ...arr,
          { ...t, users: 0, agents: 0, sessions: 0 },
        ]);
        setForm({ name: "", code: "" });
        setCreating(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: Team) {
    const res = await fetch(`/api/admin/teams/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) {
      setTeams((arr) =>
        arr.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x))
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Équipes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cloisonnement des données entre équipes. {teams.length} équipe(s).
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
        >
          {creating ? "Annuler" : "+ Nouvelle équipe"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={create}
          className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <input
            placeholder="Nom de l'équipe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-2"
            autoFocus
          />
          <input
            placeholder="Code (optionnel)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg md:col-span-3 disabled:opacity-50"
          >
            {busy ? "Création…" : "Créer"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Nom</th>
              <th className="text-left px-4 py-2.5">Code</th>
              <th className="text-right px-4 py-2.5">Utilisateurs</th>
              <th className="text-right px-4 py-2.5">Agents</th>
              <th className="text-right px-4 py-2.5">Sessions</th>
              <th className="text-right px-4 py-2.5">Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold">
                  <a
                    href={`/admin/teams/${t.id}`}
                    className="text-indigo-700 hover:underline"
                  >
                    {t.name}
                  </a>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                  {t.code ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{t.users}</td>
                <td className="px-4 py-2.5 text-right font-mono">{t.agents}</td>
                <td className="px-4 py-2.5 text-right font-mono">{t.sessions}</td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        t.isActive ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  <a
                    href={`/admin/teams/${t.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Composition
                  </a>
                  <button
                    onClick={() => toggleActive(t)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    {t.isActive ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
