"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { Icon } from "@/components/icons";
import { Sparkline } from "@/components/charts";

type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  actionsCount: number;
  sessionsCount: number;
  hiddenForMe: boolean;
};

/**
 * Bucket couleur pour la fraîcheur d'activité d'un agent :
 *  - ≤ 7 j  : vert
 *  - 8-20 j : orange
 *  - > 20 j ou jamais : rouge
 */
function freshness(iso: string | null | undefined): {
  cls: string;
  label: string;
  days: number | null;
} {
  if (!iso)
    return {
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      label: "jamais",
      days: null,
    };
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const rel = formatDistanceToNowStrict(d, { locale: fr, addSuffix: false });
  if (days <= 7)
    return {
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      label: `il y a ${rel}`,
      days,
    };
  if (days <= 20)
    return {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      label: `il y a ${rel}`,
      days,
    };
  return {
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    label: `il y a ${rel}`,
    days,
  };
}

export default function AgentsListClient({ agents }: { agents: Agent[] }) {
  const [q, setQ] = useState("");
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [lastAt, setLastAt] = useState<Record<string, string | null>>({});
  const [showHidden, setShowHidden] = useState(false);
  // L'état de masquage est porté côté client après toggle (mise à jour optimiste).
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(
    () => new Set(agents.filter((a) => a.hiddenForMe).map((a) => a.id))
  );
  useEffect(() => {
    fetch("/api/agents/sparklines")
      .then((r) => r.json())
      .then(
        (d: {
          agents: Record<string, number[]>;
          lastAt: Record<string, string | null>;
        }) => {
          setSparks(d.agents ?? {});
          setLastAt(d.lastAt ?? {});
        }
      )
      .catch(() => {});
  }, []);
  const visible = useMemo(
    () =>
      agents
        .filter((a) => showHidden || !hiddenSet.has(a.id))
        .filter((a) =>
          matchesQuery(q, `${a.lastName} ${a.firstName} ${a.matricule}`)
        ),
    [agents, q, hiddenSet, showHidden]
  );
  const hiddenCount = hiddenSet.size;

  async function toggleHide(agentId: string) {
    const wasHidden = hiddenSet.has(agentId);
    setHiddenSet((prev) => {
      const next = new Set(prev);
      if (wasHidden) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
    try {
      const res = await fetch(`/api/agents/${agentId}/visibility`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = (await res.json()) as { hidden: boolean };
      setHiddenSet((prev) => {
        const next = new Set(prev);
        if (j.hidden) next.add(agentId);
        else next.delete(agentId);
        return next;
      });
    } catch {
      // rollback
      setHiddenSet((prev) => {
        const next = new Set(prev);
        if (wasHidden) next.add(agentId);
        else next.delete(agentId);
        return next;
      });
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[260px]">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Rechercher un agent (nom, prénom, matricule)…"
            totalCount={agents.length - (showHidden ? 0 : hiddenCount)}
            filteredCount={visible.length}
          />
        </div>
        {hiddenCount > 0 && (
          <label className="inline-flex items-center gap-2 text-xs font-mono cursor-pointer select-none px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={() => setShowHidden((v) => !v)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-slate-700">
              Afficher mes agents masqués
            </span>
            <span className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-500">
              {hiddenCount}
            </span>
          </label>
        )}
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((a) => {
          const fr = freshness(lastAt[a.id]);
          const isHidden = hiddenSet.has(a.id);
          return (
            <li key={a.id}>
              <div
                className={`card flex items-center gap-3 px-3.5 py-3 hover:border-indigo-300 hover:shadow-md transition-all ${
                  isHidden ? "opacity-60" : ""
                }`}
              >
                <Link
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-semibold grid place-items-center shrink-0 shadow-sm">
                    {(a.firstName[0] ?? "?").toUpperCase()}
                    {(a.lastName[0] ?? "").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      {a.lastName} {a.firstName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {a.matricule}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded border ${fr.cls}`}
                      title={
                        lastAt[a.id]
                          ? `Dernière trace : ${new Date(
                              lastAt[a.id]!
                            ).toLocaleString()}`
                          : "Aucune veille / vu / commentaire enregistré"
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            fr.days === null
                              ? "#F43F5E"
                              : fr.days <= 7
                              ? "#10B981"
                              : fr.days <= 20
                              ? "#F59E0B"
                              : "#F43F5E",
                        }}
                      />
                      <span>{fr.label}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                        a.actionsCount > 5
                          ? "bg-rose-50 text-rose-700"
                          : a.actionsCount > 0
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {a.actionsCount} act.
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {a.sessionsCount} session(s)
                    </div>
                    {sparks[a.id] && sparks[a.id].some((v) => v > 0) && (
                      <div className="mt-0.5 -mr-0.5">
                        <Sparkline
                          values={sparks[a.id]}
                          width={72}
                          height={18}
                        />
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleHide(a.id);
                  }}
                  className={`shrink-0 p-1.5 rounded-md border transition-colors ${
                    isHidden
                      ? "bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300"
                      : "bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:border-slate-400"
                  }`}
                  title={
                    isHidden
                      ? "Réafficher pour moi"
                      : "Masquer pour moi (ne touche pas aux autres utilisateurs)"
                  }
                >
                  {isHidden ? (
                    <Icon.Eye className="w-4 h-4" />
                  ) : (
                    <Icon.EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="text-center py-16 text-slate-500 col-span-full">
            <Icon.Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {agents.length === 0
              ? "Aucun agent — lancez un import Excel."
              : "Aucun agent ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
