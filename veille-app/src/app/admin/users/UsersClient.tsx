"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  viewAllTeams: boolean;
  teamId: string | null;
  teamName: string | null;
};

const ROLES = ["ADMIN", "EDITOR", "USER"];

export default function UsersClient({
  initial,
  teams,
}: {
  initial: User[];
  teams: { id: string; name: string }[];
}) {
  const [users, setUsers] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "USER",
    teamId: teams[0]?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const u = await res.json();
      setUsers((a) => [
        ...a,
        {
          ...u,
          isActive: true,
          viewAllTeams: false,
          teamId: form.teamId,
          teamName: teams.find((t) => t.id === form.teamId)?.name ?? null,
        },
      ]);
      setForm({
        email: "",
        name: "",
        password: "",
        role: "USER",
        teamId: teams[0]?.id ?? "",
      });
      setCreating(false);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
    }
  }

  async function patch(u: User, patch: Partial<User>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((arr) =>
        arr.map((x) =>
          x.id === u.id
            ? {
                ...x,
                ...updated,
                teamName:
                  teams.find((t) => t.id === updated.teamId)?.name ?? null,
              }
            : x
        )
      );
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
    }
  }

  async function hardDelete(u: User) {
    setError(null);
    const ok = confirm(
      `Supprimer définitivement « ${u.name} » (${u.email}) ?\n\n` +
        `Cette action est irréversible. Elle est refusée si l'utilisateur a ` +
        `créé des sessions, observations, validations, vu ou visites — dans ` +
        `ce cas, désactivez-le plutôt.`
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${u.id}?mode=hard`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUsers((arr) => arr.filter((x) => x.id !== u.id));
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Suppression refusée");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {users.length} compte(s). Soft-delete uniquement.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
        >
          {creating ? "Annuler" : "+ Nouvel utilisateur"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={create}
          className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <Field label="Nom complet">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
            />
          </Field>
          <Field label="Mot de passe (≥6 char.)">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              required
              minLength={6}
            />
          </Field>
          <Field label="Rôle">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Équipe" full>
            <select
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              className="input"
            >
              <option value="">— Aucune —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Créer
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Nom</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Rôle</th>
              <th className="text-left px-4 py-2.5">Équipe</th>
              <th className="text-center px-4 py-2.5">Cross-équipe</th>
              <th className="text-right px-4 py-2.5">Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold">{u.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={(e) => patch(u, { role: e.target.value })}
                    className="text-xs border border-slate-200 rounded-md px-2 py-1"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.teamId ?? ""}
                    onChange={(e) =>
                      patch(u, { teamId: e.target.value || null })
                    }
                    className="text-xs border border-slate-200 rounded-md px-2 py-1"
                  >
                    <option value="">—</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={u.viewAllTeams}
                    onChange={(e) =>
                      patch(u, { viewAllTeams: e.target.checked })
                    }
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => patch(u, { isActive: !u.isActive })}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.isActive
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        u.isActive ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {u.isActive ? "Actif" : "Inactif"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => hardDelete(u)}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                    title="Supprimer définitivement (refusé si traces opérationnelles)"
                  >
                    <Icon.Trash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
