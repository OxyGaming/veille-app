"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";

type Item = {
  kind: "visit" | "vehicle-round";
  id: string;
  date: string;
  status: string;
  templateName: string;
  templateSlug: string;
  targetLabel: string;
  targetSubtitle: string | null;
  observerName: string;
  /** NC encore ouvertes (`redressedDate IS NULL`). */
  ncOpen: number;
  /** NC déjà redressées (action validée → `redressedDate` posée). */
  ncRedressed: number;
  href: string;
  reportUrl: string;
};

/**
 * Code couleur par type de visite/tournée — sert à la barre latérale de la
 * carte et au pill à côté du nom du modèle.
 */
const TEMPLATE_THEME: Record<
  string,
  { bar: string; pill: string; short: string }
> = {
  "trimestrielle-incendie": {
    bar: "bg-orange-500",
    pill: "bg-orange-50 text-orange-700 border-orange-200",
    short: "Trimestrielle",
  },
  "planifiee-eic-ra": {
    bar: "bg-indigo-500",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
    short: "Planifiée",
  },
  "tournee-vs": {
    bar: "bg-sky-500",
    pill: "bg-sky-50 text-sky-700 border-sky-200",
    short: "Tournée VS",
  },
};
const DEFAULT_THEME = {
  bar: "bg-slate-300",
  pill: "bg-slate-50 text-slate-600 border-slate-200",
  short: "Autre",
};

