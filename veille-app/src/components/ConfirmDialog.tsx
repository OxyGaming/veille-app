"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Boîte de dialogue de confirmation responsive.
 * - Mobile (< md) : bottom-sheet qui glisse depuis le bas (drag handle visible).
 * - Desktop (≥ md) : modal centré.
 *
 * Pattern :
 *   const { dialog, ask } = useConfirmDialog();
 *   async function onArchive() {
 *     const ok = await ask({ title: '…', description: '…', tone: 'danger' });
 *     if (!ok) return;
 *     // … action
 *   }
 *   return (<>{dialog}<ul>…</ul></>);
 *
 * Remplace `window.confirm()` natif :
 *  - design uniforme cross-browser ;
 *  - tone "danger" pour actions destructives ;
 *  - description multi-ligne lisible ;
 *  - utilisable au pouce sur mobile ;
 *  - ne bloque plus le thread principal (promise au lieu de blocking).
 *
 * Cf. AUDIT.md §m25 / BACKLOG-V2.md US-1.11.
 */

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type Pending = {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handle = useCallback(
    (ok: boolean) => {
      if (!pending) return;
      pending.resolve(ok);
      setPending(null);
    },
    [pending]
  );

  const dialog = pending ? (
    <ConfirmDialog
      options={pending.options}
      onConfirm={() => handle(true)}
      onCancel={() => handle(false)}
    />
  ) : null;

  return { dialog, ask };
}

function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const tone = options.tone ?? "default";

  // Esc → annulation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Focus le bouton de confirmation à l'ouverture.
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 animate-in flex md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="
          mt-auto md:mt-0
          w-full md:max-w-md
          bg-white
          rounded-t-2xl md:rounded-2xl
          shadow-lg
          animate-slide-up
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile uniquement) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="p-5 md:p-6">
          <h2
            id="confirm-dialog-title"
            className="text-base md:text-lg font-bold text-slate-900"
          >
            {options.title}
          </h2>
          {options.description && (
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">
              {options.description}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse md:flex-row md:justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 md:border-0"
            >
              {options.cancelLabel ?? "Annuler"}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2.5 text-sm font-semibold text-white rounded-lg ${
                tone === "danger"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {options.confirmLabel ?? "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
