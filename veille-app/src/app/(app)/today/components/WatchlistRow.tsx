import Link from "next/link";
import { Icon } from "@/components/icons";
import type { WatchlistItem } from "@/lib/today/types";

type Props = {
  item: WatchlistItem;
  /** Texte décrivant la fraîcheur (« 38 jours sans veille », « jamais visité »). */
  freshnessLabel: string;
  /** Href de la fiche détail (cliquable sur le nom). */
  detailHref: string;
};

/**
 * Ligne de watchlist générique — fonctionne pour agent comme site.
 * - Nom cliquable vers la fiche détail.
 * - Bouton CTA d'action rapide (Veiller / Visiter) à droite.
 * - Badges contextuels en-dessous (actions ouvertes, équipements alertés).
 */
export function WatchlistRow({ item, freshnessLabel, detailHref }: Props) {
  const dot = DOT[item.level];
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 lg:p-4 flex items-start gap-3">
      <span
        className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${dot}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <Link
          href={detailHref}
          className="block text-sm font-semibold text-slate-900 hover:underline truncate"
        >
          {item.name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-600">{freshnessLabel}</p>
        {hasBadges(item) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.badges?.openActions ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                {item.badges.openActions} action
                {item.badges.openActions > 1 ? "s" : ""}
              </span>
            ) : null}
            {item.badges?.equipmentAlerts ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                {item.badges.equipmentAlerts} équipement
                {item.badges.equipmentAlerts > 1 ? "s" : ""} en alerte
              </span>
            ) : null}
          </div>
        )}
      </div>
      <Link
        href={item.cta.href}
        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 min-h-[36px]"
      >
        {item.cta.label}
        <Icon.ChevronRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </li>
  );
}

function hasBadges(item: WatchlistItem): boolean {
  if (!item.badges) return false;
  return Boolean(item.badges.openActions || item.badges.equipmentAlerts);
}

const DOT: Record<WatchlistItem["level"], string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-amber-400",
};
