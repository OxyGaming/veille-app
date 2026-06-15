"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";

type Team = { id: string; name: string; code: string | null; isActive: boolean };
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  membershipRole: string;
  joinedAt: string;
};
type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVisible: boolean;
  joinedAt: string;
};
type Site = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  isActive: boolean;
  isVisible: boolean;
  joinedAt: string;
};

type Tab = "users" | "agents" | "sites";

/**
 * Sprint 8 C2 — détail d'une équipe avec 3 onglets, lecture seule.
 *
 *  - En-tête : nom + code + statut + édition nom/code (existant).
 *  - 3 onglets : Users / Agents / Sites avec compteur dans le pill.
 *  - Recherche locale par onglet.
 *  - Lecture seule : pas d'ajout/retrait (C3).
 */
export default function TeamDetailClient({
  team,
  users,
  agents,
  sites,
}: {
  team: Team;
  users: User[];
  agents: Agent[];
  sites: Site[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");

  // Édition nom + code de l'équipe.
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [editCode, setEditCode] = useState(team.code ?? "");
  const [editBusy, setEditBusy] = useState(false);

  const filteredUsers = useMemo(
    () => filterUsers(users, query),
    [users, query],
  );
  const filteredAgents = useMemo(
    () => filterAgents(agents, query),
    [agents, query],
  );
  const filteredSites = useMemo(
    () => filterSites(sites, query),
    [sites, query],
  );

  async function saveTeamInfo() {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("Équipe mise à jour");
        setEditing(false);
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Mise à jour refusée");
      }
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div>
      {/* ─── Fil d'Ariane + en-tête ───────────────────────────────────── */}
      <Link
        href="/admin/teams"
        className="text-xs text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 mb-2"
      >
        <Icon.ChevronLeft className="w-3.5 h-3.5" />
        Toutes les équipes
      </Link>

      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input max-w-[260px]"
                placeholder="Nom"
                autoFocus
              />
              <input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="input max-w-[120px] font-mono"
                placeholder="Code"
              />
              <button
                type="button"
                onClick={saveTeamInfo}
                disabled={editBusy || !editName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
              >
                {editBusy ? "…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditName(team.name);
                  setEditCode(team.code ?? "");
                }}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
              >
                Annuler
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {team.name}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-[11px] font-mono text-slate-500">
                  {team.code ?? "—"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
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
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                >
                  Modifier
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Onglets ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-3 overflow-x-auto no-scrollbar">
        <TabButton
          active={tab === "users"}
          onClick={() => {
            setTab("users");
            setQuery("");
          }}
          label="Utilisateurs"
          count={users.length}
        />
        <TabButton
          active={tab === "agents"}
          onClick={() => {
            setTab("agents");
            setQuery("");
          }}
          label="Agents"
          count={agents.length}
        />
        <TabButton
          active={tab === "sites"}
          onClick={() => {
            setTab("sites");
            setQuery("");
          }}
          label="Sites"
          count={sites.length}
        />
      </div>

      {/* ─── Barre recherche ─────────────────────────────────────────── */}
      <div className="relative mb-3 max-w-md">
        <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder(tab)}
          className="input pl-9"
        />
      </div>

      {/* ─── Contenu onglet ──────────────────────────────────────────── */}
      {tab === "users" && (
        <UsersTable items={filteredUsers} total={users.length} query={query} />
      )}
      {tab === "agents" && (
        <AgentsTable items={filteredAgents} total={agents.length} query={query} />
      )}
      {tab === "sites" && (
        <SitesTable items={filteredSites} total={sites.length} query={query} />
      )}
    </div>
  );
}

function searchPlaceholder(tab: Tab): string {
  switch (tab) {
    case "users":
      return "Rechercher (nom, email)…";
    case "agents":
      return "Rechercher (nom, prénom, matricule)…";
    case "sites":
      return "Rechercher (nom, code, type)…";
  }
}

function filterUsers(items: User[], q: string): User[] {
  const t = q.trim().toLowerCase();
  if (!t) return items;
  return items.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(t),
  );
}
function filterAgents(items: Agent[], q: string): Agent[] {
  const t = q.trim().toLowerCase();
  if (!t) return items;
  return items.filter((a) =>
    `${a.lastName} ${a.firstName} ${a.matricule}`.toLowerCase().includes(t),
  );
}
function filterSites(items: Site[], q: string): Site[] {
  const t = q.trim().toLowerCase();
  if (!t) return items;
  return items.filter((s) =>
    `${s.name} ${s.code ?? ""} ${s.type ?? ""}`.toLowerCase().includes(t),
  );
}

function TabButton({
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
      type="button"
      onClick={onClick}
      className={`shrink-0 text-sm font-semibold px-3 py-2 border-b-2 transition-colors inline-flex items-center gap-1.5 ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      <span
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
          active
            ? "bg-indigo-100 text-indigo-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyRow({
  total,
  query,
  label,
}: {
  total: number;
  query: string;
  label: string;
}) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
        {total === 0
          ? `Aucun ${label} dans cette équipe.`
          : query
            ? "Aucun résultat pour cette recherche."
            : `Aucun ${label}.`}
      </td>
    </tr>
  );
}

function UsersTable({
  items,
  total,
  query,
}: {
  items: User[];
  total: number;
  query: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Nom</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Rôle global</th>
              <th className="text-left px-4 py-2.5">Rôle équipe</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Rejoint le</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <EmptyRow total={total} query={query} label="utilisateur" />
            )}
            {items.map((u) => (
              <tr
                key={u.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  !u.isActive ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-semibold">{u.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                  {u.email}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      u.membershipRole === "MANAGER"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.membershipRole}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      u.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {u.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {format(new Date(u.joinedAt), "P", { locale: fr })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentsTable({
  items,
  total,
  query,
}: {
  items: Agent[];
  total: number;
  query: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Agent</th>
              <th className="text-left px-4 py-2.5">Matricule</th>
              <th className="text-left px-4 py-2.5">Visible</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Rejoint le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <EmptyRow total={total} query={query} label="agent" />
            )}
            {items.map((a) => (
              <tr
                key={a.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  !a.isActive ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-semibold">
                  {a.lastName} {a.firstName}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.matricule}</td>
                <td className="px-4 py-2.5">
                  {a.isVisible ? (
                    <span className="text-[10px] text-emerald-700">Oui</span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Masqué</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      a.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {a.isActive ? "Actif" : "Archivé"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {format(new Date(a.joinedAt), "P", { locale: fr })}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/agents/${a.id}`}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Fiche
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SitesTable({
  items,
  total,
  query,
}: {
  items: Site[];
  total: number;
  query: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Site</th>
              <th className="text-left px-4 py-2.5">Code</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Rejoint le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <EmptyRow total={total} query={query} label="site" />
            )}
            {items.map((s) => (
              <tr
                key={s.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  !s.isActive ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {s.code ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {s.type ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      s.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.isActive ? "Actif" : "Archivé"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {format(new Date(s.joinedAt), "P", { locale: fr })}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/sites/${s.id}`}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Fiche
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
