"use client";

import { useEffect, useMemo, useState } from "react";
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

const GRAVITIES = [
  { v: "all", label: "Toutes" },
  { v: "4", label: "G4", color: "var(--g4)" },
  { v: "3", label: "G3", color: "var(--g3)" },
  { v: "2", label: "G2", color: "var(--g2)" },
];

const LS_EXPANDED_KEY = "veilles:expanded-domains";

/**
 * Refonte page Veilles — V1 :
 *  - Domaines repliés par défaut (état mémorisé dans localStorage).
 *  - Ligne procédure compacte : checkbox + pastille gravité + titre + « i ».
 *  - Bouton « i » : modale détail (thème, documents, points, risque, gravité).
 *  - Filtre par domaine via `<select>` (pas de chips).
 *  - Recherche + gravité + domaine se combinent.
 *  - La recherche auto-déplie les domaines qui matchent (sans modifier
 *    l'état persisté — uniquement override transient).
 */
export default function ProceduresClient({ initial }: { initial: Proc[] }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [grav, setGrav] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoTarget, setInfoTarget] = useState<Proc | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── localStorage : restore l'état déplié ───────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_EXPANDED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setExpanded(new Set(arr.filter((x) => typeof x === "string")));
      }
    } catch {
      // localStorage indisponible ou JSON cassé — on garde le défaut (tout replié)
    }
    setHydrated(true);
  }, []);

  // Persiste à chaque changement, mais pas avant l'hydratation (évite
  // d'écraser la valeur stockée par le `new Set()` initial).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_EXPANDED_KEY, JSON.stringify([...expanded]));
    } catch {
      // pas de localStorage (private mode iOS, etc.) — silencieux
    }
  }, [expanded, hydrated]);

  const allDomains = useMemo(() => {
    const set = new Set<string>();
    for (const p of initial) set.add(p.domain);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [initial]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return initial.filter((p) => {
      if (grav !== "all" && String(p.gravity) !== grav) return false;
      if (domainFilter !== "all" && p.domain !== domainFilter) return false;
      if (!t) return true;
      const hay = `${p.domain} ${p.theme ?? ""} ${p.title} ${p.risk ?? ""} ${p.documents.join(" ")}`.toLowerCase();
      return hay.includes(t);
    });
  }, [initial, term, grav, domainFilter]);

  const byDomain = useMemo(() => {
    const m = new Map<string, Proc[]>();
    for (const p of filtered) {
      const arr = m.get(p.domain) ?? [];
      arr.push(p);
      m.set(p.domain, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [filtered]);

  // Si une recherche texte ou un filtre gravité/domaine est actif, on
  // déplie les domaines qui contiennent des résultats (sans toucher au
  // localStorage). Cas particulier : sélectionner un seul domaine via
  // le select revient à n'avoir qu'un seul groupe — on le déplie aussi.
  const isFiltering =
    term.trim() !== "" || grav !== "all" || domainFilter !== "all";
  const effectivelyExpanded = (dom: string): boolean => {
    if (isFiltering) return true;
    return expanded.has(dom);
  };

  function toggleDomainExpand(dom: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(dom)) next.delete(dom);
      else next.add(dom);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(byDomain.map(([d]) => d)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDomainSelection(dom: string) {
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
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureIds: [...selected] }),
      });
      if (res.ok) {
        const s = await res.json();
        router.push(`/sessions/${s.id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Impossible de créer la session.");
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
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Veilles</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Sélectionnez les procédures à observer, puis lancez la session.
              <span className="hidden md:inline">
                {" "}
                {initial.length} procédures, {allDomains.length} domaines.
              </span>
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

        {/* Recherche + filtres */}
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative">
            <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Rechercher procédure, domaine, document…"
              className="input pl-9"
            />
          </div>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="input text-sm"
            title="Filtrer par domaine"
          >
            <option value="all">Tous les domaines</option>
            {allDomains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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

        {/* Barre actions déplier/replier */}
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <div className="text-slate-400">
            {byDomain.length} domaine{byDomain.length > 1 ? "s" : ""}
            {isFiltering ? " · filtrés" : ""}
          </div>
          {!isFiltering && byDomain.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="text-slate-500 hover:text-indigo-600 underline"
              >
                Tout déplier
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={collapseAll}
                className="text-slate-500 hover:text-indigo-600 underline"
              >
                Tout replier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 lg:px-8 mt-3">
        <div className="grid gap-2">
          {byDomain.map(([dom, procs]) => {
            const isOpen = effectivelyExpanded(dom);
            const selCount = procs.filter((p) => selected.has(p.id)).length;
            const allSel = procs.length > 0 && selCount === procs.length;
            return (
              <section key={dom} className="card overflow-hidden">
                <header
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100/70"
                  onClick={() => !isFiltering && toggleDomainExpand(dom)}
                  title={
                    isFiltering
                      ? "Domaine déplié pendant la recherche"
                      : isOpen
                        ? "Replier ce domaine"
                        : "Déplier ce domaine"
                  }
                >
                  <span className="text-slate-400 shrink-0">
                    {isOpen ? (
                      <Icon.ChevronDown className="w-4 h-4" />
                    ) : (
                      <Icon.ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider uppercase text-slate-700 flex-1 truncate font-semibold">
                    {dom}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {procs.length}
                  </span>
                  {selCount > 0 && (
                    <span className="font-mono text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                      {selCount} sél.
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDomainSelection(dom);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    {allSel ? "Retirer" : "Tout"}
                  </button>
                </header>
                {isOpen && (
                  <ul>
                    {procs.map((p) => {
                      const sel = selected.has(p.id);
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 border-t border-slate-100 first:border-t-0 cursor-pointer transition-colors min-w-0 ${
                            sel ? "bg-indigo-50/60" : "hover:bg-slate-50"
                          }`}
                          onClick={() => toggle(p.id)}
                        >
                          <span
                            className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                              sel
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-slate-300"
                            }`}
                          >
                            {sel && <Icon.Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <GravityPill g={p.gravity} />
                          <span className="flex-1 text-sm font-medium leading-snug min-w-0 truncate">
                            {p.title}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoTarget(p);
                            }}
                            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 text-[11px] font-mono italic font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            aria-label={`Détails de ${p.title}`}
                            title="Voir le détail de cette procédure"
                          >
                            i
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          {!byDomain.length && (
            <div className="text-center py-20 text-slate-500">
              <div className="text-base font-semibold mb-1">Aucun résultat</div>
              Aucune procédure ne correspond à votre recherche.
            </div>
          )}
        </div>
      </div>

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
            {starting ? "…" : (
              <>
                Lancer la veille
                <Icon.ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {infoTarget && (
        <ProcedureInfoDialog
          proc={infoTarget}
          selected={selected.has(infoTarget.id)}
          onToggle={() => toggle(infoTarget.id)}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </div>
  );
}

function GravityPill({ g }: { g: number }) {
  const label = g === 0 ? "NT" : `G${g}`;
  return <span className={`gpill g${g} shrink-0`}>{label}</span>;
}

/**
 * Modale détail d'une procédure. Lecture seule + bouton pour
 * sélectionner/désélectionner directement (gain UX vs. fermer puis
 * cocher).
 */
function ProcedureInfoDialog({
  proc,
  selected,
  onToggle,
  onClose,
}: {
  proc: Proc;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden mx-4 max-h-[85vh] flex flex-col">
        <header className="px-4 py-3 border-b border-slate-200 flex items-start gap-2">
          <GravityPill g={proc.gravity} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 truncate">
              {proc.domain}
            </div>
            <div className="text-base font-bold leading-snug">{proc.title}</div>
            {proc.theme && (
              <div className="text-xs italic text-slate-500 mt-0.5">
                {proc.theme}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 text-slate-400 hover:text-slate-700 -mr-1 -mt-1 p-1"
          >
            <Icon.X className="w-4 h-4" />
          </button>
        </header>
        <div className="p-4 space-y-3 overflow-y-auto text-sm">
          <DetailRow label="Points">{proc.itemCount}</DetailRow>
          {proc.risk && <DetailRow label="Risque">{proc.risk}</DetailRow>}
          {proc.documents.length > 0 && (
            <DetailRow label="Documents">
              <div className="flex flex-wrap gap-1.5">
                {proc.documents.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 rounded px-1.5 py-0.5"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </DetailRow>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => {
              onToggle();
              onClose();
            }}
            className={`text-sm font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1.5 ${
              selected
                ? "bg-white border border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-700"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {selected ? "Désélectionner" : "Sélectionner"}
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}
