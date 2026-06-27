import type { DashboardKpis } from "@/lib/dashboard-aggregator";

type Props = {
  kpis: DashboardKpis;
};

const KPI_DEFS: {
  key: keyof DashboardKpis;
  label: string;
  toneFn: (v: number, kpis: DashboardKpis) => "danger" | "warn" | "neutral";
  /** Sous-info optionnelle (ex. « dont N critiques »). */
  hintFn?: (kpis: DashboardKpis) => string | undefined;
}[] = [
  {
    key: "criticalCount",
    label: "Échéances critiques",
    toneFn: (v) => (v > 0 ? "danger" : "neutral"),
  },
  {
    key: "openActions",
    label: "Actions ouvertes",
    toneFn: (v) => (v > 50 ? "warn" : "neutral"),
  },
  {
    key: "lateActions",
    label: "Actions en retard",
    // Rouge seulement si des retards CRITIQUES (> 7 j) ; sinon ambre.
    toneFn: (v, k) =>
      k.lateActionsCritical > 0 ? "danger" : v > 0 ? "warn" : "neutral",
    hintFn: (k) =>
      k.lateActionsCritical > 0
        ? `dont ${k.lateActionsCritical} critique${k.lateActionsCritical > 1 ? "s" : ""} (> 7 j)`
        : undefined,
  },
  {
    key: "sitesWithoutQuarterly",
    label: "Sites sans visite trim",
    toneFn: (v) => (v > 0 ? "warn" : "neutral"),
  },
  {
    key: "sitesWithoutPlanned",
    label: "Sites sans visite plan",
    toneFn: (v) => (v > 0 ? "warn" : "neutral"),
  },
  {
    key: "vehiclesOverdueRound",
    label: "Véhicules sans tournée",
    toneFn: (v) => (v > 0 ? "warn" : "neutral"),
  },
  {
    key: "expiredEquipments",
    label: "Équipements expirés",
    toneFn: (v) => (v > 0 ? "danger" : "neutral"),
  },
];

const TONE_CLS: Record<"danger" | "warn" | "neutral", string> = {
  danger: "bg-red-50 border-red-200 text-red-700",
  warn: "bg-amber-50 border-amber-200 text-amber-700",
  neutral: "bg-white border-slate-200 text-slate-900",
};

export function DashboardKpiGrid({ kpis }: Props) {
  return (
    <section className="px-4 lg:px-8 mt-4">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Indicateurs clés
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {KPI_DEFS.map(({ key, label, toneFn, hintFn }) => {
          const value = kpis[key];
          const tone = toneFn(value, kpis);
          const hint = hintFn?.(kpis);
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 ${TONE_CLS[tone]}`}
            >
              <div className="text-2xl font-bold leading-none">{value}</div>
              <div className="mt-1.5 text-[11px] font-mono uppercase tracking-wider opacity-80">
                {label}
              </div>
              {hint && (
                <div className="mt-0.5 text-[10px] opacity-70">{hint}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
