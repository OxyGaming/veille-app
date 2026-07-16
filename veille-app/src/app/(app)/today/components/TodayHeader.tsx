import type { TodayPayload } from "@/lib/today/types";
import { formatFrenchDayLabel } from "@/lib/today/date-nav";
import { TodayDateNav } from "./TodayDateNav";

type Props = { payload: TodayPayload };

/**
 * En-tête de l'écran Aujourd'hui — varie selon le rôle.
 * Server component (la navigation par jour est un petit Client Component
 * imbriqué, `TodayDateNav`). La date affichée est celle CONSULTÉE
 * (`payload.viewedDate`), pas forcément le jour réel — l'emoji de salutation
 * USER reste lui basé sur l'heure réelle (`payload.now`).
 */
export function TodayHeader({ payload }: Props) {
  const dateLabel = formatFrenchDayLabel(payload.viewedDate);
  const nav = (
    <TodayDateNav viewedDate={payload.viewedDate} isToday={payload.isToday} />
  );

  if (payload.role === "USER") {
    const now = new Date(payload.now);
    const firstName = payload.greeting.name.split(" ")[0] || payload.greeting.name;
    const emoji = parisHourIsDaylight(now) ? "☀️" : "🌙";
    return (
      <header className="px-4 lg:px-8 pt-5 lg:pt-8 pb-2">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
          Bonjour {firstName} <span aria-hidden>{emoji}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dateLabel}
          {payload.greeting.teamName ? ` · ${payload.greeting.teamName}` : ""}
        </p>
        {nav}
      </header>
    );
  }

  if (payload.role === "EDITOR") {
    const { teamsCount, sitesCount, agentsCount } = payload.tour.perimeter;
    return (
      <header className="px-4 lg:px-8 pt-5 lg:pt-8 pb-2">
        <p className="text-[11px] font-mono tracking-wider text-slate-500 uppercase">
          Ma tournée
        </p>
        <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-slate-900">
          {dateLabel}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {pluralize(teamsCount, "équipe")} · {pluralize(sitesCount, "site")} ·{" "}
          {pluralize(agentsCount, "agent")}
        </p>
        {nav}
      </header>
    );
  }

  // ADMIN
  return (
    <header className="px-4 lg:px-8 pt-5 lg:pt-8 pb-2">
      <p className="text-[11px] font-mono tracking-wider text-slate-500 uppercase">
        Pilotage système
      </p>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-slate-900">
        {dateLabel}
      </h1>
      {nav}
    </header>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parisHourIsDaylight(date: Date): boolean {
  // Récupère l'heure (0-23) en Europe/Paris pour choisir l'emoji.
  const hourStr = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const hour = parseInt(hourStr.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(hour)) return true;
  return hour >= 7 && hour < 19;
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}
