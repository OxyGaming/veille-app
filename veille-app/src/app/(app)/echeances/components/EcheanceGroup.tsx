"use client";

import { useState } from "react";
import type { EcheanceItem, EcheanceUrgency } from "@/lib/echeances/types";
import { EcheanceRow } from "./EcheanceRow";

const PAGE_SIZE = 25;

type Props = {
  urgency: EcheanceUrgency;
  title: string;
  items: EcheanceItem[];
};

const DOT_BY_URGENCY: Record<EcheanceUrgency, string> = {
  late: "bg-red-500",
  today: "bg-orange-500",
  soon: "bg-amber-500",
  later: "bg-yellow-500",
  future: "bg-slate-400",
};

/**
 * Section d'un groupe d'urgence. Affichage initial : 25 items.
 * Bouton « Afficher 25 de plus » incrémente localement la borne — pas de
 * re-fetch, tout est déjà côté client après l'hydration SSR.
 */
export function EcheanceGroup({ urgency, title, items }: Props) {
  const [revealed, setRevealed] = useState(PAGE_SIZE);

  if (items.length === 0) return null;

  const visible = items.slice(0, revealed);
  const hasMore = items.length > revealed;
  const remaining = items.length - revealed;
  const nextStep = Math.min(PAGE_SIZE, remaining);

  return (
    <section className="px-4 lg:px-8 mt-6">
      <header className="flex items-center justify-between gap-3 mb-2">
        <h2 className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-600">
          <span
            className={`inline-block w-2 h-2 rounded-full ${DOT_BY_URGENCY[urgency]}`}
            aria-hidden
          />
          {title}
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {visible.length} / {items.length}
        </span>
      </header>
      <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {visible.map((item) => (
          <EcheanceRow key={item.id} item={item} />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setRevealed((r) => r + PAGE_SIZE)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Afficher {nextStep} de plus
          </button>
        </div>
      )}
    </section>
  );
}
