/**
 * Hub Échéances — vue centralisée pour EDITOR + ADMIN (Sprint 4 C5/C6).
 *
 * Server Component. Appelle directement l'agrégateur (pas de fetch
 * HTTP) — même pattern que `/today`. Les filtres sont lus depuis l'URL
 * (`searchParams`) et propagés à l'agrégateur. L'UI gère ensuite
 * localement la pagination « Afficher 25 de plus » via un Client
 * Component par groupe.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { aggregateEcheances } from "@/lib/echeances/aggregator";
import { isKnownEcheanceKind } from "@/lib/echeances/criticality";
import type {
  EcheanceFilters,
  EcheanceKind,
  EcheanceUrgency,
} from "@/lib/echeances/types";
import { isEcheancesEnabled } from "@/lib/featureFlags";
import { EcheancesFilters } from "./components/EcheancesFilters";
import { EcheancesHeader } from "./components/EcheancesHeader";
import { EcheancesKpiBar } from "./components/EcheancesKpiBar";
import { EcheanceGroup } from "./components/EcheanceGroup";

export const dynamic = "force-dynamic";

const GROUP_TITLES: Record<EcheanceUrgency, string> = {
  late: "En retard",
  today: "Aujourd'hui",
  soon: "Dans les 7 jours",
  later: "Dans les 30 jours",
  future: "Plus tard",
};

const GROUP_ORDER: EcheanceUrgency[] = [
  "late",
  "today",
  "soon",
  "later",
  "future",
];

const ALLOWED_URGENCIES = new Set<EcheanceUrgency | "critical">([
  "late",
  "today",
  "soon",
  "later",
  "future",
  "critical",
]);

type SearchParams = { [k: string]: string | string[] | undefined };

/** Parse les query params (forme CSV ou single) en `EcheanceFilters`. */
function parseFilters(raw: SearchParams): EcheanceFilters {
  const out: EcheanceFilters = {};
  const csv = (v: string | string[] | undefined) =>
    typeof v === "string"
      ? v.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const type = csv(raw.type).filter((s): s is EcheanceKind =>
    isKnownEcheanceKind(s),
  );
  if (type.length) out.type = type;

  const urgency = csv(raw.urgency).filter(
    (s): s is EcheanceUrgency | "critical" =>
      ALLOWED_URGENCIES.has(s as EcheanceUrgency | "critical"),
  );
  if (urgency.length) out.urgency = urgency;

  if (typeof raw.siteId === "string" && raw.siteId) out.siteId = raw.siteId;
  if (typeof raw.teamId === "string" && raw.teamId) out.teamId = raw.teamId;
  return out;
}

export default async function EcheancesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isEcheancesEnabled()) redirect("/today");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "USER") redirect("/today");

  const raw = await searchParams;
  const filters = parseFilters(raw);
  const payload = await aggregateEcheances(user, new Date(), filters);
  const hasActiveFilters =
    !!filters.type ||
    !!filters.urgency ||
    !!filters.siteId ||
    !!filters.teamId;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <EcheancesHeader total={payload.total} filtered={hasActiveFilters} />
      <EcheancesKpiBar kpis={payload.kpis} />
      <EcheancesFilters
        teamsAvailable={payload.teamsAvailable}
        sitesAvailable={payload.sitesAvailable}
      />

      {payload.total === 0 ? (
        <div className="mx-4 lg:mx-8 mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 text-center">
          {hasActiveFilters
            ? "Aucune échéance ne correspond à ces filtres."
            : "Aucune échéance dans votre périmètre."}
        </div>
      ) : (
        GROUP_ORDER.map((u) => (
          <EcheanceGroup
            key={u}
            urgency={u}
            title={GROUP_TITLES[u]}
            items={payload.groups[u]}
          />
        ))
      )}
    </div>
  );
}
