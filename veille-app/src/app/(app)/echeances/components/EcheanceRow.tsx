import Link from "next/link";
import { Icon } from "@/components/icons";
import type { EcheanceItem, EcheanceKind } from "@/lib/echeances/types";
import { PostponeButton } from "./PostponeButton";

type Props = {
  item: EcheanceItem;
};

/** Types d'échéance que l'utilisateur peut reporter inline. */
const POSTPONABLE_KINDS: ReadonlySet<EcheanceKind> = new Set([
  "ACTION_OVERDUE",
  "EQUIPMENT_EXPIRING",
]);

const KIND_LABEL: Record<EcheanceKind, string> = {
  VISIT_QUARTERLY: "Trimestrielle",
  VISIT_PLANNED: "Planifiée",
  VEHICLE_ROUND: "Tournée VS",
  EQUIPMENT_EXPIRING: "Équipement",
  ACTION_OVERDUE: "Action",
};

const KIND_ICON: Record<EcheanceKind, typeof Icon.Calendar> = {
  VISIT_QUARTERLY: Icon.Calendar,
  VISIT_PLANNED: Icon.Calendar,
  VEHICLE_ROUND: Icon.Truck,
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

  const canPostpone = POSTPONABLE_KINDS.has(item.kind);
  return (
    <li className="flex items-start gap-3 px-3 py-3 hover:bg-slate-50 transition-colors min-w-0">
      <Link
        href={item.cta.href}
        className="flex items-start gap-3 flex-1 min-w-0"
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
            {item.occurrenceCount && item.occurrenceCount > 1 && (
              <span
                className="ml-1.5 align-middle text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                title={`${item.occurrenceCount} occurrences regroupées`}
              >
                ×{item.occurrenceCount}
              </span>
            )}
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
      </Link>
      {canPostpone && <PostponeButton item={item} />}
      <Link
        href={item.cta.href}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 font-medium pt-1"
      >
        {item.cta.label}
        <Icon.ChevronRight className="w-4 h-4 text-slate-400" aria-hidden />
      </Link>
    </li>
  );
}
