"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type Team = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  users: number;
  agents: number;
  sites: number;
};

type Kpis = {
  teams: number;
  users: number;
  agents: number;
  sites: number;
};

/**
 * Sprint 8 C1 — Vue globale des équipes en cartes + KPI.
 *
 * Refonte de la vue tabulaire précédente :
 *  - Bandeau KPI (4 tuiles : équipes / users / agents / sites).
 *  - Grille de cartes (1 col mobile, 2 col tablette, 3 col desktop).
 *  - Filtre rapide actives/inactives + recherche locale par nom/code.
 *  - Actions de gestion conservées (créer, désactiver, supprimer).
 *
 * Compteurs sont les liens M2M (UserTeam/AgentTeam/SiteTeam) — voir
 * commentaire dans `page.tsx`.
 */
export default function TeamsClient({
  initial,
  kpis,
}: {
  initial: Team[];
  kpis: Kpis;
}) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [teams, setTeams] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (!showInactive && !t.isActive) return false;
      if (!q) return true;
      return `${t.name} ${t.code ?? ""}`.toLowerCase().includes(q);
    });
  }, [teams, query, showInactive]);

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
          {
            id: t.id,
            name: t.name,
            code: t.code,
            isActive: t.isActive ?? true,
            users: 0,
            agents: 0,
            sites: 0,
          },
        ]);
        setForm({ name: "", code: "" });
        setCreating(false);
        toast.success("Équipe créée");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Création refusée");
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
        arr.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x)),
      );
      toast.success(t.isActive ? "Équipe désactivée" : "Équipe réactivée");
    }
  }

  async function hardDelete(t: Team) {
    const ok = await ask({
      title: `Supprimer définitivement l'équipe « ${t.name} » ?`,
      description:
        "Refusé par le serveur si l'équipe a encore des utilisateurs, agents, sites, sessions ou visites.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/teams/${t.id}?mode=hard`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTeams((arr) => arr.filter((x) => x.id !== t.id));
      toast.success("Équipe supprimée");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Suppression refusée");
    }
  }

  return (
    <div>
      {dialog}

      {/* ─── En-tête ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Équipes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cloisonnement des données. Cartes triées par nom.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/teams/health"
            className="text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700 inline-flex items-center gap-1.5"
            title="Diagnostic structure : utilisateurs / agents / sites sans équipe, équipes vides"
          >
            <Icon.AlertTriangle className="w-4 h-4" /> Diagnostic
          </Link>
          <button
            onClick={() => setCreating((v) => !v)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
          >
            <Icon.Plus className="w-4 h-4" />
            {creating ? "Annuler" : "Nouvelle équipe"}
          </button>
        </div>
      </div>

      {/* ─── KPI ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiTile label="Équipes" value={kpis.teams} icon={<Icon.Users />} />
        <KpiTile
          label="Utilisateurs rattachés"
          value={kpis.users}
          icon={<Icon.User />}
        />
        <KpiTile label="Agents rattachés" value={kpis.agents} icon={<Icon.User />} />
        <KpiTile label="Sites rattachés" value={kpis.sites} icon={<Icon.Building />} />
      </div>

      {/* ─── Formulaire création ─────────────────────────────────────── */}
      {creating && (
        <form
          onSubmit={create}
          className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <input
            placeholder="Nom de l'équipe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input md:col-span-2"
            autoFocus
          />
          <input
            placeholder="Code (optionnel)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="input"
          />
          <button
            type="submit"
            disabled={busy || !form.name.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg md:col-span-3"
          >
            {busy ? "Création…" : "Créer"}
          </button>
        </form>
      )}

      {/* ─── Filtres ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, code)…"
            className="input pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher les équipes inactives
        </label>
      </div>

      {/* ─── Grille de cartes ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-12 text-center text-sm text-slate-500">
          {teams.length === 0
            ? "Aucune équipe — créez la première via « Nouvelle équipe »."
            : "Aucune équipe ne correspond aux filtres."}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onToggleActive={() => toggleActive(t)}
              onDelete={() => hardDelete(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 min-w-0">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 grid place-items-center [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 truncate">
          {label}
        </div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function TeamCard({
  team,
  onToggleActive,
  onDelete,
}: {
  team: Team;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 flex flex-col gap-3 min-w-0 transition-shadow hover:shadow-sm ${
        team.isActive ? "border-slate-200" : "border-slate-200 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="text-base font-bold truncate">{team.name}</div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            {team.code ?? "—"}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            team.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              team.isActive ? "bg-emerald-500" : "bg-slate-400"
            }`}
          />
          {team.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Users" value={team.users} />
        <Stat label="Agents" value={team.agents} />
        <Stat label="Sites" value={team.sites} />
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <Link
          href={`/admin/teams/${team.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Voir
          <Icon.ChevronRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={onToggleActive}
          className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1.5 rounded hover:bg-indigo-50"
          title={team.isActive ? "Désactiver" : "Réactiver"}
        >
          {team.isActive ? "Désactiver" : "Activer"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-rose-500 hover:text-rose-700 p-2 rounded hover:bg-rose-50"
          title="Supprimer définitivement (refusé si données rattachées)"
        >
          <Icon.Trash className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-center min-w-0">
      <div className="text-base font-bold tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
