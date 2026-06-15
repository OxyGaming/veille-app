"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import type { EcheanceItem } from "@/lib/echeances/types";

type Props = {
  item: EcheanceItem;
};

/** Renvoie l'endpoint POST adapté au type d'échéance, ou null si non-actionnable. */
function endpointFor(item: EcheanceItem): string | null {
  const sourceId = item.id.split(":").slice(1).join(":");
  if (!sourceId) return null;
  if (item.kind === "ACTION_OVERDUE") {
    return `/api/actions/${sourceId}/postpone`;
  }
  if (item.kind === "EQUIPMENT_EXPIRING") {
    const siteId = item.context.siteId;
    if (!siteId) return null;
    return `/api/sites/${siteId}/equipment/${sourceId}/postpone`;
  }
  return null;
}

/** Champ JSON envoyé au backend pour la nouvelle date. */
function payloadField(item: EcheanceItem): "dueAt" | "expirationDate" {
  return item.kind === "ACTION_OVERDUE" ? "dueAt" : "expirationDate";
}

/** YYYY-MM-DD pour `<input type="date">` à partir d'une Date. */
function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PostponeButton({ item }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(
    toDateInputValue(item.dueAt ?? new Date())
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = endpointFor(item);
  if (!endpoint) return null;

  function reset() {
    setReason("");
    setError(null);
    setDate(toDateInputValue(item.dueAt ?? new Date()));
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function submit() {
    if (!date || reason.trim().length < 3) {
      setError("Date et raison (3 caractères min.) sont requises.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const iso = new Date(date + "T08:00:00").toISOString();
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [payloadField(item)]: iso,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Échec du report.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
        title="Reporter l'échéance"
      >
        <Icon.Calendar className="w-3 h-3" />
        Reporter
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 z-50"
            onClick={close}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-200">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Reporter l'échéance
              </div>
              <div className="text-sm font-bold truncate">{item.title}</div>
              {item.subtitle && (
                <div className="text-[11px] text-slate-500 truncate">
                  {item.subtitle}
                </div>
              )}
              <div className="text-[11px] font-mono text-slate-500 mt-1">
                Échéance actuelle :{" "}
                {item.dueAt
                  ? item.dueAt.toLocaleDateString("fr-FR")
                  : "jamais effectuée"}
              </div>
            </header>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nouvelle date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Motif du report{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Ex. : extension obtenue par le fournisseur, attente de pièce…"
                  className="input"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tracé dans le journal d'audit.
                </p>
              </div>
              {error && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Icon.AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="btn btn-primary"
              >
                {busy ? "Report en cours…" : "Reporter"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
