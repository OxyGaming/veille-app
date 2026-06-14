"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type {
  AdminActionRow,
  AdminActionsFilters,
} from "@/lib/admin-actions-aggregator";

type Props = {
  initialItems: AdminActionRow[];
  initialNextCursor: string | null;
  filters: AdminActionsFilters;
};

/** Pastille colorée par statut. */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "ACTIVE" },
    OBSOLETE: { cls: "bg-slate-100 text-slate-600 border-slate-300", label: "OBSOLÈTE" },
    VALIDATED_LOCAL: { cls: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "VALIDÉE" },
    REPLACED: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "REMPLACÉE" },
  };
  const v = map[status] ?? {
    cls: "bg-slate-100 text-slate-600 border-slate-200",
    label: status,
  };
  return (
    <span
      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

/**
 * Tableau dense desktop + cards mobile (Sprint 7 C3).
 *
 * Sélection multiple ; bouton « Marquer obsolètes » avec confirmation
 * et appel batch `POST /api/actions/batch-obsolete`. Affichage d'un
 * résumé après réponse (updated / skipped / forbidden / alreadyObsolete).
 */
export function AdminActionsTable({
  initialItems,
  initialNextCursor,
  filters,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<AdminActionRow[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Les actions VALIDATED_LOCAL ne peuvent pas être rendues obsolètes
  // côté API → on les marque non-sélectionnables visuellement aussi.
  const eligibleIds = useMemo(
    () =>
      new Set(
        items
          .filter((i) => i.localStatus !== "VALIDATED_LOCAL")
          .map((i) => i.id),
      ),
    [items],
  );

  function toggle(id: string) {
    if (!eligibleIds.has(id)) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected(new Set(eligibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams(params.toString());
      qs.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/actions?${qs.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Erreur de chargement");
        return;
      }
      const payload = (await res.json()) as {
        items: AdminActionRow[];
        nextCursor: string | null;
      };
      setItems((arr) => [...arr, ...payload.items]);
      setNextCursor(payload.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmBatch() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/actions/batch-obsolete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionIds: ids }),
      });
      if (!res.ok) {
        toast.error("Erreur lors du batch");
        return;
      }
      const payload = (await res.json()) as {
        ok: boolean;
        requested: string[];
        updated: string[];
        skipped: string[];
        forbidden: string[];
        alreadyObsolete: string[];
      };
      const parts = [
        `${payload.updated.length} retirée(s)`,
        payload.alreadyObsolete.length > 0
          ? `${payload.alreadyObsolete.length} déjà obsolète(s)`
          : null,
        payload.skipped.length > 0
          ? `${payload.skipped.length} validée(s) (refusée(s))`
          : null,
        payload.forbidden.length > 0
          ? `${payload.forbidden.length} hors scope`
          : null,
      ].filter(Boolean);
      const summary = parts.join(" · ");
      if (payload.updated.length > 0) toast.success(summary);
      else toast.warning(summary || "Aucune action modifiée");
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selected.size;
  const totalEligibleOnPage = eligibleIds.size;
  const allSelectedOnPage =
    totalEligibleOnPage > 0 && selectedCount >= totalEligibleOnPage;

  return (
    <section className="px-4 lg:px-8 mt-4">
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={allSelectedOnPage ? clearSelection : selectAllOnPage}
          disabled={totalEligibleOnPage === 0}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {allSelectedOnPage
            ? "Tout désélectionner"
            : `Tout sélectionner (${totalEligibleOnPage})`}
        </button>
        <span
          aria-live="polite"
          className="text-xs text-slate-500 font-mono"
        >
          {selectedCount} sélectionnée
          {selectedCount > 1 ? "s" : ""}
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded-lg"
          >
            Marquer obsolètes ({selectedCount})
          </button>
        )}
      </div>

      {/* Desktop : tableau dense */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 w-10"></th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Équipe</th>
              <th className="text-left px-3 py-2">Cible</th>
              <th className="text-left px-3 py-2">Échéance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((a) => {
              const due = a.dueAt ? new Date(a.dueAt) : null;
              const late = due && due < new Date() && a.localStatus === "ACTIVE";
              const isEligible = eligibleIds.has(a.id);
              return (
                <tr
                  key={a.id}
                  className={selected.has(a.id) ? "bg-indigo-50/40" : undefined}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      disabled={!isEligible}
                      aria-label={`Sélectionner ${a.externalId}`}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 py-2 align-top min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {a.comment?.trim() ||
                        a.keyPoint?.trim() ||
                        `Action ${a.externalId}`}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {a.externalId}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge status={a.localStatus} />
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-slate-700">
                    {a.teamName}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {a.agentId && a.agentName ? (
                      <Link
                        href={`/agents/${a.agentId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {a.agentName}
                      </Link>
                    ) : a.siteId && a.siteName ? (
                      <Link
                        href={`/sites/${a.siteId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {a.siteName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {due ? (
                      <span className={late ? "text-rose-700 font-medium" : ""}>
                        {format(due, "P", { locale: fr })}
                        {late && " ⚠"}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-sm text-slate-500 py-8"
                >
                  Aucune action.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile : cards */}
      <ul className="md:hidden space-y-2">
        {items.map((a) => {
          const due = a.dueAt ? new Date(a.dueAt) : null;
          const late = due && due < new Date() && a.localStatus === "ACTIVE";
          const isEligible = eligibleIds.has(a.id);
          return (
            <li
              key={a.id}
              className={`bg-white border rounded-xl px-3 py-3 ${
                selected.has(a.id)
                  ? "border-indigo-300 bg-indigo-50/40"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  disabled={!isEligible}
                  aria-label={`Sélectionner ${a.externalId}`}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={a.localStatus} />
                    {late && (
                      <span className="text-[10px] font-mono text-rose-700">
                        ⚠ EN RETARD
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-800 mt-1">
                    {a.comment?.trim() ||
                      a.keyPoint?.trim() ||
                      `Action ${a.externalId}`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {a.teamName}
                    {a.agentName && ` · ${a.agentName}`}
                    {a.siteName && ` · ${a.siteName}`}
                  </div>
                  {due && (
                    <div
                      className={`text-[11px] font-mono mt-0.5 ${late ? "text-rose-700" : "text-slate-500"}`}
                    >
                      Échéance {format(due, "P", { locale: fr })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="text-center text-sm text-slate-500 py-6">
            Aucune action.
          </li>
        )}
      </ul>

      {nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/40 disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : "Afficher 50 de plus"}
          </button>
        </div>
      )}

      {confirming && (
        <BatchConfirmModal
          count={selectedCount}
          busy={busy}
          onConfirm={confirmBatch}
          onClose={() => !busy && setConfirming(false)}
        />
      )}
    </section>
  );
}

function BatchConfirmModal({
  count,
  busy,
  onConfirm,
  onClose,
}: {
  count: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
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
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Retirer en lot
            </div>
            <div className="text-sm font-semibold truncate">
              {count} action{count > 1 ? "s" : ""} sélectionnée
              {count > 1 ? "s" : ""}
            </div>
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
          <p className="text-sm text-slate-700 leading-relaxed">
            Les actions sélectionnées seront retirées du suivi opérationnel,
            mais resteront conservées dans l&apos;historique.
          </p>
          <p className="text-xs text-slate-500">
            Les actions déjà obsolètes ou validées seront automatiquement
            écartées du lot.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {busy ? "Retrait…" : `Retirer ${count} action${count > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
