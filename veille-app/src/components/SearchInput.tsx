"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

/**
 * Champ de recherche réutilisable.
 * - Icône loupe à gauche
 * - Bouton ✕ pour effacer rapidement
 * - Raccourci clavier "/" pour focus depuis n'importe quel point de la page
 * - Compteur "X / N résultats" optionnel à droite
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  totalCount,
  filteredCount,
  enableShortcut = true,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
  enableShortcut?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!enableShortcut) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enableShortcut]);

  const showCounts =
    typeof totalCount === "number" && typeof filteredCount === "number";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <Icon.Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // Paddings explicites pour éviter que `.input` n'écrase pl-9.
          style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
          className="input"
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
            aria-label="Effacer la recherche"
          >
            <Icon.X className="w-3.5 h-3.5" />
          </button>
        )}
        {enableShortcut && !value && (
          <span className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 leading-none py-0.5">
            /
          </span>
        )}
      </div>
      {showCounts && (
        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
          {filteredCount === totalCount ? (
            <>{totalCount}</>
          ) : (
            <>
              <b className="text-slate-900">{filteredCount}</b> / {totalCount}
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** Helper de normalisation pour matcher sans accents/casse. */
export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Match si toutes les sous-chaînes (séparées par espace) sont présentes. */
export function matchesQuery(query: string, haystack: string): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const h = normalize(haystack);
  return q.split(/\s+/).every((token) => h.includes(token));
}
