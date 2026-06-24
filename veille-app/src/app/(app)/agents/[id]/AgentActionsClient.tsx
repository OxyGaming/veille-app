"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { TagChips, TagInput } from "@/components/TagChips";
import { TAG_OBLIGATOIRE, TAG_VEILLE_LEGALE } from "@/lib/tags";
import NoteModal from "@/components/NoteModal";
import SightingModal from "@/components/SightingModal";

type Duplicate = {
  id: string;
  externalId: string;
  dueAt: string | null;
  originalStatus: string | null;
  createdAt: string;
};
type Action = {
  id: string;
  externalId: string;
  comment: string | null;
  keyPoint: string | null;
  domain: string | null;
  theme: string | null;
  type: string | null;
  actionPlan: string | null;
  dueAt: string | null;
  procedureId: string | null;
  /** Nombre d'actions partageant la même empreinte logique (>=1). */
  duplicateCount: number;
  /** Détail de TOUTES les occurrences du groupe (la première est la principale). */
  duplicates: Duplicate[];
  tags: string[];
};

export default function AgentActionsClient({
  agentId,
  agentName,
  actions: initial,
  targetKind = "agent",
  userRole = "USER",
}: {
  agentId: string;
  agentName: string;
  actions: Action[];
  /** Type de cible : "agent" (par défaut) ou "site". Détermine les endpoints. */
  targetKind?: "agent" | "site";
  /**
   * Sprint 7 C2 — rôle de l'utilisateur courant. Conditionne l'affichage
   * du bouton « Retirer » (EDITOR / ADMIN uniquement, jamais USER).
   */
  userRole?: "USER" | "EDITOR" | "ADMIN";
}) {
  const router = useRouter();
  const [actions, setActions] = useState(initial);
  // Resynchro après `router.refresh()` : sans cet effet, l'état local restait
  // figé sur la liste du premier rendu — les actions ajoutées via le modal
  // « Ajouter une action » ou modifiées côté serveur n'apparaissaient pas
  // tant que l'utilisateur ne rechargeait pas manuellement. Pour les
  // validations, l'optimistic remove couvrait le cas, mais convergeait avec
  // l'état serveur après refresh — ce qui est ce qu'on veut.
  useEffect(() => {
    setActions(initial);
  }, [initial]);
  const [validating, setValidating] = useState<Action | null>(null);
  const [obsoleting, setObsoleting] = useState<Action | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [obsoleteBusy, setObsoleteBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [sighting, setSighting] = useState(false);
  const [noting, setNoting] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const canManage = userRole === "EDITOR" || userRole === "ADMIN";

  // Liste de tags disponibles = union (a.type ∪ a.tags) de toutes les actions
  // chargées. Triée pour stabilité du dropdown.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of actions) {
      if (a.type) set.add(a.type);
      for (const t of a.tags) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [actions]);

  // Filtrage client-side : la liste est petite (typiquement < 50 actions
  // par agent), un debounce n'apporterait rien. La recherche est instantanée.
  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !tagFilter) return actions;
    return actions.filter((a) => {
      if (tagFilter) {
        const hasTag = a.type === tagFilter || a.tags.includes(tagFilter);
        if (!hasTag) return false;
      }
      if (q) {
        const haystack = [
          a.comment,
          a.keyPoint,
          a.theme,
          a.domain,
          a.actionPlan,
          a.externalId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [actions, query, tagFilter]);

  const isFiltered = query.trim() !== "" || tagFilter !== "";

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openValidate(a: Action) {
    setValidating(a);
    setComment("");
  }

  async function confirmValidate() {
    if (!validating) return;
    setBusy(true);
    try {
      // Validation cascade : valide toutes les actions du groupe de doublons.
      const ids = validating.duplicates.map((d) => d.id);
      for (const aid of ids) {
        const res = await fetch(`/api/actions/${aid}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: comment.trim() || null }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(j.error || "Erreur de validation");
          return;
        }
      }
      setActions((arr) => arr.filter((x) => x.id !== validating.id));
      setValidating(null);
      toast.success("Action validée");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Sprint 7 C2 — Marquage obsolète (cascade sur le groupe de doublons).
  async function confirmObsolete() {
    if (!obsoleting) return;
    setObsoleteBusy(true);
    try {
      const ids = obsoleting.duplicates.map((d) => d.id);
      let updated = 0;
      for (const aid of ids) {
        const res = await fetch(`/api/actions/${aid}/obsolete`, {
          method: "POST",
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409 && j?.code === "ACTION_VALIDATED") {
            toast.error(
              "Annulez la validation avant de retirer cette action.",
            );
            return;
          }
          toast.error(j?.error || "Erreur lors du retrait");
          return;
        }
        if (j?.ok && !j.noop) updated++;
      }
      setActions((arr) => arr.filter((x) => x.id !== obsoleting.id));
      setObsoleting(null);
      toast.success(
        updated > 0
          ? "Action retirée du suivi opérationnel"
          : "Action déjà retirée",
      );
      router.refresh();
    } finally {
      setObsoleteBusy(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-slate-500">
          {actions.length === 0
            ? "Aucune action à traiter."
            : isFiltered
            ? `${filteredActions.length} / ${actions.length} action${actions.length > 1 ? "s" : ""} affichée${filteredActions.length > 1 ? "s" : ""}.`
            : `${actions.length} action${actions.length > 1 ? "s" : ""} en cours.`}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSighting(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700 inline-flex items-center gap-1.5"
            title={
              targetKind === "site"
                ? "Marquer une prise en compte du site"
                : "Marquer une simple prise en compte de l'agent (sans veille)"
            }
          >
            <Icon.Check className="w-4 h-4" /> Vu
          </button>
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 inline-flex items-center gap-1.5"
            title="Commentaire personnalisé (texte libre + photos)"
          >
            <Icon.MessageSquare className="w-4 h-4" /> Commentaire
          </button>
          {targetKind === "agent" && (
            <>
              {/*
                NB : on utilise `text-base` (et non `text-xs` comme les
                boutons frères Vu/Commentaire) parce qu'un reset global
                `button { font: inherit }` neutralise text-xs sur les
                <button> ; sans cet ajustement le lien <a> rendrait plus
                petit que les boutons (12 px vs 16 px) — visible à l'œil.
              */}
              <Link
                href={`/sessions/new?agentId=${agentId}`}
                className="text-base font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 inline-flex items-center gap-1.5"
                title="Démarrer une nouvelle session de veille pour cet agent"
              >
                <Icon.ClipboardCheck className="w-4 h-4" /> Veiller
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-primary"
          >
            <Icon.Plus className="w-4 h-4" /> Ajouter une action
          </button>
        </div>
      </div>
      {adding && (
        <ManualActionModal
          targetId={agentId}
          targetName={agentName}
          targetKind={targetKind}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
      {sighting && (
        <SightingModal
          targetId={agentId}
          targetName={agentName}
          targetKind={targetKind}
          onClose={() => setSighting(false)}
          onCreated={() => {
            setSighting(false);
            router.refresh();
          }}
        />
      )}
      {noting && (
        <NoteModal
          target={targetKind}
          targetId={agentId}
          targetName={agentName}
          onClose={() => setNoting(false)}
          onCreated={() => {
            setNoting(false);
            router.refresh();
          }}
        />
      )}
      {actions.length === 0 ? (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-6 text-center">
          Aucune action à traiter. Lancez un import Excel ou cliquez{" "}
          <button
            onClick={() => setAdding(true)}
            className="underline text-indigo-600"
          >
            Ajouter une action
          </button>
          .
        </div>
      ) : (
      <>
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer les actions…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Icon.Search
            className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            aria-hidden="true"
          />
        </div>
        {availableTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[40%]"
            aria-label="Filtrer par tag"
          >
            <option value="">Tous les tags</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTagFilter("");
            }}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Effacer
          </button>
        )}
      </div>
      {filteredActions.length === 0 ? (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-6 text-center">
          Aucune action ne correspond aux filtres.
        </div>
      ) : (
      <ul className="grid grid-cols-1 gap-2">
        {filteredActions.map((a) => {
          const due = a.dueAt ? new Date(a.dueAt) : null;
          const late = due && due < new Date();
          return (
            <li
              key={a.id}
              className={`relative bg-white border rounded-xl px-3 py-3 min-w-0 break-words transition-shadow hover:shadow-sm ${
                late
                  ? "border-rose-200 bg-rose-50/40"
                  : "border-slate-200"
              }`}
            >
              {canManage && (
                <button
                  type="button"
                  onClick={() => setObsoleting(a)}
                  title="Retirer cette action du suivi opérationnel (reste conservée dans l'historique)"
                  aria-label="Retirer cette action"
                  className="absolute top-2 right-2 w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Icon.X className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {a.type && (
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                    {a.type}
                  </span>
                )}
                {due && (
                  <span
                    className={`text-[10px] font-mono ${
                      late ? "text-rose-700" : "text-slate-500"
                    }`}
                  >
                    {late ? "⚠ EN RETARD · " : "Échéance "}
                    {format(due, "P", { locale: fr })}
                  </span>
                )}
                {a.duplicateCount > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(a.id);
                    }}
                    className={`text-[10px] font-mono inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                      expanded.has(a.id)
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-400"
                    }`}
                    title={`${a.duplicateCount} occurrences (IDs Action différents, contenu identique) — cliquer pour détails`}
                  >
                    ×{a.duplicateCount}
                    <span className="text-[8px] leading-none">
                      {expanded.has(a.id) ? "▴" : "▾"}
                    </span>
                  </button>
                )}
                {a.procedureId && (
                  <Link
                    href={`/procedures?proc=${a.procedureId}`}
                    className="text-[10px] font-mono text-indigo-600 underline"
                  >
                    Procédure liée
                  </Link>
                )}
              </div>
              {/* Action concrète à réaliser en titre (commentaire = description métier).
                  Le point clé reste comme contexte au-dessous (catégorisation). */}
              {a.comment ? (
                <div className="text-sm font-semibold leading-snug">
                  {a.comment}
                </div>
              ) : (
                <div className="text-sm font-semibold leading-snug">
                  {a.keyPoint || a.externalId}
                </div>
              )}
              {a.comment && (a.keyPoint || a.domain) && (
                <div className="text-[11px] text-slate-500 mt-1">
                  {a.keyPoint && <span className="font-medium">{a.keyPoint}</span>}
                  {a.keyPoint && a.domain && " · "}
                  {a.domain}
                  {a.theme && ` · ${a.theme}`}
                </div>
              )}
              {!a.comment && a.domain && (
                <div className="text-[11px] text-slate-500">
                  {a.domain}
                  {a.theme && ` · ${a.theme}`}
                </div>
              )}
              {a.tags.length > 0 && (
                <div className="mt-1.5">
                  <TagChips tags={a.tags} />
                </div>
              )}
              {a.actionPlan && (
                <div className="text-xs text-indigo-900 mt-1 line-clamp-2">
                  <b>Plan :</b> {a.actionPlan}
                </div>
              )}
              {a.duplicateCount > 1 && expanded.has(a.id) && (
                <div className="mt-2 border-t border-indigo-100 pt-2 animate-in">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-700 mb-1.5">
                    {a.duplicateCount} occurrences groupées
                  </div>
                  <ul className="space-y-1">
                    {a.duplicates.map((d, idx) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-2 text-[11px] font-mono py-1 px-2 rounded bg-indigo-50/60"
                      >
                        <span
                          className={`shrink-0 w-4 text-center font-semibold ${
                            idx === 0 ? "text-indigo-700" : "text-slate-500"
                          }`}
                        >
                          {idx === 0 ? "★" : `${idx + 1}`}
                        </span>
                        <span className="flex-1 truncate text-slate-700">
                          {d.externalId}
                        </span>
                        {d.originalStatus && (
                          <span className="text-slate-500">
                            {d.originalStatus}
                          </span>
                        )}
                        {d.dueAt && (
                          <span className="text-slate-700">
                            {format(new Date(d.dueAt), "P", { locale: fr })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-slate-500 mt-1.5 italic">
                    ★ occurrence principale (échéance la plus proche).
                    Cliquer « Valider » les marquera toutes réalisées.
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <button
                  onClick={() => openValidate(a)}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  ✓ Valider la réalisation
                  {a.duplicateCount > 1 && (
                    <span className="text-[10px] font-mono bg-white/20 px-1 py-px rounded">
                      ×{a.duplicateCount}
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      )}
      </>
      )}

      {validating && (
        <ValidateModal
          action={validating}
          comment={comment}
          setComment={setComment}
          busy={busy}
          onConfirm={confirmValidate}
          onClose={() => setValidating(null)}
        />
      )}
      {obsoleting && (
        <ObsoleteModal
          action={obsoleting}
          busy={obsoleteBusy}
          onConfirm={confirmObsolete}
          onClose={() => setObsoleting(null)}
        />
      )}
    </>
  );
}

/**
 * Sprint 7 C2 — Confirmation avant `POST /api/actions/[id]/obsolete`.
 *
 * Bottom-sheet mobile / modal centré desktop, calqué sur `ValidateModal`
 * pour cohérence UX. Message PO littéral. Pas de saisie — confirmation pure.
 */
function ObsoleteModal({
  action,
  busy,
  onConfirm,
  onClose,
}: {
  action: Action;
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
              Retirer une action
            </div>
            <div className="text-sm font-semibold truncate">
              {action.keyPoint || action.externalId}
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
            Cette action sera retirée du suivi opérationnel, mais restera
            conservée dans l&apos;historique.
          </p>
          {action.duplicateCount > 1 && (
            <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="font-mono font-bold">
                ×{action.duplicateCount}
              </span>
              <span>
                Cette action est présente {action.duplicateCount} fois sous
                des IDs différents. Toutes les occurrences seront retirées.
              </span>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <Icon.X className="w-4 h-4" />
              {busy
                ? "Retrait…"
                : action.duplicateCount > 1
                  ? `Retirer les ${action.duplicateCount} occurrences`
                  : "Confirmer le retrait"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ValidateModal({
  action,
  comment,
  setComment,
  busy,
  onConfirm,
  onClose,
}: {
  action: Action;
  comment: string;
  setComment: (s: string) => void;
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
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Valider une action
            </div>
            <div className="text-sm font-semibold truncate">
              {action.keyPoint || action.externalId}
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
          {action.duplicateCount > 1 && (
            <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="font-mono font-bold">×{action.duplicateCount}</span>
              <span>
                Cette action est présente {action.duplicateCount} fois sous des
                IDs différents pour cet agent. La validation les marquera{" "}
                <b>toutes</b> comme réalisées.
              </span>
            </div>
          )}
          <label className="block text-xs font-medium text-slate-500">
            Commentaire (optionnel)
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Précisez les conditions de réalisation, le contexte…"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {busy
                ? "Validation…"
                : action.duplicateCount > 1
                ? `Valider les ${action.duplicateCount} occurrences`
                : "Confirmer la validation"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Modal de création manuelle d'une action sur la fiche d'un agent ou d'un site.
 * Tags par défaut : "veille légale" + "obligatoire" — pré-remplis mais
 * supprimables par l'utilisateur s'ils ne s'appliquent pas.
 * Titre obligatoire, échéance par défaut +7 mois (éditable).
 */
function ManualActionModal({
  targetId,
  targetName,
  targetKind,
  onClose,
  onCreated,
}: {
  targetId: string;
  targetName: string;
  targetKind: "agent" | "site";
  onClose: () => void;
  onCreated: () => void;
}) {
  const defaultDue = format(addMonths(new Date(), 7), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [tags, setTags] = useState<string[]>([
    TAG_VEILLE_LEGALE,
    TAG_OBLIGATOIRE,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const url =
        targetKind === "site"
          ? `/api/sites/${targetId}/actions`
          : `/api/agents/${targetId}/actions`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueAt: new Date(dueAt + "T00:00:00").toISOString(),
          extraTags: tags,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Erreur lors de la création");
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
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
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Icon.Plus className="w-4 h-4 text-indigo-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Ajouter une action
            </div>
            <div className="text-sm font-semibold truncate">
              {targetName}
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
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Titre <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Renouvellement habilitation S0"
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Échéance{" "}
              <span className="text-[10px] font-mono text-slate-400">
                (défaut M+7)
              </span>
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tags{" "}
              <span className="text-[10px] text-slate-400">
                (« veille légale » et « obligatoire » par défaut, supprimables)
              </span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="Ajouter un tag (Entrée pour valider)…"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="btn btn-primary"
            >
              {submitting ? "Création…" : "Créer l'action"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/*
 * SightingModal extraite en module réutilisable — voir
 * `@/components/SightingModal` (C11.2). Le comportement est inchangé.
 */
