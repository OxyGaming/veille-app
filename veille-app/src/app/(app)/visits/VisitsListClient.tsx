"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";

type Visit = {
  id: string;
  visitDate: string;
  status: string;
  templateName: string;
  templateSlug: string;
  siteName: string;
  siteCode: string | null;
  observerName: string;
  ncCount: number;
};

/**
 * Code couleur par type de visite — sert à la barre latérale de la carte et
 * au pill à côté du nom du modèle. Reproduit la sémantique "incendie =
 * orange/rose", "planifiée = indigo".
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
};
const DEFAULT_THEME = {
  bar: "bg-slate-300",
  pill: "bg-slate-50 text-slate-600 border-slate-200",
  short: "Autre",
};

export default function VisitsListClient({ visits }: { visits: Visit[] }) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [q, setQ] = useState("");
  const [list, setList] = useState(visits);
  const filteredLive = useMemo(
    () =>
      list.filter((v) =>
        matchesQuery(
          q,
          `${v.siteName} ${v.siteCode ?? ""} ${v.templateName} ${v.observerName} ${v.status}`
        )
      ),
    [list, q]
  );

  async function archive(v: Visit) {
    const ok = await ask({
      title: `Archiver la visite « ${v.siteName} » ?`,
      description:
        "Elle restera consultable depuis l'historique mais n'apparaîtra plus dans la liste courante.",
      confirmLabel: "Archiver",
    });
    if (!ok) return;
    const res = await fetch(`/api/visits/${v.id}?mode=soft`, {
      method: "DELETE",
    });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== v.id));
      toast.success("Visite archivée");
    } else {
      toast.error("Impossible d'archiver la visite");
    }
  }

  async function hardDelete(v: Visit) {
    const ok = await ask({
      title: `Supprimer définitivement la visite « ${v.siteName} » ?`,
      description:
        "Observations, NCs et participants seront supprimés en cascade.\nLes actions générées par les NCs seront marquées OBSOLETE.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/visits/${v.id}?mode=hard`, {
      method: "DELETE",
    });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== v.id));
      toast.success("Visite supprimée");
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
        {filteredLive.map((v) => {
          const theme = TEMPLATE_THEME[v.templateSlug] ?? DEFAULT_THEME;
          return (
            <li key={v.id}>
              <Link
                href={`/visits/${v.id}`}
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
                        v.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : v.status === "active"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {v.status.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${theme.pill}`}
                      title={v.templateName}
                    >
                      {theme.short}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {format(new Date(v.visitDate), "P", { locale: fr })}
                    </span>
                    {v.ncCount > 0 && (
                      <span className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        {v.ncCount} NC
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold mt-1.5">{v.siteName}</div>
                  {v.siteCode && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {v.siteCode}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">
                    {v.templateName}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Observateur : {v.observerName}
                  </div>
                  {v.status === "completed" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/visits/${v.id}/report`);
                      }}
                      className="mt-2 w-full text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2 flex items-center justify-center gap-1.5"
                    >
                      <Icon.FileText className="w-3.5 h-3.5" />
                      Voir le rapport
                    </button>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      archive(v);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-1.5 py-0.5 rounded"
                    title="Archiver (consultable plus tard)"
                  >
                    Archiver
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      hardDelete(v);
                    }}
                    className="text-rose-400 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                    title="Supprimer définitivement (cascade observations, NCs, photos)"
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
            {visits.length === 0
              ? "Aucune visite — cliquez « Nouvelle visite »."
              : "Aucune visite ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
