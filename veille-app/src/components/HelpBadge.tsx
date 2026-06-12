"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pastille "?" cliquable affichée à droite d'un libellé de checklist.
 * Au clic (ou tap mobile) → ouvre un petit popover avec la référence
 * réglementaire et un texte d'explication courte.
 *
 *   - N'affiche rien si `reference` ET `text` sont vides → pas de
 *     régression visuelle sur les items historiques sans aide.
 *   - Le popover se ferme au clic dehors ou via Escape.
 *   - Source en pied : "Modes opératoires des agents-circulation —
 *     Tome 1 (13-09-2022)".
 */
export default function HelpBadge({
  reference,
  text,
}: {
  reference: string | null;
  text: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!reference && !text) return null;

  return (
    <span ref={ref} className="relative inline-block align-middle ml-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Aide réglementaire"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none transition-colors ${
          open
            ? "bg-indigo-600 text-white"
            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          role="dialog"
          // Ancré à droite pour éviter le débordement quand la pastille
          // est proche du bord droit d'une carte (cas fréquent en liste).
          className="absolute z-40 top-full right-0 mt-1.5 w-72 max-w-[88vw] bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-left text-xs leading-snug text-slate-700 normal-case"
        >
          {reference && (
            <span className="block font-mono text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mb-2 w-fit">
              {reference}
            </span>
          )}
          {text && <span className="block whitespace-pre-line">{text}</span>}
          <span className="block mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            Modes opératoires des agents-circulation — Tome 1 (13-09-2022)
          </span>
        </span>
      )}
    </span>
  );
}
