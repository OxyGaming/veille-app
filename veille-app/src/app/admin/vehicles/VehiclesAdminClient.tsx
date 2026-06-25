"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPE_LIST,
  vehicleTypeLabel,
  type VehicleType,
} from "@/lib/vehicle-types";

type Vehicle = {
  id: string;
  immatriculation: string;
  type: string;
  label: string | null;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
  roundsCount: number;
};
type Team = { id: string; name: string };

export default function VehiclesAdminClient({
  initial,
  teams,
}: {
  initial: Vehicle[];
  teams: Team[];
}) {
  const { dialog, ask } = useConfirmDialog();
  const [vehicles, setVehicles] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    immatriculation: string;
    type: VehicleType;
    label: string;
    teamId: string;
  }>({
    immatriculation: "",
    type: "VS_BASIQUE",
    label: "",
    teamId: teams[0]?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        immatriculation: form.immatriculation,
        type: form.type,
        label: form.label || null,
        teamId: form.teamId || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
      return;
    }
    const v = await res.json();
    const team = teams.find((t) => t.id === v.teamId);
    setVehicles((arr) =>
      [
        ...arr,
        {
          id: v.id,
          immatriculation: v.immatriculation,
          type: v.type,
          label: v.label,
          teamId: v.teamId,
          teamName: team?.name ?? null,
          isActive: v.isActive,
          roundsCount: 0,
        },
      ].sort((a, b) => a.immatriculation.localeCompare(b.immatriculation))
    );
    setForm({
      immatriculation: "",
      type: "VS_BASIQUE",
      label: "",
      teamId: teams[0]?.id ?? "",
    });
    setCreating(false);
    toast.success("Véhicule ajouté");
  }

  async function saveEdit(v: Vehicle, patch: Partial<Vehicle>) {
    setError(null);
    const res = await fetch(`/api/admin/vehicles/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
      return;
    }
    setVehicles((arr) =>
      arr.map((x) => (x.id === v.id ? { ...x, ...patch } : x))
    );
    setEditing(null);
    toast.success("Véhicule mis à jour");
  }

  async function toggleActive(v: Vehicle) {
    await saveEdit(v, { isActive: !v.isActive });
  }

  async function hardDelete(v: Vehicle) {
    const ok = await ask({
      title: `Supprimer définitivement ${v.immatriculation} ?`,
      description:
        "Refusé si le véhicule a des tournées rattachées. Préférez le désactiver.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/vehicles/${v.id}?mode=hard`, {
      method: "DELETE",
    });
    if (res.ok) {
      setVehicles((arr) => arr.filter((x) => x.id !== v.id));
      toast.success("Véhicule supprimé");
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Suppression refusée");
    }
  }

  return (
    <div className="space-y-6">
      {dialog}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Icon.Truck className="w-5 h-5" /> Parc véhicules
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Référentiel des véhicules de service. L'immatriculation et le type
            pré-remplissent la grille à la tournée.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <Icon.Plus className="w-4 h-4" /> Nouveau véhicule
        </button>
      </header>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={create}
          className="bg-white border border-slate-200 rounded-xl p-4 grid sm:grid-cols-2 gap-3"
        >
          <label className="text-sm">
            <span className="block text-slate-700 mb-1">
              Immatriculation <span className="text-red-600">*</span>
            </span>
            <input
              required
              value={form.immatriculation}
              onChange={(e) =>
                setForm({ ...form, immatriculation: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              placeholder="AA-123-BB"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-700 mb-1">
              Type <span className="text-red-600">*</span>
            </span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as VehicleType })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {VEHICLE_TYPE_LIST.map((t) => (
                <option key={t} value={t}>
                  {VEHICLE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-slate-700 mb-1">
              Libellé (marque, modèle, affectation…)
            </span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ex : Renault Kangoo — DPx Rive Droite"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-slate-700 mb-1">Équipe</span>
            <select
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— Aucune équipe —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              Ajouter
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Immatriculation</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="px-3 py-2 text-center">Tournées</th>
              <th className="px-3 py-2 text-center">Actif</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Aucun véhicule. Ajoutez-en un pour démarrer une tournée.
                </td>
              </tr>
            )}
            {vehicles.map((v) => (
              <tr
                key={v.id}
                className={`border-b border-slate-100 ${v.isActive ? "" : "opacity-60"}`}
              >
                <td className="px-3 py-2 font-mono font-medium">
                  {v.immatriculation}
                </td>
                <td className="px-3 py-2">
                  {editing?.id === v.id ? (
                    <select
                      defaultValue={v.type}
                      onChange={(e) =>
                        setEditing({ ...v, type: e.target.value })
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-sm bg-white"
                    >
                      {VEHICLE_TYPE_LIST.map((t) => (
                        <option key={t} value={t}>
                          {VEHICLE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
                      {vehicleTypeLabel(v.type)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {editing?.id === v.id ? (
                    <input
                      defaultValue={v.label ?? ""}
                      onChange={(e) =>
                        setEditing({ ...v, label: e.target.value || null })
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-sm w-full"
                    />
                  ) : (
                    v.label ?? <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {editing?.id === v.id ? (
                    <select
                      defaultValue={v.teamId ?? ""}
                      onChange={(e) =>
                        setEditing({ ...v, teamId: e.target.value || null })
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    v.teamName ?? <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-slate-700">
                  {v.roundsCount}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggleActive(v)}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${v.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    title={v.isActive ? "Désactiver" : "Réactiver"}
                  >
                    {v.isActive ? "✓" : "—"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right space-x-1">
                  {editing?.id === v.id ? (
                    <>
                      <button
                        onClick={() =>
                          saveEdit(v, {
                            type: editing.type,
                            label: editing.label,
                            teamId: editing.teamId,
                          })
                        }
                        className="px-2 py-1 rounded text-xs bg-slate-900 text-white"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(v)}
                        className="px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => hardDelete(v)}
                        className="px-2 py-1 rounded text-xs text-red-700 hover:bg-red-50"
                      >
                        Suppr.
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
