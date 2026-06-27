"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TagChips, TagInput } from "@/components/TagChips";
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
 * Lot 4B-4 — badge ×N indiquant que la ligne appartient à un groupe logique de
 * plusieurs occurrences (même cible + équipe + dedupHash) sur le périmètre
 * filtré. Purement informatif : les lignes ne sont JAMAIS fusionnées.
 */
function GroupBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span
      title={`Action logique regroupant ${count} occurrences sur le périmètre filtré`}
      className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200 whitespace-nowrap"
    >
      ×{count}
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
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Resynchro après changement de filtre / recherche : le composant serveur
  // re-fetche et envoie un nouveau `initialItems` filtré, mais `useState`
  // n'initialise qu'au mount. Sans cet effet la liste rendue restait celle
  // du premier rendu (compteur côté FiltersBar mis à jour, liste figée → on
  // voyait « 12 actions » et 61 items affichés). On vide aussi la sélection
  // car les ids cochés peuvent ne plus être visibles après filtrage.
  useEffect(() => {
    setItems(initialItems);
    setNextCursor(initialNextCursor);
    setSelected(new Set());
  }, [initialItems, initialNextCursor]);

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

  async function confirmHardDelete(reason: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/actions/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionIds: ids, reason }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Erreur lors de la suppression");
        return;
      }
      const payload = (await res.json()) as {
        deleted: string[];
        blockedValidated: string[];
        forbidden: string[];
      };
      const parts = [
        `${payload.deleted.length} supprimée(s)`,
        payload.blockedValidated.length > 0
          ? `${payload.blockedValidated.length} bloquée(s) (validée(s))`
          : null,
        payload.forbidden.length > 0
          ? `${payload.forbidden.length} hors scope`
          : null,
      ].filter(Boolean);
      const summary = parts.join(" · ");
      if (payload.deleted.length > 0) toast.success(summary);
      else toast.warning(summary || "Aucune action supprimée");
      // Retrait optimiste local + refresh server-state.
      setItems((arr) =>
        arr.filter((a) => !payload.deleted.includes(a.id)),
      );
      setSelected(new Set());
      setDeleting(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmReplace(content: {
    comment: string | null;
    keyPoint: string | null;
    theme: string | null;
    domain: string | null;
    dueAt: string | null | undefined;
    tags: string[] | undefined;
  }) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/actions/batch-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionIds: ids, content }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Erreur lors du remplacement");
        return;
      }
      const payload = (await res.json()) as {
        replaced: string[];
        createdIds: string[];
        skippedValidated: string[];
        forbidden: string[];
      };
      const parts = [
        `${payload.replaced.length} remplacée(s)`,
        payload.skippedValidated.length > 0
          ? `${payload.skippedValidated.length} validée(s) (refusée(s))`
          : null,
        payload.forbidden.length > 0
          ? `${payload.forbidden.length} hors scope`
          : null,
      ].filter(Boolean);
      const summary = parts.join(" · ");
      if (payload.replaced.length > 0) toast.success(summary);
      else toast.warning(summary || "Aucune action remplacée");
      setSelected(new Set());
      setReplacing(false);
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
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs bg-slate-600 hover:bg-slate-700 text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              Marquer obsolètes ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              Remplacer ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              Supprimer définitivement ({selectedCount})
            </button>
          </div>
        )}
      </div>

      {/* Desktop : tableau dense */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {/* table-fixed + largeurs explicites : sans ça la colonne Action
            (texte en nowrap via `truncate`) prenait sa largeur max-content et
            poussait les autres colonnes hors écran. */}
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 w-10"></th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2 w-28">Statut</th>
              <th className="text-left px-3 py-2 w-40">Équipe</th>
              <th className="text-left px-3 py-2 w-44">Agent / Site</th>
              <th className="text-left px-3 py-2 w-52">Tags</th>
              <th className="text-left px-3 py-2 w-28">Échéance</th>
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-mono text-slate-500 truncate">
                        {a.externalId}
                      </span>
                      <GroupBadge count={a.occurrenceCount} />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge status={a.localStatus} />
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-slate-700">
                    <span className="block truncate" title={a.teamName}>
                      {a.teamName}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {a.agentId && a.agentName ? (
                      <Link
                        href={`/agents/${a.agentId}`}
                        className="block truncate text-indigo-600 hover:underline"
                        title={a.agentName}
                      >
                        {a.agentName}
                      </Link>
                    ) : a.siteId && a.siteName ? (
                      <Link
                        href={`/sites/${a.siteId}`}
                        className="block truncate text-indigo-600 hover:underline"
                        title={a.siteName}
                      >
                        {a.siteName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {a.tags.length ? (
                      <TagChips tags={a.tags} size="xs" />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
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
                  colSpan={7}
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
                    <GroupBadge count={a.occurrenceCount} />
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
                  {a.tags.length > 0 && (
                    <div className="mt-1.5">
                      <TagChips tags={a.tags} size="xs" />
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

      {deleting && (
        <BatchDeleteModal
          count={selectedCount}
          busy={busy}
          onConfirm={confirmHardDelete}
          onClose={() => !busy && setDeleting(false)}
        />
      )}

      {replacing && (
        <BatchReplaceModal
          count={selectedCount}
          busy={busy}
          onConfirm={confirmReplace}
          onClose={() => !busy && setReplacing(false)}
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

/**
 * Modale de suppression définitive (hard delete) en lot. Motif obligatoire
 * (3–500 caractères) tracé dans l'audit. Bouton « Supprimer » désactivé tant
 * que la contrainte n'est pas remplie ou qu'un appel est en cours.
 */
function BatchDeleteModal({
  count,
  busy,
  onConfirm,
  onClose,
}: {
  count: number;
  busy: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const trimmedLen = reason.trim().length;
  const valid = trimmedLen >= 3 && trimmedLen <= 500;
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
            <div className="text-[10px] font-mono uppercase tracking-wider text-rose-600">
              Suppression définitive
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
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 space-y-1">
            <p className="font-semibold">Cette suppression est définitive.</p>
            <p>
              Les lignes seront retirées de la base. Les actions ayant déjà au
              moins une validation seront automatiquement écartées du lot.
            </p>
            <p>L&apos;opération est enregistrée dans le journal d&apos;audit.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Motif de suppression{" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex. : import erroné, doublons à purger…"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              autoFocus
            />
            <div className="flex justify-between text-[10px] mt-1">
              <span
                className={
                  trimmedLen > 0 && trimmedLen < 3
                    ? "text-rose-600"
                    : "text-slate-400"
                }
              >
                Minimum 3 caractères
              </span>
              <span className="text-slate-400 font-mono">{trimmedLen}/500</span>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={() => onConfirm(reason.trim())}
              disabled={!valid || busy}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {busy
                ? "Suppression…"
                : `Supprimer ${count} action${count > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Modale de remplacement en lot. Au moins un champ doit être renseigné.
 * `dueAt` non renseignée → hérite par-action de la valeur originale. Renseignée
 * → applique la même échéance à toutes les nouvelles. Vide → null pour toutes.
 */
function BatchReplaceModal({
  count,
  busy,
  onConfirm,
  onClose,
}: {
  count: number;
  busy: boolean;
  onConfirm: (content: {
    comment: string | null;
    keyPoint: string | null;
    theme: string | null;
    domain: string | null;
    dueAt: string | null | undefined;
    tags: string[] | undefined;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const [keyPoint, setKeyPoint] = useState("");
  const [theme, setTheme] = useState("");
  const [domain, setDomain] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [touchDueAt, setTouchDueAt] = useState(false);
  // Tags : la sémantique « non touché → hérite, touché → applique » est
  // signalée par `touchTags`. Cela permet à l'utilisateur de remplacer par
  // une liste vide explicite (= retirer tous les tags des originales).
  const [tags, setTags] = useState<string[]>([]);
  const [touchTags, setTouchTags] = useState(false);
  const anyFieldFilled =
    comment.trim() !== "" ||
    keyPoint.trim() !== "" ||
    theme.trim() !== "" ||
    domain.trim() !== "" ||
    touchTags;
  const valid = anyFieldFilled;
  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-600">
              Remplacement en lot
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
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 space-y-1">
            <p>
              Pour chaque action sélectionnée, une <strong>nouvelle</strong>{" "}
              action est créée avec ces champs (les liens agent/site/équipe
              sont conservés). L&apos;originale passe en{" "}
              <code>REPLACED</code> et disparaît du suivi.
            </p>
            <p className="text-slate-500">
              Les actions déjà validées seront écartées du lot.
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
              Commentaire (titre)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Description concrète à réaliser…"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Point clé
              </span>
              <input
                type="text"
                value={keyPoint}
                onChange={(e) => setKeyPoint(e.target.value)}
                maxLength={500}
                placeholder="Catégorisation"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Échéance
              </span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => {
                  setDueAt(e.target.value);
                  setTouchDueAt(true);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">
                {touchDueAt
                  ? dueAt
                    ? "Appliquée à toutes les nouvelles."
                    : "Sera effacée pour toutes."
                  : "Vide = hérite de l'originale."}
              </span>
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Thème
              </span>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Domaine
              </span>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Tags
              </span>
              <span className="text-[10px] text-slate-400">
                {touchTags
                  ? tags.length === 0
                    ? "Liste vide — toutes les nouvelles seront sans tag."
                    : `${tags.length} appliqué${tags.length > 1 ? "s" : ""} à toutes les nouvelles.`
                  : "Non touché = hérite des originales."}
              </span>
            </div>
            <TagInput
              tags={tags}
              onChange={(next) => {
                setTags(next);
                setTouchTags(true);
              }}
              placeholder="Ajouter un tag (Entrée pour valider)…"
            />
            {touchTags && (
              <button
                type="button"
                onClick={() => {
                  setTags([]);
                  setTouchTags(false);
                }}
                className="mt-1 text-[10px] text-slate-500 underline hover:text-slate-700"
              >
                Revenir à « hériter des originales »
              </button>
            )}
          </div>
          {!anyFieldFilled && (
            <p className="text-[11px] text-slate-500">
              Renseigne au moins un champ de contenu (texte ou tags) pour
              activer le remplacement.
            </p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-end shrink-0">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              onConfirm({
                comment: comment.trim() || null,
                keyPoint: keyPoint.trim() || null,
                theme: theme.trim() || null,
                domain: domain.trim() || null,
                dueAt: touchDueAt
                  ? dueAt
                    ? new Date(dueAt + "T00:00:00").toISOString()
                    : null
                  : undefined,
                tags: touchTags ? tags : undefined,
              })
            }
            disabled={!valid || busy}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {busy
              ? "Remplacement…"
              : `Remplacer ${count} action${count > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </>
  );
}
