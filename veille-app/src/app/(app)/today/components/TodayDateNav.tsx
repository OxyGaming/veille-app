"use client";

import Link from "next/link";
import { addDaysToDateStr } from "@/lib/today/date-nav";
import { Icon } from "@/components/icons";

/**
 * Navigation par jour de l'écran Aujourd'hui — jour précédent / aujourd'hui /
 * jour suivant. Utilise `<Link>` (navigation client Next.js, pas de
 * rechargement complet) ; `?date=` pilote le Server Component parent.
 */
export function TodayDateNav({
  viewedDate,
  isToday,
}: {
  viewedDate: string;
  isToday: boolean;
}) {
  const prev = addDaysToDateStr(viewedDate, -1);
  const next = addDaysToDateStr(viewedDate, 1);

  return (
    <nav
      aria-label="Navigation par jour"
      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      <Link
        href={`/today?date=${prev}`}
        aria-label="Jour précédent"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <Icon.ChevronLeft className="w-4 h-4" />
      </Link>
      <Link
        href="/today"
        aria-current={isToday ? "date" : undefined}
        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
          isToday
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Aujourd&apos;hui
      </Link>
      <Link
        href={`/today?date=${next}`}
        aria-label="Jour suivant"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <Icon.ChevronRight className="w-4 h-4" />
      </Link>
    </nav>
  );
}
