type Tone = "neutral" | "warn" | "danger" | "ok";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  /** Lien optionnel pour rendre la carte cliquable (drill-down). */
  href?: string;
};

/**
 * Carte KPI minimaliste — réutilisable EDITOR, ADMIN, stats.
 * Pas de logique métier : reçoit juste label + value + tone.
 */
export function KpiCard({ label, value, hint, tone = "neutral", href }: Props) {
  const t = TONE[tone];
  const content = (
    <>
      <div
        className={`text-2xl lg:text-3xl font-bold tabular-nums ${t.value}`}
      >
        {value}
      </div>
      <div className={`mt-0.5 text-[11px] font-medium ${t.label}`}>{label}</div>
      {hint && (
        <div className={`mt-0.5 text-[10px] ${t.hint}`}>{hint}</div>
      )}
    </>
  );
  const className = `block rounded-xl border ${t.border} ${t.bg} p-3 lg:p-4 min-h-[80px]`;
  if (href) {
    return (
      <a href={href} className={`${className} hover:brightness-95 transition`}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

const TONE: Record<
  Tone,
  { bg: string; border: string; value: string; label: string; hint: string }
> = {
  neutral: {
    bg: "bg-white",
    border: "border-slate-200",
    value: "text-slate-900",
    label: "text-slate-600",
    hint: "text-slate-500",
  },
  ok: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    value: "text-emerald-700",
    label: "text-emerald-800",
    hint: "text-emerald-700",
  },
  warn: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    value: "text-amber-700",
    label: "text-amber-800",
    hint: "text-amber-700",
  },
  danger: {
    bg: "bg-red-50",
    border: "border-red-200",
    value: "text-red-700",
    label: "text-red-800",
    hint: "text-red-700",
  },
};
