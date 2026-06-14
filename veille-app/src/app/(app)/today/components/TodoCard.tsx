import Link from "next/link";
import { Icon } from "@/components/icons";
import type { ScoredItem, Urgency } from "@/lib/today/types";

type Props = { item: ScoredItem };

/**
 * Carte « À traiter » — entièrement cliquable, couleur d'urgence visible
 * d'un coup d'œil. Lien Next.js en wrapper pour la cible tactile complète.
 */
export function TodoCard({ item }: Props) {
  const tone = TONE[item.urgency];
  return (
    <Link
      href={item.cta.href}
      className={`group block rounded-xl border ${tone.border} ${tone.bg} p-3.5 lg:p-4 min-h-[80px] active:scale-[0.99] transition-transform`}
      aria-label={`${URGENCY_LABEL[item.urgency]} — ${item.title}. ${item.cta.label}.`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${tone.badge}`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone.dot}`} />
          {URGENCY_LABEL[item.urgency]}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${tone.title} line-clamp-2`}>
            {item.title}
          </p>
          {item.subtitle && (
            <p className={`mt-0.5 text-xs ${tone.subtitle} line-clamp-1`}>
              {item.subtitle}
            </p>
          )}
        </div>
        <Icon.ChevronRight
          className={`shrink-0 w-5 h-5 ${tone.chevron} group-hover:translate-x-0.5 transition-transform`}
          aria-hidden
        />
      </div>
    </Link>
  );
}

const URGENCY_LABEL: Record<Urgency, string> = {
  late: "En retard",
  today: "Aujourd'hui",
  soon: "Bientôt",
  later: "À surveiller",
  info: "Info",
};

const TONE: Record<
  Urgency,
  {
    bg: string;
    border: string;
    title: string;
    subtitle: string;
    badge: string;
    dot: string;
    chevron: string;
  }
> = {
  late: {
    bg: "bg-red-50 hover:bg-red-100",
    border: "border-red-200",
    title: "text-red-900",
    subtitle: "text-red-700",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-600",
    chevron: "text-red-400",
  },
  today: {
    bg: "bg-orange-50 hover:bg-orange-100",
    border: "border-orange-200",
    title: "text-orange-900",
    subtitle: "text-orange-700",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
    chevron: "text-orange-400",
  },
  soon: {
    bg: "bg-amber-50 hover:bg-amber-100",
    border: "border-amber-200",
    title: "text-amber-900",
    subtitle: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    chevron: "text-amber-400",
  },
  later: {
    bg: "bg-slate-50 hover:bg-slate-100",
    border: "border-slate-200",
    title: "text-slate-900",
    subtitle: "text-slate-600",
    badge: "bg-slate-200 text-slate-700",
    dot: "bg-slate-500",
    chevron: "text-slate-400",
  },
  info: {
    bg: "bg-slate-50 hover:bg-slate-100",
    border: "border-slate-200",
    title: "text-slate-900",
    subtitle: "text-slate-600",
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    chevron: "text-slate-400",
  },
};
