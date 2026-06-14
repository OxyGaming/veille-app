"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type Site = {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  address: string | null;
  isActive: boolean;
  isVisible: boolean;
  hasGreasingArea: boolean;
  isOccupied: boolean;
  teamIds: string[];
  teamNames: string[];
  visitsCount: number;
  actionsCount: number;
};
type Team = { id: string; name: string };

export default function SitesAdminClient({
  initial,
  teams,
}: {
  initial: Site[];
  teams: Team[];
}) {
  const { dialog, ask } = useConfirmDialog();
  const [sites, setSites] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "Poste d'aiguillage",
    address: "",
    teamIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [editTeams, setEditTeams] = useState<Site | null>(null);
  const [editing, setEditing] = useState<Site | null>(null);

  async function saveEdit(s: Site, patch: Partial<Site>) {
    setError(null);
    const res = await fetch(`/api/admin/sites/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
      return;
    }
    setSites((arr) => arr.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    setEditing(null);
  }

  async function hardDelete(s: Site) {
    setError(null);
    const ok = await ask({
      title: `Supprimer définitivement « ${s.name} » ?`,
      description:
        "Refusé par le serveur si le site a déjà des visites, actions, validations ou vu/notes.\nPour le masquer sans casser l'historique, utilisez plutôt le toggle Visibilité.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/sites/${s.id}?mode=hard`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSites((arr) => arr.filter((x) => x.id !== s.id));
      toast.success("Site supprimé");
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Suppression refusée");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const s = await res.json();
      setSites((arr) => [
        ...arr,
        {
          ...s,
          teamIds: form.teamIds,
          teamNames: teams
            .filter((t) => form.teamIds.includes(t.id))
            .map((t) => t.name),
          visitsCount: 0,
          actionsCount: 0,
          isVisible: true,
          hasGreasingArea: false,
          isOccupied: true,
        },
      ]);
      setCreating(false);
      setForm({ name: "", code: "", type: "Poste d'aiguillage", address: "", teamIds: [] });
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
    }
  }

  async function toggleVisibility(s: Site) {
    const res = await fetch(`/api/admin/sites/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !s.isVisible }),
    });
    if (res.ok) {
      setSites((arr) =>
        arr.map((x) =>
          x.id === s.id ? { ...x, isVisible: !x.isVisible } : x
        )
      );
    }
  }

  async function toggleGreasing(s: Site) {
    const res = await fetch(`/api/admin/sites/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasGreasingArea: !s.hasGreasingArea }),
    });
    if (res.ok) {
      setSites((arr) =>
        arr.map((x) =>
          x.id === s.id
            ? { ...x, hasGreasingArea: !x.hasGreasingArea }
            : x
        )
      );
    }
  }

  // Occupé/inoccupé : impacte uniquement la cadence des visites planifiées
  // (180 j si occupé, 365 j si inoccupé). Ne touche pas à la cadence
  // trimestrielle (toujours 90 j). Cf. memory/business-rules.md §Visites.
  async function toggleOccupied(s: Site) {
    const res = await fetch(`/api/admin/sites/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOccupied: !s.isOccupied }),
    });
    if (res.ok) {
      setSites((arr) =>
        arr.map((x) =>
          x.id === s.id ? { ...x, isOccupied: !x.isOccupied } : x
        )
      );
    }
  }

  async function saveTeams(siteId: string, teamIds: string[]) {
    const res = await fetch(`/api/admin/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamIds }),
    });
    if (res.ok) {
      const newNames = teamIds
        .map((id) => teams.find((t) => t.id === id)?.name ?? id)
        .filter(Boolean);
      setSites((arr) =>
        arr.map((x) =>
          x.id === siteId ? { ...x, teamIds, teamNames: newNames } : x
        )
      );
      setEditTeams(null);
      toast.success(
        `Équipes mises à jour (${newNames.length} équipe${newNames.length > 1 ? "s" : ""})`,
      );
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Mise à jour refusée");
    }
  }

  return (
    <div>
      {dialog}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Postes d&apos;aiguillage, gares, dépôts et autres lieux visités.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="btn btn-primary"
        >
          <Icon.Plus className="w-4 h-4" /> {creating ? "Annuler" : "Nouveau site"}
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
          <Field label="Nom du site" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Ex. Poste de Givors Canal"
            />
          </Field>
          <Field label="Code">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="input"
              placeholder="POS-GIVORS"
            />
          </Field>
          <Field label="Type">
            <input
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input"
              placeholder="Poste d'aiguillage, gare, dépôt…"
            />
          </Field>
          <Field label="Adresse">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Équipes" full>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => {
                const sel = form.teamIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        teamIds: sel
                          ? form.teamIds.filter((id) => id !== t.id)
                          : [...form.teamIds, t.id],
                      })
                    }
                    className={`text-xs px-2 py-1 rounded border ${
                      sel
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="md:col-span-2">
            <button type="submit" className="btn btn-primary">
              Créer
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Site</th>
              <th className="text-left px-4 py-2.5">Code</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Équipes</th>
              <th className="text-right px-4 py-2.5">Visites</th>
              <th className="text-right px-4 py-2.5">Actions</th>
              <th className="text-center px-4 py-2.5" title="Local de graissage présent sur le site">
                Graissage
              </th>
              <th
                className="text-center px-4 py-2.5"
                title="Occupé → visite planifiée tous les 180 j. Inoccupé → tous les 365 j. Cadence trimestrielle (90 j) inchangée."
              >
                Occupation
              </th>
              <th className="text-center px-4 py-2.5">Visibilité</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr
                key={s.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  !s.isVisible ? "bg-slate-50/60 text-slate-500" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-2.5 text-xs">{s.type}</td>
                <td className="px-4 py-2.5 text-xs">
                  {s.teamNames.length ? (
                    <span className="flex flex-wrap gap-1">
                      {s.teamNames.map((n) => (
                        <span
                          key={n}
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-mono text-[10px]"
                          title={`Équipe rattachée : ${n}`}
                        >
                          {n}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.5 font-mono text-[10px]"
                      title="Site sans équipe — accessible uniquement aux ADMIN. Cliquez sur « Équipes » pour rattacher."
                    >
                      Sans équipe
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {s.visitsCount}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {s.actionsCount}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <label
                    className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs"
                    title="Bascule la section « 3 - Locaux de graissage » dans les PDF de visite planifiée"
                  >
                    <input
                      type="checkbox"
                      checked={s.hasGreasingArea}
                      onChange={() => toggleGreasing(s)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <span
                      className={
                        s.hasGreasingArea
                          ? "text-indigo-700 font-mono"
                          : "text-slate-400 font-mono"
                      }
                    >
                      {s.hasGreasingArea ? "Oui" : "Non"}
                    </span>
                  </label>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => toggleVisibility(s)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.isVisible
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        s.isVisible ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {s.isVisible ? "Visible" : "Masqué"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditing(s)}
                    className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setEditTeams(s)}
                    className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                    title="Modifier les équipes rattachées à ce site"
                  >
                    Équipes ({s.teamNames.length})
                  </button>
                  <button
                    onClick={() => hardDelete(s)}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                    title="Supprimer définitivement (refusé si traces opérationnelles)"
                  >
                    <Icon.Trash className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {!sites.length && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  Aucun site.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editTeams && (
        <TeamPicker
          site={editTeams}
          teams={teams}
          onCancel={() => setEditTeams(null)}
          onSave={(ids) => saveTeams(editTeams.id, ids)}
        />
      )}
      {editing && (
        <EditSiteModal
          site={editing}
          onCancel={() => setEditing(null)}
          onSave={(patch) => saveEdit(editing, patch)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function EditSiteModal({
  site,
  onCancel,
  onSave,
}: {
  site: Site;
  onCancel: () => void;
  onSave: (patch: Partial<Site>) => void;
}) {
  const [name, setName] = useState(site.name);
  const [code, setCode] = useState(site.code ?? "");
  const [type, setType] = useState(site.type ?? "");
  const [address, setAddress] = useState(site.address ?? "");
  const valid = name.trim().length > 0;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">Modifier le site</h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nom du site" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              autoFocus
              required
            />
          </Field>
          <Field label="Code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="POS-GIVORS"
              className="input"
            />
          </Field>
          <Field label="Type">
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Poste d'aiguillage, gare, dépôt…"
              className="input"
            />
          </Field>
          <Field label="Adresse" full>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              valid &&
              onSave({
                name: name.trim(),
                code: code.trim() || null,
                type: type.trim() || null,
                address: address.trim() || null,
              })
            }
            disabled={!valid}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            Enregistrer
          </button>
        </footer>
      </div>
    </>
  );
}

function TeamPicker({
  site,
  teams,
  onCancel,
  onSave,
}: {
  site: Site;
  teams: Team[];
  onCancel: () => void;
  onSave: (ids: string[]) => void;
}) {
  const initial = new Set(site.teamIds);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const count = selected.size;
  const initialCount = initial.size;
  const willRemoveAll = count === 0;
  const dirty =
    selected.size !== initial.size ||
    [...selected].some((id) => !initial.has(id));
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-50" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Équipes affectées
          </div>
          <div className="text-sm font-bold">{site.name}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Un site peut appartenir à plusieurs équipes. Toutes les équipes
            rattachées verront le site.
          </div>
        </header>
        <div className="p-3 space-y-1 max-h-80 overflow-auto">
          {teams.map((t) => {
            const sel = selected.has(t.id);
            const wasInitial = initial.has(t.id);
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
                  onChange={() => {
                    const next = new Set(selected);
                    if (next.has(t.id)) next.delete(t.id);
                    else next.add(t.id);
                    setSelected(next);
                  }}
                />
                <span className="text-sm flex-1">{t.name}</span>
                {wasInitial && (
                  <span className="text-[10px] font-mono text-slate-500">
                    déjà rattachée
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {willRemoveAll && (
          <div
            role="alert"
            className="mx-3 mb-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800"
          >
            Au moins une équipe est requise. Le site doit rester rattaché à
            un périmètre.
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">
            {count} équipe{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}
            {dirty && (
              <span className="ml-2 text-indigo-600">
                · {count - initialCount > 0 ? "+" : ""}
                {count - initialCount}
              </span>
            )}
          </span>
          <button
            onClick={onCancel}
            className="ml-auto text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave([...selected])}
            disabled={willRemoveAll || !dirty}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
