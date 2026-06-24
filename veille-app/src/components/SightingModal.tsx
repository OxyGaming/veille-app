"use client";

/**
 * Modal « Marquer comme Vu » sur un agent ou un site (C11.2).
 *
 * Extraite de `(app)/agents/[id]/AgentActionsClient.tsx` pour être
 * réutilisable depuis n'importe quelle surface (fiche agent, carte
 * Aujourd'hui, etc.) — référence pour le comportement attendu :
 * commentaire libre OPTIONNEL, validation explicite, toast côté
 * caller via `onCreated`.
 *
 * Workflow :
 *   POST /api/{agents|sites}/[id]/sight  body { kind: "SIGHT", comment }
 *   → recordActivity AGENT_SIGHTED → cascade Push C9/C10
 */

import { useState } from "react";
import { Icon } from "@/components/icons";

type Target = "agent" | "site";

type Props = {
  /** ID de l'entité (agent ou site). */
  targetId: string;
  /** Nom affiché en en-tête de modal. */
  targetName: string;
  /** Type d'entité. Défaut "agent" pour compat /agents/[id]. */
  targetKind?: Target;
  onClose: () => void;
  onCreated: () => void;
};

export default function SightingModal({
  targetId,
  targetName,
  targetKind = "agent",
  onClose,
  onCreated,
}: Props) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const url =
        targetKind === "site"
          ? `/api/sites/${targetId}/sight`
          : `/api/agents/${targetId}/sight`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "SIGHT",
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || "Erreur");
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Icon.Check className="w-4 h-4 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Marquer comme « Vu »
            </div>
            <div className="text-sm font-semibold truncate">{targetName}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Trace de prise en compte minimaliste (croisement, échange rapide…)
            quand aucune session de veille n&apos;est nécessaire. L&apos;entrée
            apparaîtra dans l&apos;historique.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Commentaire (optionnel)
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Contexte de la prise en compte…"
              maxLength={300}
              className="mt-1 input min-h-[80px]"
            />
          </label>
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <Icon.Check className="w-4 h-4" />
              {busy ? "Enregistrement…" : "Marquer comme Vu"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
