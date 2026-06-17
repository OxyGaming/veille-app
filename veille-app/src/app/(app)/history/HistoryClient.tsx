"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Icon } from "@/components/icons";

type Entry = {
  type:
    | "visit"
    | "session"
    | "validation"
    | "sighting"
    | "note"
    | "site-sighting"
    | "site-note";
  id: string;
  at: string;
  observerName: string | null;
  title: string;
  subtitle: string | null;
  agentId?: string | null;
  agentName?: string | null;
  siteId?: string | null;
  href: string;
  badges?: string[];
  accent?: "default" | "warn" | "ok" | "info";
  icareDone?: boolean;
  commentText?: string | null;
  actionComment?: string | null;
};

const FILTERS = [
  { v: "visit", label: "Visites", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { v: "session", label: "Sessions", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { v: "validation", label: "Validations", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { v: "sighting", label: "Vu / Notes", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

const ICON: Record<Entry["type"], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  visit: Icon.FileText,
  session: Icon.ClipboardCheck,
  validation: Icon.Check,
  sighting: Icon.User,
  note: Icon.MessageSquare,
  "site-sighting": Icon.Building,
  "site-note": Icon.MessageSquare,
};

/**
 * Code couleur par type d'événement — barre latérale, fond d'icône, étiquette
 * "type" en mono. L'objectif est que l'utilisateur identifie le type sans
 * lire le texte.
 */
const EVENT_THEME: Record<
  Entry["type"],
  { bar: string; iconBg: string; iconText: string; label: string; tag: string }
> = {
  visit: {
    bar: "bg-indigo-500",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
    label: "VISITE",
    tag: "text-indigo-700",
  },
  session: {
    bar: "bg-cyan-500",
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-700",
    label: "SESSION",
    tag: "text-cyan-700",
  },
  validation: {
    bar: "bg-emerald-500",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    label: "VALIDATION",
    tag: "text-emerald-700",
  },
  sighting: {
    bar: "bg-violet-500",
    iconBg: "bg-violet-100",
    iconText: "text-violet-700",
    label: "VU AGENT",
    tag: "text-violet-700",
  },
  note: {
    bar: "bg-amber-500",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    label: "COMMENTAIRE",
    tag: "text-amber-700",
  },
  "site-sighting": {
    bar: "bg-sky-500",
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
    label: "VU SITE",
    tag: "text-sky-700",
  },
  "site-note": {
    bar: "bg-rose-500",
    iconBg: "bg-rose-100",
    iconText: "text-rose-700",
    label: "COMMENTAIRE SITE",
    tag: "text-rose-700",
  },
};

type FilterMeta = {
  users: { id: string; name: string }[];
  agents: { id: string; lastName: string; firstName: string; matricule: string }[];
  sites: { id: string; name: string; code: string | null }[];
};

/**
 * Mappe les 7 types affichés dans l'UI vers les 5 types backend.
 * (`sighting`/`note` cohabitent dans `AgentSighting` via `kind`, idem
 * `site-sighting`/`site-note` dans `SiteSighting`.)
 */
function mapApiType(type: Entry["type"]): string {
  switch (type) {
    case "visit":
      return "visit";
    case "session":
      return "session";
    case "validation":
      return "validation";
    case "sighting":
    case "note":
      return "agent-sighting";
    case "site-sighting":
    case "site-note":
      return "site-sighting";
  }
}

/**
 * Endpoint PATCH pour éditer le commentaire associé à une entrée d'historique.
 * Renvoie null pour les types qui n'ont pas de commentaire éditable
 * (visite, session — le « commentaire » de session est porté par les
 * observations à l'intérieur, hors périmètre de cette vue).
 */
function commentEditEndpoint(e: Entry): string | null {
  switch (e.type) {
    case "validation":
      return `/api/actions/validations/${e.id}`;
    case "sighting":
    case "note":
      return `/api/sightings/${e.id}`;
    case "site-sighting":
    case "site-note":
      return `/api/site-sightings/${e.id}`;
    default:
      return null;
  }
}

export default function HistoryClient({ userRole }: { userRole: string }) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";
  const canEditComments = userRole === "ADMIN" || userRole === "EDITOR";
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [editTarget, setEditTarget] = useState<{
    entry: Entry;
    field: "commentText" | "actionComment";
  } | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<string>>(
    new Set(["visit", "session", "validation", "sighting"])
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [observerId, setObserverId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/history/filters")
      .then((r) => r.json())
      .then((j) => setMeta(j))
      .catch(() => setMeta({ users: [], agents: [], sites: [] }));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", [...types].join(","));
      if (from) params.set("from", new Date(from + "T00:00:00").toISOString());
      if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
      if (observerId) params.set("observerId", observerId);
      if (agentId) params.set("agentId", agentId);
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`/api/history?${params}`);
      if (res.ok) {
        const j = await res.json();
        setEntries(j.entries);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, from, to, observerId, agentId, siteId]);

  function toggleType(t: string) {
    setTypes((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function toggleIcare(e: Entry) {
    // Optimiste : on bascule immédiatement, et on rollback si l'API échoue.
    setEntries((prev) =>
      prev?.map((it) =>
        it.type === e.type && it.id === e.id
          ? { ...it, icareDone: !it.icareDone }
          : it
      ) ?? prev
    );
    try {
      const res = await fetch("/api/icare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refType: e.type, refId: e.id }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = (await res.json()) as { done: boolean };
      setEntries((prev) =>
        prev?.map((it) =>
          it.type === e.type && it.id === e.id
            ? { ...it, icareDone: j.done }
            : it
        ) ?? prev
      );
    } catch {
      // rollback
      setEntries((prev) =>
        prev?.map((it) =>
          it.type === e.type && it.id === e.id
            ? { ...it, icareDone: e.icareDone }
            : it
        ) ?? prev
      );
    }
  }

  async function performDelete(
    target: Entry,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const apiType = mapApiType(target.type);
    const res = await fetch(
      `/api/admin/history/${apiType}/${target.id}/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    if (res.ok) {
      // Retrait optimiste de la ligne, puis refresh server pour resync
      // (Today, dashboards, Hub Échéances qui pourraient dépendre de
      // cette entrée).
      setEntries((prev) =>
        prev?.filter(
          (it) => !(it.type === target.type && it.id === target.id),
        ) ?? prev,
      );
      toast.success("Entrée supprimée");
      setDeleteTarget(null);
      router.refresh();
      return { ok: true };
    }
    if (res.status === 404) {
      toast.error("Entrée introuvable.");
      return { ok: false, error: "Entrée introuvable." };
    }
    if (res.status === 401 || res.status === 403) {
      toast.error("Action non autorisée.");
      return { ok: false, error: "Action non autorisée." };
    }
    const j = await res.json().catch(() => ({}));
    const message =
      (j as { error?: string }).error || "Échec de la suppression.";
    return { ok: false, error: message };
  }

  const grouped = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const day = e.at.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [entries]);

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
          Historique
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Visites de site, sessions de veille, validations d&apos;actions et
          « Vu » agent.
        </p>
      </div>

      <div className="card p-3 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map((f) => {
            const sel = types.has(f.v);
            return (
              <button
                key={f.v}
                onClick={() => toggleType(f.v)}
                className={`text-xs font-mono px-3 py-1.5 rounded-md border transition-colors ${
                  sel
                    ? f.color + " border-current"
                    : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <div className="ml-auto flex gap-2 items-center text-xs">
            <span className="text-slate-500">Du</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input max-w-[140px] text-xs"
            />
            <span className="text-slate-500">au</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input max-w-[140px] text-xs"
            />
            {(from || to) && (
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="text-xs text-slate-500 underline"
              >
                Effacer
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Créateur</span>
            <select
              value={observerId}
              onChange={(e) => setObserverId(e.target.value)}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Agent</span>
            <select
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                if (e.target.value) setSiteId("");
              }}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.lastName} {a.firstName} ({a.matricule})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Site</span>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                if (e.target.value) setAgentId("");
              }}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </select>
          </label>
          {(observerId || agentId || siteId) && (
            <button
              onClick={() => {
                setObserverId("");
                setAgentId("");
                setSiteId("");
              }}
              className="md:col-span-3 text-[11px] text-slate-500 underline justify-self-end"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-sm text-slate-500 text-center py-8">
          Chargement…
        </div>
      )}

      {entries && !loading && entries.length === 0 && (
        <div className="card text-center py-12 text-sm text-slate-500">
          Aucune entrée pour ces filtres.
        </div>
      )}

      <div className="grid gap-6">
        {grouped.map(([day, list]) => (
          <section key={day}>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 px-1">
              {format(new Date(day + "T12:00:00"), "EEEE d MMMM yyyy", {
                locale: fr,
              })}
            </div>
            <ul className="grid gap-2">
              {list.map((e) => {
                const Icn = ICON[e.type];
                const theme = EVENT_THEME[e.type];
                const entryKey = `${e.type}:${e.id}`;
                const isInfoOpen = openInfoId === entryKey;
                const hasEditButton =
                  canEditComments &&
                  !!commentEditEndpoint(e) &&
                  !!(e.commentText || e.actionComment);
                return (
                  <li
                    key={entryKey}
                    className={`relative flex flex-col md:flex-row md:items-stretch border rounded-xl hover:shadow-md transition-all ${
                      e.icareDone
                        ? "bg-emerald-50/70 border-emerald-300"
                        : "bg-white border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <span
                      className={`hidden md:block w-2 shrink-0 rounded-l-xl ${
                        e.icareDone ? "bg-emerald-500" : theme.bar
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`md:hidden h-1.5 shrink-0 rounded-t-xl ${
                        e.icareDone ? "bg-emerald-500" : theme.bar
                      }`}
                      aria-hidden="true"
                    />
                    <Link
                      href={e.href}
                      className="flex items-start gap-3 p-3 flex-1 min-w-0"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${
                          e.icareDone
                            ? "bg-emerald-100 text-emerald-700"
                            : `${theme.iconBg} ${theme.iconText}`
                        }`}
                      >
                        <Icn className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${
                            e.icareDone ? "text-emerald-700" : theme.tag
                          }`}
                        >
                          {format(new Date(e.at), "HH:mm", { locale: fr })} ·{" "}
                          {theme.label}
                        </div>
                        <div
                          className={`text-sm ${
                            e.icareDone ? "text-emerald-900" : "text-slate-900"
                          }`}
                        >
                          {e.title}
                        </div>
                        {e.agentName && (
                          <div
                            className={`text-[11px] ${
                              e.icareDone
                                ? "text-emerald-700"
                                : "text-slate-600"
                            }`}
                          >
                            Agent : {e.agentName}
                          </div>
                        )}
                        {e.observerName && (
                          <div
                            className={`text-[11px] ${
                              e.icareDone
                                ? "text-emerald-700/80"
                                : "text-slate-500"
                            }`}
                          >
                            par {e.observerName}
                          </div>
                        )}
                        {e.commentText && (
                          <div
                            className={`text-[12px] mt-1 italic ${
                              e.icareDone
                                ? "text-emerald-800"
                                : "text-slate-600"
                            }`}
                          >
                            « {e.commentText} »
                          </div>
                        )}
                        {e.badges && e.badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {e.badges.map((b, i) => {
                              const isImport = b === "Import";
                              return (
                                <span
                                  key={i}
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                    e.icareDone
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isImport
                                      ? "bg-sky-100 text-sky-800 border border-sky-200 font-semibold uppercase tracking-wider"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {b}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Link>
                    <div
                      className={`${
                        e.actionComment ? "flex" : "hidden lg:flex"
                      } items-stretch shrink-0 rounded-b-xl md:rounded-b-none md:rounded-r-xl ${
                        isAdmin || hasEditButton ? "lg:rounded-r-none" : ""
                      } border-t md:border-t-0 md:border-l ${
                        e.icareDone
                          ? "border-emerald-200"
                          : "border-slate-100"
                      }`}
                    >
                      {e.actionComment && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenInfoId(isInfoOpen ? null : entryKey)
                          }
                          aria-label="Voir le commentaire associé"
                          aria-expanded={isInfoOpen}
                          title="Voir le commentaire associé"
                          className={`flex items-center justify-center px-3 transition-colors ${
                            isInfoOpen
                              ? "bg-indigo-50 text-indigo-700"
                              : e.icareDone
                              ? "text-emerald-700 hover:bg-emerald-100"
                              : "text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
                          }`}
                        >
                          <Icon.MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                      <label
                        className={`hidden lg:flex items-center gap-1.5 pr-3 pl-2 cursor-pointer select-none text-[11px] font-mono ${
                          e.icareDone
                            ? "text-emerald-800"
                            : "text-slate-400"
                        } ${
                          e.actionComment
                            ? e.icareDone
                              ? "border-l border-emerald-200"
                              : "border-l border-slate-100"
                            : ""
                        }`}
                        title={
                          e.icareDone
                            ? "Saisie Icare effectuée"
                            : "Cochez quand la saisie Icare est faite"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!!e.icareDone}
                          onChange={() => toggleIcare(e)}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                        <span>Icare</span>
                      </label>
                    </div>
                    {isInfoOpen && e.actionComment && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setOpenInfoId(null)}
                          aria-hidden="true"
                        />
                        <div
                          role="dialog"
                          className="absolute z-40 right-2 top-full mt-1 w-72 max-w-[calc(100vw-1rem)] bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs text-slate-700"
                        >
                          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            Commentaire
                          </div>
                          <div className="italic whitespace-pre-wrap break-words">
                            « {e.actionComment} »
                          </div>
                        </div>
                      </>
                    )}
                    {/*
                      Colonne d'actions admin/éditeur (≥ lg uniquement) — empile
                      « Modifier le commentaire » au-dessus de « Supprimer ». Le
                      crayon n'apparaît que si l'entrée a un commentaire éditable
                      (`commentText` ou `actionComment` + endpoint connu). Le rendu
                      conditionnel React garantit qu'un USER ne reçoit jamais ces
                      boutons ; les API serveur revérifient le rôle (défense en
                      profondeur).
                    */}
                    {(hasEditButton || isAdmin) && (
                      <div className="hidden lg:flex flex-col shrink-0 lg:rounded-r-xl border-l border-slate-100 overflow-hidden">
                        {hasEditButton && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditTarget({
                                entry: e,
                                field: e.commentText
                                  ? "commentText"
                                  : "actionComment",
                              })
                            }
                            title="Modifier le commentaire"
                            aria-label="Modifier le commentaire"
                            className={`flex-1 inline-flex items-center justify-center px-3 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${
                              isAdmin ? "border-b border-slate-100" : ""
                            }`}
                          >
                            <Icon.FileEdit className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(e)}
                            title="Supprimer cette entrée (admin)"
                            className="flex-1 inline-flex items-center justify-center px-3 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            aria-label="Supprimer cette entrée"
                          >
                            <Icon.Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {deleteTarget && (
        <DeleteEntryDialog
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={performDelete}
        />
      )}

      {editTarget && (
        <EditCommentDialog
          target={editTarget.entry}
          field={editTarget.field}
          onCancel={() => setEditTarget(null)}
          onSaved={(nextValue) => {
            setEntries((prev) =>
              prev?.map((it) =>
                it.type === editTarget.entry.type &&
                it.id === editTarget.entry.id
                  ? { ...it, [editTarget.field]: nextValue }
                  : it
              ) ?? prev
            );
            setEditTarget(null);
            toast.success("Commentaire mis à jour");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Modale de confirmation de suppression d'une entrée d'historique.
 *
 * - Affiche un avertissement clair sur l'irréversibilité.
 * - Champ motif obligatoire (3–500 caractères, trim côté client) — le
 *   bouton « Supprimer définitivement » reste désactivé tant que la
 *   contrainte n'est pas remplie ou qu'un appel est en cours.
 * - Délègue l'appel API au parent (`onConfirm`). Le parent ferme la
 *   modale en cas de succès (setDeleteTarget(null)). En cas d'échec,
 *   l'erreur remonte ici pour affichage inline.
 */
function DeleteEntryDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: Entry;
  onCancel: () => void;
  onConfirm: (
    target: Entry,
    reason: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLen = reason.trim().length;
  const valid = trimmedLen >= 3 && trimmedLen <= 500;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onConfirm(target, reason.trim());
      if (!r.ok) {
        setError(r.error ?? "Échec de la suppression.");
        setBusy(false);
      }
      // En cas de succès, le parent unmount la modale — pas de setBusy(false).
    } catch {
      setError("Échec inattendu.");
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50"
        onClick={busy ? undefined : onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden mx-4">
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-600">
            Suppression
          </div>
          <div className="text-base font-bold">Supprimer cette entrée ?</div>
        </header>
        <div className="p-4 space-y-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 space-y-1">
            <p className="font-semibold">Cette suppression est définitive.</p>
            <p>Toutes les données associées seront supprimées.</p>
            <p>L&apos;opération est enregistrée dans le journal d&apos;audit.</p>
          </div>
          <div className="text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2">
            <div className="font-mono font-semibold uppercase tracking-wider mb-0.5 text-[10px] text-slate-500">
              Entrée
            </div>
            <div className="font-semibold text-slate-900 truncate">
              {target.title}
            </div>
            {target.subtitle && (
              <div className="text-slate-500 truncate">{target.subtitle}</div>
            )}
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
              placeholder="Ex. : doublon import, saisie erronée…"
              className="input"
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
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="text-sm font-semibold px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Modale d'édition de commentaire (PC uniquement — l'icône crayon est en
 * `hidden lg:inline-flex`, mais la modale reste fonctionnelle si jamais
 * ouverte autrement).
 *
 * - Récupère l'endpoint via `commentEditEndpoint(target)`.
 * - PATCH `{ comment }` ; le backend valide la longueur (max 2000) et
 *   refuse un vide pour une NOTE.
 * - Le parent reçoit la nouvelle valeur via `onSaved` pour patcher la
 *   liste localement avant le `router.refresh()`.
 */
function EditCommentDialog({
  target,
  field,
  onCancel,
  onSaved,
}: {
  target: Entry;
  field: "commentText" | "actionComment";
  onCancel: () => void;
  onSaved: (nextValue: string | null) => void;
}) {
  const initial = (field === "commentText" ? target.commentText : target.actionComment) ?? "";
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = commentEditEndpoint(target);
  const trimmed = value.trim();
  const isNote = target.type === "note" || target.type === "site-note";
  const valid = !!endpoint && (isNote ? trimmed.length >= 1 : true) && trimmed.length <= 2000;
  const changed = trimmed !== (initial ?? "").trim();

  async function submit() {
    if (!valid || !changed || busy || !endpoint) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: trimmed || null }),
      });
      if (res.ok) {
        onSaved(trimmed || null);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setError("Action non autorisée.");
      } else if (res.status === 404) {
        setError("Entrée introuvable.");
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Échec de l'enregistrement.");
      }
      setBusy(false);
    } catch {
      setError("Échec inattendu.");
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50"
        onClick={busy ? undefined : onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden mx-4">
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-600">
            Édition
          </div>
          <div className="text-base font-bold">Modifier le commentaire</div>
        </header>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2">
            <div className="font-mono font-semibold uppercase tracking-wider mb-0.5 text-[10px] text-slate-500">
              Entrée
            </div>
            <div className="font-semibold text-slate-900 truncate">
              {target.title}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Commentaire
              {isNote && <span className="text-rose-600"> *</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={isNote ? "Commentaire requis…" : "Vide pour effacer le commentaire"}
              className="input"
              autoFocus
            />
            <div className="flex justify-between text-[10px] mt-1">
              <span className={isNote && trimmed.length === 0 ? "text-rose-600" : "text-slate-400"}>
                {isNote ? "Obligatoire" : "Optionnel"}
              </span>
              <span className="text-slate-400 font-mono">{trimmed.length}/2000</span>
            </div>
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
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || !changed || busy}
            className="text-sm font-semibold px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}
