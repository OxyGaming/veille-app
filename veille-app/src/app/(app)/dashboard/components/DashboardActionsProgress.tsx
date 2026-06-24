"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import type {
  DashboardActionGroup,
  DashboardActionsProgress as Data,
} from "@/lib/dashboard-aggregator";

/**
 * C18 — Normalise une chaîne pour la recherche : minuscules + retire
 * les accents (NFD + suppression des combining diacritics). Permet à
 * "echeance" de matcher "Échéance".
 */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** C17 — Options de tri exposées côté UI. */
type SortKey = "percentDesc" | "percentAsc" | "dueAsc" | "totalDesc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "percentDesc", label: "Taux ↓ (plus avancés)" },
  { value: "percentAsc", label: "Taux ↑ (moins avancés)" },
  { value: "dueAsc", label: "Échéance proche" },
  { value: "totalDesc", label: "Plus grand chantier" },
];

function sortGroups(items: DashboardActionGroup[], key: SortKey) {
  const arr = [...items];
  switch (key) {
    case "percentDesc":
      arr.sort((a, b) => b.percent - a.percent || a.total - b.total);
      break;
    case "percentAsc":
      arr.sort((a, b) => a.percent - b.percent || b.total - a.total);
      break;
    case "dueAsc":
      arr.sort((a, b) => {
        const da = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Infinity;
        const db = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Infinity;
        return da - db || b.percent - a.percent;
      });
      break;
    case "totalDesc":
      arr.sort((a, b) => b.total - a.total || b.percent - a.percent);
      break;
  }
  return arr;
}

/** C13.2 — Date ISO → JJ/MM/AAAA. Renvoie "" si null/invalide. */
function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Actions en cours regroupées par titre (C13 + C13.1).
 *
 * Pour chaque keyPoint distinct ayant au moins 1 action ACTIVE :
 *  - barre de progression done/total tri-couleur
 *  - bouton « Voir les cibles restantes » → liste dépliable des agents
 *    (ou sites) qui n'ont pas encore validé.
 *
 * Top 10 affiché, lien vers `/admin/actions` pour le détail complet.
 */
