"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";

type Agent = { id: string; label: string };

type Props = {
  agents: Agent[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Nombre max de résultats affichés (défaut 12). */
  maxResults?: number;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * Autocomplete agent — input texte avec filtrage live sur nom, prénom et
 * matricule. Navigation clavier (↑/↓/Entrée/Échap), sélection à la souris.
 *
 * Choix UX : pas de dropdown détaché — la liste est inline sous l'input
 * pour rester lisible sur mobile (pas de problème de positionnement).
 */
export default function AgentAutocomplete({
  agents,
  value,
  onChange,
  maxResults = 12,
  placeholder = "Rechercher un agent (nom, prénom, matricule)…",
  autoFocus,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => agents.find((a) => a.id === value) ?? null,
    [agents, value]
  );

  // Quand un agent est sélectionné, on n'affiche pas la liste : un encart
  // de confirmation prend sa place avec un bouton "Changer".
  const results = useMemo(() => {
    if (selected) return [];
    const q = query.trim().toLowerCase();
    if (!q) return agents.slice(0, maxResults);
    const tokens = q.split(/\s+/);
    return agents
      .filter((a) => {
        const hay = a.label.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, maxResults);
  }, [agents, query, selected, maxResults]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      setFocused(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) {
        onChange(results[highlight].id);
        setQuery("");
        setFocused(false);
      }
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white text-xs font-semibold grid place-items-center shrink-0">
            {initialsFromLabel(selected.label)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700">
              Agent veillé
            </div>
            <div className="text-sm font-bold truncate">{selected.label}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-xs text-emerald-700 hover:text-emerald-900 underline"
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              autoFocus={autoFocus}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={onKey}
              placeholder={placeholder}
              className="input pl-9"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {/* Liste toujours visible tant qu'aucun agent n'est sélectionné :
              évite le piège UX "l'autoFocus s'est perdu → input vide sans liste". */}
          <ul
              className="mt-1.5 max-h-72 overflow-auto bg-white border border-slate-200 rounded-lg shadow-sm divide-y divide-slate-100"
              role="listbox"
            >
              {results.length === 0 ? (
                <li className="px-3 py-3 text-xs text-slate-500">
                  Aucun agent ne correspond.
                </li>
              ) : (
                results.map((a, i) => (
                  <li
                    key={a.id}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(e) => {
                      // Empêche le blur de l'input AVANT que le click soit traité.
                      // Le onClick juste après fait la vraie sélection.
                      e.preventDefault();
                    }}
                    onClick={() => {
                      onChange(a.id);
                      setQuery("");
                      setFocused(false);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer ${
                      i === highlight
                        ? "bg-indigo-50 text-indigo-900"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold shrink-0 ${
                        i === highlight
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {initialsFromLabel(a.label)}
                    </span>
                    <span className="truncate">{a.label}</span>
                  </li>
                ))
              )}
              {!query && agents.length > maxResults && (
                <li className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50">
                  {agents.length - maxResults} agent(s) supplémentaire(s) —
                  tapez pour filtrer.
                </li>
              )}
            </ul>
        </>
      )}
    </div>
  );
}

function initialsFromLabel(label: string): string {
  // Label attendu : "NOM Prénom (matricule)". On extrait les initiales du nom et prénom.
  const noParen = label.replace(/\([^)]*\)/g, "").trim();
  const parts = noParen.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
