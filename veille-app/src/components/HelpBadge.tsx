"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Pastille "i" cliquable (info) affichée à droite d'un libellé de
 * checklist. Au clic (ou tap mobile) → ouvre un petit popover avec
 * la référence réglementaire et un texte d'explication courte.
 *
 *   - N'affiche rien si `reference` ET `text` sont vides → pas de
 *     régression visuelle sur les items historiques sans aide.
 *   - Le popover est rendu dans un Portal vers `document.body` :
 *     il échappe ainsi à tout parent en `overflow: hidden` et reste
 *     entièrement visible quel que soit le conteneur.
 *   - Fermeture : backdrop transparent fullscreen (clic ailleurs) ou
 *     touche Escape.
 *   - Source en pied : déduite du préfixe de `reference` via
 *     `sourceForReference()` (voir mapping ci-dessous). Fallback :
 *     "Référentiel SNCF Réseau" pour les documents non répertoriés.
 *
 * Le symbole "i" (italique) est utilisé plutôt que "?" pour éviter la
 * confusion avec l'indicateur de statut "Non observé" de la session,
 * qui utilise déjà "?" pour signaler un item pas encore noté.
 */

/**
 * Mapping préfixe document → libellé court du référentiel source.
 * Doit rester aligné avec les `helpReference` saisis dans les scripts
 * de patch (préfixe = identifiant du document avant le " §" ou " Fiche").
 */
const SOURCE_BY_PREFIX: Record<string, string> = {
  DC03969:
    "Modes opératoires des agents-circulation — Tome 1 (13-09-2022)",
  DC07202: "Communications de sécurité — DC07202 v2 (07-10-2025)",
  DC01506:
    "Gare temporaire DV BA — Reprise/cessation — DC01506 v2 (30-07-2025)",
  DC01503: "Incidents de circulation — DC01503 v5 (07-10-2025)",
};

function sourceForReference(reference: string | null): string {
  if (!reference) return "Référentiel SNCF Réseau";
  const m = reference.match(/^([A-Z]{2,}\d+)/);
  const key = m?.[1];
  return (key && SOURCE_BY_PREFIX[key]) || "Référentiel SNCF Réseau";
}
export default function HelpBadge({
  reference,
  text,
}: {
  reference: string | null;
  text: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Calcule la position absolue du popover sous la pastille, en clampant
  // dans le viewport pour éviter qu'il sorte de l'écran.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const PAD = 8;
    const W = 288; // = w-72
    const rect = btnRef.current.getBoundingClientRect();
    let left = rect.right - W; // ancré à droite par défaut
    if (left < PAD) left = PAD; // clamp gauche
    if (left + W > window.innerWidth - PAD)
      left = window.innerWidth - W - PAD; // clamp droite
    const top = rect.bottom + 6;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!reference && !text) return null;

  const title = reference
    ? `${reference}${text ? " — " + text.replace(/\s+/g, " ").slice(0, 120) : ""}`
    : text ?? "";

  const popover =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="fixed inset-0 z-[60]"
            />
            <div
              ref={popRef}
              role="dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ top: pos.top, left: pos.left, width: 288 }}
              className="fixed z-[61] max-w-[calc(100vw-16px)] bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-left text-xs leading-snug text-slate-700 normal-case"
            >
              {reference && (
                <span className="block font-mono text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mb-2 w-fit">
                  {reference}
                </span>
              )}
              {text && (
                <span className="block whitespace-pre-line">{text}</span>
              )}
              <span className="block mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                {sourceForReference(reference)}
              </span>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Aide réglementaire"
        aria-expanded={open}
        title={title}
        className={`inline-flex items-center justify-center w-5 h-5 align-middle ml-1.5 rounded-full text-[12px] italic font-serif font-bold leading-none transition-colors cursor-pointer ${
          open
            ? "bg-indigo-600 text-white"
            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
        }`}
      >
        i
      </button>
      {popover}
    </>
  );
}
