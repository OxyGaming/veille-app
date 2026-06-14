import type { EditorPayload, WatchlistItem } from "@/lib/today/types";
import { DiagnosticBanner } from "./DiagnosticBanner";
import { KpiCard } from "./KpiCard";
import { KpiSection } from "./KpiSection";
import { WatchlistSection } from "./WatchlistSection";
import { WatchlistRow } from "./WatchlistRow";
import { ActivityFeedSection } from "./ActivityFeedSection";

type Props = { payload: EditorPayload };

/**
 * Dashboard EDITOR — bannière diagnostic + KPI périmètre + KPI semaine.
 * Consomme uniquement le payload C3. Aucun fetch ici.
 */
export function EditorDashboard({ payload }: Props) {
  const d = payload.diagnostic;
  const w = payload.weekCounters;
  const sitesToVisit = payload.sitesWithoutVisitTotal;
  const equipmentTotal = d.expiredEquipments + d.expiringEquipments;

  const diagnosticLines = buildDiagnosticLines(payload);

  return (
    <>
      <DiagnosticBanner state={d.state} lines={diagnosticLines} />

      <KpiSection title="Périmètre">
        <KpiCard
          label="Actions en retard"
          value={d.lateActions7d}
          tone={d.lateActions7d > 0 ? "danger" : "neutral"}
          hint={d.lateActions7d > 0 ? "depuis plus de 7 jours" : undefined}
        />
        <KpiCard
          label="Sites à visiter"
          value={sitesToVisit}
          tone={sitesToVisit > 0 ? "warn" : "neutral"}
          hint={sitesToVisit > 0 ? "trimestrielle dépassée" : undefined}
        />
        <KpiCard
          label="Équipements"
          value={equipmentTotal}
          tone={
            d.expiredEquipments > 0
              ? "danger"
              : d.expiringEquipments > 0
                ? "warn"
                : "neutral"
          }
          hint={
            equipmentTotal === 0
              ? undefined
              : d.expiredEquipments > 0 && d.expiringEquipments > 0
                ? `${d.expiredEquipments} périmé(s) · ${d.expiringEquipments} à venir`
                : d.expiredEquipments > 0
                  ? `${d.expiredEquipments} périmé(s)`
                  : `${d.expiringEquipments} expirant < 30 j`
          }
        />
      </KpiSection>

      <KpiSection title="Activité cette semaine">
        <KpiCard label="Veilles" value={w.sessions} />
        <KpiCard label="Visites" value={w.visits} />
        <KpiCard label="Validations" value={w.closedActions} />
      </KpiSection>

      <WatchlistSection
        title="Agents à veiller"
        total={payload.agentsToReviewTotal}
        shown={payload.agentsToReview.length}
        emptyMessage="Tous les agents ont eu une activité récente."
      >
        {payload.agentsToReview.map((item) => (
          <WatchlistRow
            key={item.id}
            item={item}
            freshnessLabel={freshnessLabelForAgent(item)}
            detailHref={`/agents/${item.id}`}
          />
        ))}
      </WatchlistSection>

      <WatchlistSection
        title="Sites à visiter"
        total={payload.sitesWithoutVisitTotal}
        shown={payload.sitesWithoutVisit.length}
        emptyMessage="Aucun site en retard de visite trimestrielle."
      >
        {payload.sitesWithoutVisit.map((item) => (
          <WatchlistRow
            key={item.id}
            item={item}
            freshnessLabel={freshnessLabelForSite(item)}
            detailHref={`/sites/${item.id}`}
          />
        ))}
      </WatchlistSection>

      <ActivityFeedSection items={payload.activityFeed} now={payload.now} />
    </>
  );
}

function freshnessLabelForAgent(item: WatchlistItem): string {
  if (item.daysSince === null) return "Jamais veillé";
  if (item.daysSince === 0) return "Vu aujourd'hui";
  if (item.daysSince === 1) return "Vu hier";
  return `Vu il y a ${item.daysSince} jours`;
}

function freshnessLabelForSite(item: WatchlistItem): string {
  const types = item.badges?.overdueVisitTypes ?? [];
  // Compose un libellé qui reflète la (les) cadence(s) en retard. Les
  // détails par cadence (Trimestrielle / Planifiée) sont affichés en
  // badges sous la ligne, on garde ici une phrase courte.
  if (item.daysSince === null) {
    if (types.length === 0) return "Jamais visité";
    return types.length === 2
      ? "Jamais visité · trimestrielle et planifiée à faire"
      : types[0] === "quarterly"
        ? "Jamais visité · trimestrielle à faire"
        : "Jamais visité · planifiée à faire";
  }
  const ago = `Dernière visite il y a ${item.daysSince} jour${item.daysSince > 1 ? "s" : ""}`;
  if (types.length === 0) return ago;
  if (types.length === 2) return `${ago} · 2 cadences à rattraper`;
  return `${ago} · ${types[0] === "quarterly" ? "trimestrielle" : "planifiée"} en retard`;
}

/**
 * Compose les lignes humaines de la bannière à partir des compteurs métier.
 * Reste pure pour faciliter les évolutions (Hub Échéances Sprint 4).
 */
function buildDiagnosticLines(payload: EditorPayload): string[] {
  const lines: string[] = [];
  const { diagnostic: d, sitesWithoutVisitTotal } = payload;
  if (d.lateActions7d > 0) {
    lines.push(
      `${d.lateActions7d} action${plural(d.lateActions7d)} en retard de plus de 7 jours`,
    );
  }
  if (d.expiredEquipments > 0) {
    lines.push(
      `${d.expiredEquipments} équipement${plural(d.expiredEquipments)} déjà périmé${plural(d.expiredEquipments)}`,
    );
  }
  if (d.lateVisits > 0) {
    lines.push(
      `${d.lateVisits} site${plural(d.lateVisits)} sans visite trimestrielle depuis plus de 90 jours`,
    );
  }
  if (d.expiringEquipments > 0) {
    lines.push(
      `${d.expiringEquipments} équipement${plural(d.expiringEquipments)} expirant dans les 30 prochains jours`,
    );
  }
  if (sitesWithoutVisitTotal > d.lateVisits && d.lateVisits === 0) {
    // Cas marginal V1 : si l'agrégateur compte plus de sites à visiter
    // que de "en retard", c'est qu'on a des sites jamais visités.
    lines.push(
      `${sitesWithoutVisitTotal} site${plural(sitesWithoutVisitTotal)} à visiter`,
    );
  }
  return lines;
}

const plural = (n: number) => (n > 1 ? "s" : "");
