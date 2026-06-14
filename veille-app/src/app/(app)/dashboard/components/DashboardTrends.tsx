import { Sparkline } from "@/components/Sparkline";
import type {
  DashboardPayload,
  DashboardPeriod,
} from "@/lib/dashboard-aggregator";

type Props = {
  trends: DashboardPayload["trends"];
  period: DashboardPeriod;
};

const COLORS: Record<keyof DashboardPayload["trends"], string> = {
  activity: "#6366f1", // indigo-500
  notifications: "#a855f7", // purple-500
  visits: "#10b981", // emerald-500
  validations: "#f59e0b", // amber-500
};

export function DashboardTrends({ trends, period }: Props) {
  const keys = Object.keys(trends) as (keyof DashboardPayload["trends"])[];
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Tendances — {period} jours
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {keys.map((k) => {
          const t = trends[k];
          return (
            <div
              key={k}
              className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold leading-none text-slate-900">
                  {t.total}
                </div>
                <div className="mt-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  {t.label}
                </div>
              </div>
              <div className="shrink-0" style={{ color: COLORS[k] }}>
                <Sparkline
                  data={t.series}
                  width={120}
                  height={36}
                  ariaLabel={`${t.label} sur ${period} jours`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
