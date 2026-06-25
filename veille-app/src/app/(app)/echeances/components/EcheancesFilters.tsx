"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import type { EcheanceKind, EcheanceUrgency } from "@/lib/echeances/types";

type Props = {
  teamsAvailable: { id: string; name: string }[];
  sitesAvailable: { id: string; name: string }[];
};

const URGENCY_OPTIONS: { value: EcheanceUrgency | "critical"; label: string }[] =
  [
    { value: "critical", label: "Critiques" },
    { value: "late", label: "En retard" },
    { value: "today", label: "Aujourd'hui" },
    { value: "soon", label: "< 7 j" },
    { value: "later", label: "< 30 j" },
    { value: "future", label: "Plus tard" },
  ];

const TYPE_OPTIONS: { value: EcheanceKind; label: string }[] = [
  { value: "VISIT_QUARTERLY", label: "Trimestrielle" },
  { value: "VISIT_PLANNED", label: "Planifiée" },
  { value: "VEHICLE_ROUND", label: "Tournée VS" },
  { value: "EQUIPMENT_EXPIRING", label: "Équipement" },
  { value: "ACTION_OVERDUE", label: "Action" },
];

const FILTER_KEYS = ["urgency", "type", "siteId", "teamId"] as const;

function readCsv(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EcheancesFilters({ teamsAvailable, sitesAvailable }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urgencySelected = useMemo(
    () => new Set(readCsv(params, "urgency")),
    [params],
  );
  const typeSelected = useMemo(
    () => new Set(readCsv(params, "type")),
    [params],
  );
  const siteSelected = params.get("siteId") ?? "";
  const teamSelected = params.get("teamId") ?? "";

  const hasFilters = FILTER_KEYS.some((k) => Boolean(params.get(k)));

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/echeances?${qs}` : "/echeances", { scroll: false });
    });
  }

  function toggleCsv(key: "urgency" | "type", value: string) {
    const next = new URLSearchParams(params.toString());
    const current = readCsv(next, key);
    const idx = current.indexOf(value);
    if (idx === -1) current.push(value);
    else current.splice(idx, 1);
    if (current.length) next.set(key, current.join(","));
    else next.delete(key);
    pushParams(next);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  }

  function reset() {
    pushParams(new URLSearchParams());
  }

  return (
    <section
      className="px-4 lg:px-8 mt-4"
      aria-label="Filtres"
      data-pending={pending ? "1" : undefined}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        {/* Urgence — chips multi-sélection */}
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Urgence
          </p>
          <div className="flex flex-wrap gap-1.5">
            {URGENCY_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={urgencySelected.has(opt.value)}
                onClick={() => toggleCsv("urgency", opt.value)}
                tone={opt.value === "critical" ? "danger" : "neutral"}
              />
            ))}
          </div>
        </div>

        {/* Type — chips multi-sélection */}
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={typeSelected.has(opt.value)}
                onClick={() => toggleCsv("type", opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Site + Équipe — selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Site
            </span>
            <select
              value={siteSelected}
              onChange={(e) => setParam("siteId", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les sites</option>
              {sitesAvailable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Équipe
            </span>
            <select
              value={teamSelected}
              onChange={(e) => setParam("teamId", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les équipes</option>
              {teamsAvailable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Reset — visible uniquement si au moins un filtre actif */}
        {hasFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1 transition-colors"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({
  label,
  active,
  onClick,
  tone = "neutral",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  const base =
    "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap";
  const activeCls =
    tone === "danger"
      ? "bg-red-50 border-red-300 text-red-700"
      : "bg-indigo-50 border-indigo-300 text-indigo-700";
  const idleCls =
    "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${active ? activeCls : idleCls}`}
    >
      {label}
    </button>
  );
}
