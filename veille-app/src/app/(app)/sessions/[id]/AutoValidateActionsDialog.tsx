"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export type AutoValidateCandidate = {
  id: string;
  externalId: string;
  keyPoint: string;
  comment: string | null;
  dueAt: string | null;
  matchedBy: string;
};

type Props = {
  candidates: AutoValidateCandidate[];
  /** Texte du bouton primaire (par défaut "Valider les actions"). */
  confirmLabel?: string;
  /** Texte du bouton secondaire (par défaut "Ignorer"). */
  cancelLabel?: string;
  busy?: boolean;
  /** L'utilisateur valide → liste des IDs cochés. Si vide, équivaut à Ignorer. */
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Modale de confirmation pour la validation automatique des actions à la
 * clôture d'une veille (cf. lib/sessions/auto-validate.ts).
 *
 * Comportement :
 *  - Toutes les actions sont pré-cochées (cas le plus fréquent).
 *  - L'utilisateur peut décocher individuellement.
 *  - "Valider les actions" → callback avec les IDs encore cochés.
 *  - "Ignorer" → callback onCancel : aucune action n'est modifiée.
 *
 * Cette modale ne déclenche RIEN par elle-même : le parent reste maître
 * du flux (validation + clôture).
 */
export function AutoValidateActionsDialog({
  candidates,
  confirmLabel = "Valider les actions",
  cancelLabel = "Ignorer",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    await onConfirm([...selected]);
  }

  const allChecked = selected.size === candidates.length;
  const noneChecked = selected.size === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-validate-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100">
          <h2
            id="auto-validate-title"
            className="text-base font-bold text-slate-900"
          >
            Validation automatique des actions
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cette veille permet de clôturer automatiquement les actions
            suivantes :
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2 text-xs">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  allChecked ? new Set() : new Set(candidates.map((c) => c.id)),
                )
              }
              className="text-indigo-700 hover:text-indigo-900 font-medium"
            >
              {allChecked ? "Tout décocher" : "Tout cocher"}
            </button>
            <span className="text-slate-500 font-mono">
              {selected.size} / {candidates.length}
            </span>
          </div>

          <ul className="space-y-1">
            {candidates.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      checked
                        ? "bg-emerald-50/50 border-emerald-200"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 w-4 h-4"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {c.keyPoint}
                      </div>
                      {c.comment && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {c.comment}
                        </div>
                      )}
                      <div className="text-[10px] font-mono text-slate-400 mt-1">
                        match : « {c.matchedBy} »
                        {c.dueAt && (
                          <>
                            {" · "}échéance{" "}
                            {new Date(c.dueAt).toLocaleDateString("fr-FR")}
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm font-medium text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-md disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || noneChecked}
            className="text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Icon.Wifi className="w-4 h-4 animate-pulse" />
                Validation…
              </>
            ) : (
              <>
                <Icon.Check className="w-4 h-4" />
                {confirmLabel}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
