import Link from "next/link";
import { Icon } from "@/components/icons";
import type { EcheanceItem, EcheanceKind } from "@/lib/echeances/types";

type Props = {
  item: EcheanceItem;
};

const KIND_LABEL: Record<EcheanceKind, string> = {
  VISIT_QUARTERLY: "Trimestrielle",
  VISIT_PLANNED: "Planifiée",
  EQUIPMENT_EXPIRING: "Équipement",
  ACTION_OVERDUE: "Action",
};

const KIND_ICON: Record<EcheanceKind, typeof Icon.Calendar> = {
  VISIT_QUARTERLY: Icon.Calendar,
  VISIT_PLANNED: Icon.Calendar,
  EQUIPMENT_EXPIRING: Icon.AlertTriangle,
  ACTION_OVERDUE: Icon.Clipboard,
};

function formatDueLabel(daysToDue: number | null): string {
  if (daysToDue === null) return "jamais effectué";
  if (daysToDue === 0) return "aujourd'hui";
  if (daysToDue === -1) return "hier";
  if (daysToDue === 1) return "demain";
  if (daysToDue < 0) return `en retard de ${-daysToDue} j`;
  return `dans ${daysToDue} j`;
}

/** Ligne d'une échéance — icône kind + titre + meta + CTA. */
export function EcheanceRow({ item }: Props) {
  const Ico = KIND_ICON[item.kind];
  const kindLabel = KIND_LABEL[item.kind];
  const dueLabel = formatDueLabel(item.daysToDue);
  const metaParts = [kindLabel, dueLabel];
  if (item.subtitle) metaParts.unshift(item.subtitle);

  return (
    <li>
      <Link
        href={item.cta.href}
        className="flex items-start gap-3 px-3 py-3 hover:bg-slate-50 transition-colors min-w-0"
      >
        <span
          className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg grid place-items-center ${
            item.isCritical
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 text-slate-500"
          }`}
          aria-hidden
        >
          <Ico className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {item.title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 truncate">
            {metaParts.join(" · ")}
          </p>
        </div>
        {item.isCritical && (
          <span className="shrink-0 mt-0.5 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
            Critique
          </span>
        )}
        <span className="shrink-0 text-xs text-indigo-600 font-medium pt-0.5">
          {item.cta.label}
        </span>
        <Icon.ChevronRight
          className="shrink-0 w-4 h-4 text-slate-400 mt-1"
          aria-hidden
        />
      </Link>
    </li>
  );
}
