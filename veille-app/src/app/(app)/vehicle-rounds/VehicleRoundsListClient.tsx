"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";
import { vehicleTypeLabel } from "@/lib/vehicle-types";

type Round = {
  id: string;
  roundDate: string;
  status: string;
  templateName: string;
  templateSlug: string;
  immatriculation: string;
  vehicleType: string;
  vehicleLabel: string | null;
  observerName: string;
  totalCount: number;
  koCount: number;
  pendingCount: number;
};

function conformityPct(r: Round): number | null {
  const evaluated = r.totalCount - r.pendingCount;
  if (evaluated <= 0) return null;
  return Math.round(((evaluated - r.koCount) / evaluated) * 100);
}

export default function VehicleRoundsListClient({
  rounds,
}: {
  rounds: Round[];
}) {
  const { dialog, ask } = useConfirmDialog();
  const [q, setQ] = useState("");
  const [list, setList] = useState(rounds);
  const filtered = useMemo(
    () =>
      list.filter((r) =>
        matchesQuery(
          q,
          `${r.immatriculation} ${vehicleTypeLabel(r.vehicleType)} ${r.vehicleLabel ?? ""} ${r.observerName} ${r.status}`
        )
      ),
    [list, q]
  );

  async function hardDelete(r: Round) {
    const ok = await ask({
      title: `Supprimer la tournée du ${format(new Date(r.roundDate), "P", { locale: fr })} ?`,
      description: "Observations supprimées en cascade.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/vehicle-rounds/${r.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== r.id));
      toast.success("Tournée supprimée");
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
          placeholder="Rechercher (immatriculation, type, observateur, statut)…"
          totalCount={list.length}
          filteredCount={filtered.length}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const pct = conformityPct(r);
          return (
            <li key={r.id}>
              <Link
                href={`/vehicle-rounds/${r.id}`}
                className="card flex items-stretch hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden"
              >
                <span
                  className={`w-1.5 shrink-0 ${
                    r.status === "completed"
                      ? pct !== null && pct < 100
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                      : "bg-indigo-500"
                  }`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                        r.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.status === "active"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {format(new Date(r.roundDate), "P", { locale: fr })}
                    </span>
                    {pct !== null && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          pct === 100
                            ? "bg-emerald-50 text-emerald-700"
                            : pct >= 80
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {pct}% conforme
                      </span>
                    )}
                    {r.koCount > 0 && (
                      <span className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        {r.koCount} KO
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold mt-1.5 font-mono">
                    {r.immatriculation}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {vehicleTypeLabel(r.vehicleType)}
                    {r.vehicleLabel ? ` · ${r.vehicleLabel}` : ""}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Observateur : {r.observerName}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      hardDelete(r);
                    }}
                    className="text-rose-400 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                    title="Supprimer la tournée"
                  >
                    <Icon.Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="col-span-full text-center py-16 text-slate-500">
            <Icon.Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            {list.length === 0
              ? "Aucune tournée — cliquez « Nouvelle tournée »."
              : "Aucune tournée ne correspond à votre recherche."}
          </li>
        )}
      </ul>
    </>
  );
}
