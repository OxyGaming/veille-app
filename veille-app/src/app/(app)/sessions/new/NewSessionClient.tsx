"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type Proc = {
  id: string;
  domain: string;
  theme: string | null;
  title: string;
  gravity: number;
  documents: string[];
  risk: string | null;
  itemCount: number;
};

type Agent = {
  id: string;
  name: string;
  matricule: string | null;
};

const GRAVITIES = [
  { v: "all", label: "Toutes" },
  { v: "4", label: "G4", color: "var(--g4)" },
  { v: "3", label: "G3", color: "var(--g3)" },
  { v: "2", label: "G2", color: "var(--g2)" },
];

export default function NewSessionClient({
  agent,
  procedures,
}: {
  agent: Agent | null;
  procedures: Proc[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [grav, setGrav] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return procedures.filter((p) => {
      if (grav !== "all" && String(p.gravity) !== grav) return false;
      if (!t) return true;
      const hay =
        `${p.domain} ${p.theme ?? ""} ${p.title} ${p.risk ?? ""} ${p.documents.join(
          " "
        )}`.toLowerCase();
      return hay.includes(t);
    });
  }, [procedures, term, grav]);

  const byDomain = useMemo(() => {
    const m = new Map<string, Proc[]>();
    for (const p of filtered) {
      const arr = m.get(p.domain) ?? [];
      arr.push(p);
      m.set(p.domain, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDomain(dom: string) {
    const ids = filtered.filter((p) => p.domain === dom).map((p) => p.id);
    const allSel = ids.every((i) => selected.has(i));
    setSelected((s) => {
      const next = new Set(s);
      if (allSel) ids.forEach((i) => next.delete(i));
      else ids.forEach((i) => next.add(i));
      return next;
    });
  }

  async function startSession() {
    if (!selected.size) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureIds: [...selected],
          agentId: agent?.id ?? null,
        }),
      });
      if (res.ok) {
        const s = await res.json();
        router.push(`/sessions/${s.id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Impossible de créer la session.");
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="pb-32">
      {/* En-tête */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
              Nouvelle session de veille
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Sélectionnez les procédures à observer, puis lancez la session.
            </p>
          </div>
          <div className="text-[11px] font-mono text-slate-500 hidden md:flex items-center gap-3 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <span>
              <b className="text-slate-900 font-semibold">{filtered.length}</b>{" "}
              affichées
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <span>
              <b className="text-slate-900 font-semibold">{selected.size}</b>{" "}
              sélectionnées
            </span>
          </div>
        </div>

        {/* Bandeau agent */}
        {agent ? (
          <div className="mt-4 flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white">
              <Icon.User className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-700">
                Veille pour
              </div>
              <Link
                href={`/agents/${agent.id}`}
                className="text-sm font-bold text-slate-900 hover:underline truncate block"
              >
                {agent.name}
              </Link>
              {agent.matricule && (
                <div className="text-[11px] font-mono text-slate-500">
                  {agent.matricule}
                </div>
              )}
            </div>
            <Link
              href="/sessions/new"
              className="text-xs text-indigo-700 hover:text-indigo-900 underline shrink-0"
            >
              Sans agent
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Icon.User className="w-3.5 h-3.5" />
            <span>Session sans agent associé.</span>
          </div>
        )}

        {/* Recherche + filtres */}
        <div className="mt-4 flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Rechercher procédure, domaine, document…"
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {GRAVITIES.map((g) => (
              <button
                key={g.v}
                onClick={() => setGrav(g.v)}
                className={`shrink-0 text-xs font-mono px-3 py-2 rounded-lg border transition-colors ${
                  grav === g.v
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {g.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                    style={{ background: g.color }}
                  />
                )}
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 lg:px-8 mt-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {byDomain.map(([dom, procs]) => {
            const allSel = procs.every((p) => selected.has(p.id));
            return (
              <section
                key={dom}
                className="card overflow-hidden break-inside-avoid"
              >
                <header className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="font-mono text-[10px] tracking-wider uppercase text-slate-700 flex-1 truncate font-semibold">
                    {dom}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {procs.length}
                  </span>
                  <button
                    onClick={() => toggleDomain(dom)}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    {allSel ? "Retirer" : "Tout"}
                  </button>
                </header>
                <ul>
                  {procs.map((p) => {
                    const sel = selected.has(p.id);
                    return (
                      <li
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`flex gap-3 px-3.5 py-3 border-t border-slate-100 first:border-t-0 cursor-pointer transition-colors ${
                          sel ? "bg-indigo-50/60" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${
                            sel
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          {sel && (
                            <Icon.Check className="w-3 h-3" strokeWidth={3} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold leading-tight">
                            {p.title}
                          </div>
                          {p.theme && (
                            <div className="text-[11px] italic text-slate-500 mt-0.5">
                              {p.theme}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                            <GravityPill g={p.gravity} />
                            <span className="text-[10px] font-mono text-slate-400">
                              {p.itemCount} pts
                            </span>
                            {p.documents.slice(0, 3).map((d) => (
                              <span
                                key={d}
                                className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 rounded px-1.5 py-0.5"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!byDomain.length && (
            <div className="text-center py-20 text-slate-500 col-span-full">
              <div className="text-base font-semibold mb-1">Aucun résultat</div>
              Aucune procédure ne correspond à votre recherche.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-[140px] lg:bottom-20 left-1/2 -translate-x-1/2 z-30 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2 shadow-lg">
          <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Barre flottante de sélection */}
      {selected.size > 0 && (
        <div className="fixed bottom-[76px] lg:bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-2xl no-print animate-slide-up">
          <span className="text-sm">
            <b className="font-mono">{selected.size}</b> procédure
            {selected.size > 1 ? "s" : ""} sélectionnée
            {selected.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs underline text-slate-300 hover:text-white"
          >
            Désélectionner
          </button>
          <button
            onClick={startSession}
            disabled={starting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {starting ? (
              "…"
            ) : (
              <>
                {agent ? `Lancer — ${agent.name}` : "Lancer la veille"}
                <Icon.ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function GravityPill({ g }: { g: number }) {
  const label = g === 0 ? "NT" : `G${g}`;
  return <span className={`gpill g${g}`}>{label}</span>;
}
