import Link from "next/link";
import type { CurrentWork } from "@/lib/today/types";
import { Icon } from "@/components/icons";

type Props = { current: CurrentWork | null };

/**
 * Carte « En cours » — affichée en haut de l'écran USER quand une veille
 * ou une visite est en draft/active. Permet la reprise instantanée.
 *
 * Server component pur. Le lien est navigation Next.js standard.
 */
export function CurrentWorkCard({ current }: Props) {
  if (!current) return null;

  const startedDate = new Date(current.startedAt);
  const startedLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(startedDate);

  return (
    <section className="px-4 lg:px-8 mt-3">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 lg:p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex h-6 items-center rounded-md bg-indigo-600 px-2 text-[10px] font-mono uppercase tracking-wider text-white">
            En cours
          </span>
          {current.isStale && (
            <span
              className="inline-flex h-6 items-center rounded-md bg-amber-100 px-2 text-[10px] font-mono uppercase tracking-wider text-amber-800"
              title="Brouillon non modifié depuis plus de 7 jours"
            >
              Brouillon ancien
            </span>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base lg:text-lg font-semibold text-slate-900 truncate">
              {current.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-700 truncate">
              {current.subtitle}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Démarrée le {startedLabel}
            </p>
          </div>
          <Link
            href={current.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 min-h-[44px]"
          >
            Reprendre
            <Icon.ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
