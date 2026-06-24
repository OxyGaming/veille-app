"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import type {
  DashboardActionGroup,
  DashboardActionsProgress as Data,
} from "@/lib/dashboard-aggregator";

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
  return (
    <section className="px-4 lg:px-8 mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Actions en cours par titre
          {data.items.length > 0 && (
            <span className="ml-1.5 normal-case font-sans text-slate-400">
              ({data.items.length})
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
      {data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
          <p className="text-sm text-slate-500">
            Aucune action en cours dans votre périmètre.
          </p>
        </div>
      ) : (
        // C13.2 — Plus de cap : on garde tous les groupes. Scroll
        // vertical si la liste dépasse ~15 lignes (la hauteur visible
        // approximative correspond à un viewport mobile confortable).
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 max-h-[640px] overflow-y-auto">
          {data.items.map((g) => (
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
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            {open ? (
              <Icon.ChevronUp className="w-3 h-3" aria-hidden />
            ) : (
              <Icon.ChevronDown className="w-3 h-3" aria-hidden />
            )}
            {open
              ? "Masquer le détail"
              : `Voir les ${pendingCount} ${noun}${pendingCount > 1 ? "s" : ""} restant${pendingCount > 1 ? "s" : ""}`}
          </button>
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
        </div>
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