export default function VisitsListClient({
  items,
  userRole = "USER",
}: {
  items: Item[];
  userRole?: "USER" | "EDITOR" | "ADMIN";
}) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const canReopen = userRole === "ADMIN" || userRole === "EDITOR";
  const [q, setQ] = useState("");
  const [list, setList] = useState(items);
  // Édition inline de la date de réalisation. La clé est `${kind}-${id}` car
  // une visite et une tournée pourraient théoriquement partager un id.
  const [editingDate, setEditingDate] = useState<string | null>(null);
  // Une sortie par Échap doit annuler sans déclencher la sauvegarde du onBlur.
  const cancelNextBlur = useRef(false);
  const filteredLive = useMemo(
    () =>
      list.filter((it) =>
        matchesQuery(
          q,
          `${it.targetLabel} ${it.targetSubtitle ?? ""} ${it.templateName} ${it.observerName} ${it.status}`
        )
      ),
    [list, q]
  );

  function deleteEndpoint(it: Item, mode: "soft" | "hard"): string {
    return it.kind === "visit"
      ? `/api/visits/${it.id}?mode=${mode}`
      : `/api/vehicle-rounds/${it.id}`;
  }
  function patchEndpoint(it: Item): string {
    return it.kind === "visit"
      ? `/api/visits/${it.id}`
      : `/api/vehicle-rounds/${it.id}`;
  }

  /** Enregistre une nouvelle date de réalisation (`value` = AAAA-MM-JJ). */
  async function saveDate(it: Item, value: string) {
    setEditingDate(null);
    const current = it.date.slice(0, 10);
    if (!value || value === current) return;
    // Le serveur attend `visitDate` (visites) ou `roundDate` (tournées).
    const field = it.kind === "visit" ? "visitDate" : "roundDate";
    const res = await fetch(patchEndpoint(it), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Modification de la date refusée");
      return;
    }
    // Midi pour rester sur le même jour calendaire à l'affichage (cf. API).
    const iso = new Date(`${value}T12:00:00`).toISOString();
    setList((arr) =>
      arr.map((x) =>
        x.kind === it.kind && x.id === it.id ? { ...x, date: iso } : x
      )
    );
    toast.success("Date de réalisation mise à jour");
  }

  async function archive(it: Item) {
    if (it.kind === "vehicle-round") {
      toast.error("Archivage non disponible pour les tournées VS.");
      return;
    }
    const ok = await ask({
      title: `Archiver la visite « ${it.targetLabel} » ?`,
      description:
        "Elle restera consultable depuis l'historique mais n'apparaîtra plus dans la liste courante.",
      confirmLabel: "Archiver",
    });
    if (!ok) return;
    const res = await fetch(deleteEndpoint(it, "soft"), { method: "DELETE" });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== it.id));
      toast.success("Visite archivée");
    } else {
      toast.error("Impossible d'archiver la visite");
    }
  }

  async function reopen(it: Item) {
    const label =
      it.kind === "visit"
        ? `la visite « ${it.targetLabel} »`
        : `la tournée VS « ${it.targetLabel} »`;
    const ok = await ask({
      title: `Rouvrir ${label} ?`,
      description:
        "L'état repassera en ACTIVE et l'édition redeviendra possible. L'opération est tracée dans le journal d'audit.",
      confirmLabel: "Rouvrir et éditer",
    });
    if (!ok) return;
    const res = await fetch(patchEndpoint(it), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Réouverture refusée");
      return;
    }
    toast.success(it.kind === "visit" ? "Visite rouverte" : "Tournée rouverte");
    router.push(it.href);
  }

  async function hardDelete(it: Item) {
    const label =
      it.kind === "visit"
        ? `la visite « ${it.targetLabel} »`
        : `la tournée VS « ${it.targetLabel} »`;
    const ok = await ask({
      title: `Supprimer définitivement ${label} ?`,
      description:
        it.kind === "visit"
          ? "Observations, NCs et participants seront supprimés en cascade.\nLes actions générées par les NCs seront marquées OBSOLETE."
          : "Observations et NCs liées seront supprimées en cascade.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(deleteEndpoint(it, "hard"), { method: "DELETE" });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== it.id));
      toast.success(
        it.kind === "visit" ? "Visite supprimée" : "Tournée supprimée"
      );
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Suppression refusée");
    }
  }

  return (
    <>
      {dialog}
      <div className="mb-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher (site, modèle, observateur, statut)…"
          totalCount={list.length}
          filteredCount={filteredLive.length}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filteredLive.map((it) => {
          const theme = TEMPLATE_THEME[it.templateSlug] ?? DEFAULT_THEME;
          const canArchive = it.kind === "visit";
          return (
            <li key={`${it.kind}-${it.id}`}>
              <Link
                href={it.href}
                className="card flex items-stretch hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden"
              >
                <span
                  className={`w-1.5 shrink-0 ${theme.bar}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                        it.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : it.status === "active"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {it.status.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${theme.pill}`}
                      title={it.templateName}
                    >
                      {theme.short}
                    </span>
                    {editingDate === `${it.kind}-${it.id}` ? (
                      <input
                        type="date"
                        autoFocus
                        defaultValue={it.date.slice(0, 10)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // Laisse onBlur sauvegarder une seule fois.
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelNextBlur.current = true;
                            setEditingDate(null);
                          }
                        }}
                        onBlur={(e) => {
                          if (cancelNextBlur.current) {
                            cancelNextBlur.current = false;
                            return;
                          }
                          saveDate(it, e.currentTarget.value);
                        }}
                        className="text-xs font-mono border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span
                        className={`text-xs text-slate-500 font-mono rounded px-1 -mx-1 ${
                          canReopen
                            ? "cursor-text hover:bg-slate-100 hover:text-slate-700"
                            : ""
                        }`}
                        title={
                          canReopen
                            ? "Double-cliquez pour corriger la date de réalisation"
                            : undefined
                        }
                        onClick={(e) => {
                          // La date est dans le <Link> : sans ça, le premier clic
                          // du double-clic ouvrirait la fiche avant l'édition.
                          if (!canReopen) return;
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDoubleClick={(e) => {
                          if (!canReopen) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingDate(`${it.kind}-${it.id}`);
                        }}
                      >
                        {format(new Date(it.date), "P", { locale: fr })}
                      </span>
                    )}
                    {it.ncOpen > 0 && (
                      <span
                        className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded"
                        title={`${it.ncOpen} non-conformité${it.ncOpen > 1 ? "s" : ""} à redresser`}
                      >
                        {it.ncOpen} NC
                      </span>
                    )}
                    {it.ncRedressed > 0 && (
                      <span
                        className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        title={`${it.ncRedressed} non-conformité${it.ncRedressed > 1 ? "s" : ""} redressée${it.ncRedressed > 1 ? "s" : ""}`}
                      >
                        <Icon.Check className="w-3 h-3" />
                        {it.ncRedressed} redressée{it.ncRedressed > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-sm font-bold mt-1.5 ${it.kind === "vehicle-round" ? "font-mono" : ""}`}
                  >
                    {it.targetLabel}
                  </div>
                  {it.targetSubtitle && (
                    <div
                      className={`text-[11px] text-slate-500 ${it.kind === "vehicle-round" ? "" : "font-mono"}`}
                    >
                      {it.targetSubtitle}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">
                    {it.templateName}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Observateur : {it.observerName}
                  </div>
                  {it.status === "completed" && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(it.reportUrl);
                        }}
                        className="flex-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
                      >
                        <Icon.FileText className="w-3.5 h-3.5" />
                        Voir le rapport
                      </button>
                      {canReopen && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            reopen(it);
                          }}
                          title={
                            it.kind === "visit"
                              ? "Rouvrir la visite pour la rééditer"
                              : "Rouvrir la tournée pour la rééditer"
                          }
                          aria-label="Rouvrir"
                          className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-100 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 inline-flex items-center justify-center gap-1.5"
                        >
                          <Icon.FileEdit className="w-3.5 h-3.5" />
                          Rouvrir
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center gap-1 pr-2">
                  {canArchive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        archive(it);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-1.5 py-0.5 rounded"
                      title="Archiver (consultable plus tard)"
                    >
                      Archiver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      hardDelete(it);
                    }}
                    className="text-rose-400 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                    title="Supprimer définitivement (cascade observations, NCs)"
                  >
                    <Icon.Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            </li>
          );
        })}
        {filteredLive.length === 0 && (
          <li className="col-span-full text-center py-16 text-slate-500">
            <Icon.ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {list.length === 0
              ? "Aucune visite ni tournée — utilisez les boutons en haut pour démarrer."
              : "Aucun résultat ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
