"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { Icon } from "@/components/icons";
import SearchInput, { matchesQuery } from "@/components/SearchInput";
import { vehicleTypeLabel } from "@/lib/vehicle-types";

type Vehicle = {
  id: string;
  immatriculation: string;
  type: string;
  label: string | null;
  teamName: string | null;
  lastRoundAt: string | null;
};

const EXPECTED_FREQ_DAYS = 180;

function freshnessTone(lastRoundAt: string | null): {
  tone: "fresh" | "soon" | "due" | "overdue" | "never";
  label: string;
  cls: string;
} {
  if (!lastRoundAt) {
    return {
      tone: "never",
      label: "Jamais",
      cls: "bg-slate-100 text-slate-600",
    };
  }
  const days = differenceInDays(new Date(), new Date(lastRoundAt));
  if (days >= EXPECTED_FREQ_DAYS) {
    return {
      tone: "overdue",
      label: `Retard · ${days - EXPECTED_FREQ_DAYS} j`,
      cls: "bg-rose-50 text-rose-700",
    };
  }
  if (days >= EXPECTED_FREQ_DAYS - 30) {
    return {
      tone: "due",
      label: `${EXPECTED_FREQ_DAYS - days} j restants`,
      cls: "bg-amber-50 text-amber-700",
    };
  }
  return {
    tone: "fresh",
    label: `${days} j`,
    cls: "bg-emerald-50 text-emerald-700",
  };
}

export default function NewVehicleRoundClient({
  vehicles,
}: {
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const filtered = useMemo(
    () =>
      vehicles.filter((v) =>
        matchesQuery(
          q,
          `${v.immatriculation} ${vehicleTypeLabel(v.type)} ${v.label ?? ""} ${v.teamName ?? ""}`
        )
      ),
    [vehicles, q]
  );

  async function start(v: Vehicle) {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/vehicle-rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: v.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Impossible de démarrer la tournée");
      setSubmitting(false);
      return;
    }
    const round = await res.json();
    router.push(`/vehicle-rounds/${round.id}`);
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link
          href="/vehicle-rounds"
          className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
        >
          <Icon.ChevronLeft className="w-3 h-3" /> Tournées
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold mt-2">
          Nouvelle tournée VS
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Choisissez le véhicule. La grille s'adaptera à son type
          (basique, EIS, DPx/ADPx/Astreinte).
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Aucun véhicule actif dans votre périmètre.{" "}
          <Link
            href="/admin/vehicles"
            className="underline font-semibold"
          >
            Ajoutez-en un dans le back-office
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="mb-3">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Rechercher (immat, type, libellé)…"
              totalCount={vehicles.length}
              filteredCount={filtered.length}
            />
          </div>
          <ul className="grid gap-2">
            {filtered.map((v) => {
              const fresh = freshnessTone(v.lastRoundAt);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => start(v)}
                    className="w-full text-left card hover:border-indigo-300 hover:shadow-md transition-all px-4 py-3 disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 grid place-items-center shrink-0">
                        <Icon.Truck className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-mono font-bold text-base">
                            {v.immatriculation}
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono font-medium text-slate-700">
                            {vehicleTypeLabel(v.type)}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${fresh.cls}`}
                          >
                            {fresh.label}
                          </span>
                        </div>
                        {v.label && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {v.label}
                          </div>
                        )}
                        {v.teamName && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Équipe : {v.teamName}
                          </div>
                        )}
                      </div>
                      <Icon.ChevronRight className="w-4 h-4 text-slate-400 self-center" />
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="text-center py-8 text-slate-500 text-sm">
                Aucun véhicule ne correspond à votre recherche.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
