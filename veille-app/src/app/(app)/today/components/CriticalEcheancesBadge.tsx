import Link from "next/link";
import { Icon } from "@/components/icons";

type Props = {
  count: number;
};

/**
 * Indicateur transverse « X échéances critiques » (Sprint 4 C7 / D13).
 *
 * Affiché en tête du dashboard EDITOR, juste sous DiagnosticBanner.
 * Cliquable → `/echeances?urgency=critical`.
 *
 * Visuel :
 *  - count > 0 → fond rouge clair, texte rouge, chevron, label « X échéances critiques »
 *  - count = 0 → fond neutre, texte slate, label « Aucune échéance critique »
 *    (rassurant ; reste cliquable pour permettre la navigation Hub).
 */
export function CriticalEcheancesBadge({ count }: Props) {
  const hasCritical = count > 0;
  const label = hasCritical
    ? `${count} échéance${count > 1 ? "s" : ""} critique${count > 1 ? "s" : ""}`
    : "Aucune échéance critique";

  return (
    <div className="px-4 lg:px-8 mt-4">
      <Link
        href="/echeances?urgency=critical"
        aria-label={
          hasCritical
            ? `${count} échéances critiques — voir le Hub`
            : "Aucune échéance critique — voir le Hub"
        }
        className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
          hasCritical
            ? "border-red-200 bg-red-50 hover:bg-red-100/70"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <span
          className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${
            hasCritical
              ? "bg-red-100 text-red-600"
              : "bg-slate-100 text-slate-500"
          }`}
          aria-hidden
        >
          <Icon.AlertTriangle className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              hasCritical ? "text-red-700" : "text-slate-700"
            }`}
          >
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {hasCritical
              ? "À traiter en priorité — ouvrir le Hub Échéances"
              : "Tout est sous contrôle — voir le Hub Échéances"}
          </p>
        </div>
        <Icon.ChevronRight
          className={`shrink-0 w-4 h-4 ${
            hasCritical ? "text-red-500" : "text-slate-400"
          }`}
          aria-hidden
        />
      </Link>
    </div>
  );
}
