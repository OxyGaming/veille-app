"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminScopeMode } from "@/lib/admin-scope-preference";
import type { ResolvedAdminScope } from "@/lib/admin-scope";

type Props = {
  /** Scope résolu par le server layout. */
  scope: ResolvedAdminScope;
  /** Liste des équipes pour l'option « Une équipe ». */
  teams: { id: string; name: string }[];
  /** True si l'ADMIN a au moins une membership (sinon « Mes équipes » masqué). */
  hasMemberships: boolean;
  /** Style du badge : compact "header" ou plein "sidebar". */
  appearance?: "header" | "sidebar";
};

/**
 * Sélecteur de périmètre ADMIN (Sprint 6 C4).
 *
 * Badge cliquable qui ouvre un bottom-sheet plein écran sur mobile et
 * une popover compacte sur desktop. POST /api/admin/scope-preference
 * + `router.refresh()` au choix d'un mode.
 *
 * Visible **uniquement pour ADMIN** (l'appelant — AppShell — filtre).
 */
export function AdminScopeSelector({
  scope,
  teams,
  hasMemberships,
  appearance = "header",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Fermeture Escape + click outside
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function setMode(
    mode: AdminScopeMode,
    teamId: string | null = null,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/scope-preference", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, teamId }),
      });
      if (!r.ok) return;
      setOpen(false);
      // Re-rendu des Server Components — les agrégateurs liront la
      // nouvelle préférence dès C5+.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const triggerCls =
    appearance === "sidebar"
      ? "text-[11px] font-mono px-2 py-1 rounded border border-white/20 text-slate-200 hover:bg-white/5"
      : "text-[10px] font-mono px-2 py-1 rounded border border-white/20 text-slate-200 hover:bg-white/5 max-w-[110px] truncate";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerCls}
        title={`Périmètre — ${scope.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{scope.label}</span>
        <span aria-hidden className="ml-1 opacity-70">
          ▼
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-slate-900/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir un périmètre"
        >
          <div
            ref={dialogRef}
            className="w-full sm:w-[480px] max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4"
          >
            <header className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  Pilotage ADMIN
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  Choisir un périmètre
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100"
                aria-label="Fermer"
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </header>

            <div className="space-y-2">
              <OptionButton
                active={scope.mode === "GLOBAL"}
                label="Vue globale"
                hint="Toutes les équipes — comportement par défaut."
                onClick={() => setMode("GLOBAL")}
                disabled={busy}
              />
              {hasMemberships && (
                <OptionButton
                  active={scope.mode === "MY_TEAMS"}
                  label="Mes équipes"
                  hint="Restreint à mes appartenances."
                  onClick={() => setMode("MY_TEAMS")}
                  disabled={busy}
                />
              )}
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                Une équipe spécifique
              </p>
              {teams.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucune équipe disponible.
                </p>
              ) : (
                <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
                  {teams.map((t) => (
                    <li key={t.id}>
                      <OptionButton
                        active={
                          scope.mode === "TEAM" && scope.selectedTeamId === t.id
                        }
                        label={t.name}
                        onClick={() => setMode("TEAM", t.id)}
                        disabled={busy}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OptionButton({
  active,
  label,
  hint,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
        active
          ? "border-indigo-300 bg-indigo-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div
        className={`text-sm font-medium ${
          active ? "text-indigo-700" : "text-slate-900"
        }`}
      >
        {label}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
      )}
    </button>
  );
}