export function DashboardActionsProgress({ data }: { data: Data }) {
  // C18 — Moteur de recherche côté client (titre, plan, agents/sites,
  // tags). Les données complètes sont déjà chargées en SSR.
  // C18.1 — Filtre tags retiré : la recherche couvre les tags via
  // g.tags inclus dans le haystack.
  const [sortKey, setSortKey] = useState<SortKey>("percentDesc");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return data.items;
    const nq = normalizeForSearch(q);
    return data.items.filter((g) => {
      const haystackParts: string[] = [
        g.title,
        g.planLabel ?? "",
        ...g.tags,
        ...g.pending.map((p) => p.label),
      ];
      return normalizeForSearch(haystackParts.join(" ")).includes(nq);
    });
  }, [data.items, search]);

  const sorted = useMemo(
    () => sortGroups(filtered, sortKey),
    [filtered, sortKey],
  );

  return (
    <section className="px-4 lg:px-8 mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Actions en cours par titre
          {sorted.length > 0 && (
            <span className="ml-1.5 normal-case font-sans text-slate-400">
              ({sorted.length}
              {search.trim() !== "" && ` / ${data.items.length}`})
            </span>
          )}
        </h2>
        <Link
          href="/echeances"
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        >
          Hub échéances →
        </Link>
      </div>

      {/* C18 — Champ de recherche en haut (titre, plan, agents, tags). */}
      {data.items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 mb-2">
          <div className="relative">
            <Icon.Search
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un titre, un plan, un agent, un tag…"
              aria-label="Rechercher dans les actions"
              className="w-full pl-7 pr-8 py-1.5 text-xs rounded-md border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
                title="Effacer"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon.X className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {/* C18.1 — Sélecteur de tri seul (filtre tags retiré, redondant
          avec le moteur de recherche). */}
      {data.items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 mb-2 flex items-center gap-3 flex-wrap">
          <label className="text-[11px] font-medium text-slate-600 inline-flex items-center gap-1.5">
            Trier
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs rounded border border-slate-300 px-1.5 py-0.5 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">
            {search.trim() !== ""
              ? "Aucune action ne correspond à votre recherche."
              : "Aucune action en cours dans votre périmètre."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {sorted.map((g) => (
            <ActionGroupRow key={g.title} group={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionGroupRow({ group: g }: { group: DashboardActionGroup }) {
  const [open, setOpen] = useState(false);
  const widthPct = Math.max(0, Math.min(100, g.percent));
  // C13.1 — Décompte sur les cibles uniques (déjà dédupliquées côté
  // aggregator). pendingExtra est ajouté pour le surplus tronqué au cap.
  const pendingCount = g.pending.length + g.pendingExtra;
  const isAgentGroup = g.pending[0]?.kind === "agent";
  const noun = isAgentGroup ? "agent" : "cible";
  const barColor =
    g.percent >= 80
      ? "bg-emerald-500"
      : g.percent >= 50
        ? "bg-amber-500"
        : "bg-rose-500";

  const dueLabel = formatDueDate(g.nextDueAt);
  return (
    <li className="rounded-lg px-2 py-2 hover:bg-slate-50">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-800 truncate font-medium">
          {g.title}
        </span>
        <span className="text-xs font-mono text-slate-600 shrink-0 flex items-center gap-2">
          {dueLabel && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
              title={`Échéance la plus proche : ${dueLabel}`}
            >
              Éch. {dueLabel}
            </span>
          )}
          <span>
            {g.done} / {g.total}
            <span className="ml-1.5 text-slate-400">({g.percent}%)</span>
          </span>
        </span>
      </div>
      {g.planLabel && (
        <p
          className="mt-0.5 text-[11px] text-slate-500 truncate"
          title={g.planLabel}
        >
          {g.planLabel}
        </p>
      )}
      <div
        className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={g.percent}
        aria-label={`${g.title} : ${g.percent}% validées`}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${widthPct}%` }} />
      </div>
      {pendingCount > 0 && (
        <>
          {/* C13.5 — Chevron aligné à droite, cohérent avec les autres
              icônes du dashboard. */}
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              aria-expanded={open}
              aria-label={
                open
                  ? "Masquer le détail"
                  : `Voir les ${pendingCount} ${noun}${pendingCount > 1 ? "s" : ""} restant${pendingCount > 1 ? "s" : ""}`
              }
              title={
                open
                  ? "Masquer le détail"
                  : `Voir les ${pendingCount} ${noun}${pendingCount > 1 ? "s" : ""} restant${pendingCount > 1 ? "s" : ""}`
              }
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white w-7 h-7 text-slate-600 hover:bg-slate-50"
            >
              <Icon.ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
          {open && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {g.pending.map((p, i) => (
                <PendingChip key={chipKey(p, i)} target={p} />
              ))}
              {g.pendingExtra > 0 && (
                <li className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  + {g.pendingExtra} non listé
                  {g.pendingExtra > 1 ? "s" : ""}
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

function chipKey(
  p: DashboardActionGroup["pending"][number],
  i: number,
): string {
  if (p.kind === "agent") return `a:${p.agentId}`;
  if (p.kind === "site") return `s:${p.siteId}`;
  return `n:${i}`;
}

function PendingChip({
  target,
}: {
  target: DashboardActionGroup["pending"][number];
}) {
  if (target.kind === "agent") {
    return (
      <li>
        <Link
          href={`/agents/${target.agentId}`}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <Icon.User className="w-3 h-3" aria-hidden />
          {target.label}
        </Link>
      </li>
    );
  }
  if (target.kind === "site") {
    return (
      <li>
        <Link
          href={`/sites/${target.siteId}`}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
        >
          <Icon.Building className="w-3 h-3" aria-hidden />
          {target.label}
        </Link>
      </li>
    );
  }
  return (
    <li className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
      {target.label}
    </li>
  );
}
