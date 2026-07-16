import type { AdminPayload } from "@/lib/today/types";
import { formatFrenchDayLabel } from "@/lib/today/date-nav";
import { AgentsOnDutySection } from "./AgentsOnDutySection";
import { DiagnosticBanner, type DiagnosticState } from "./DiagnosticBanner";
import { KpiCard } from "./KpiCard";
import { KpiSection } from "./KpiSection";
import { RecentActivitySection } from "./RecentActivitySection";
import { AlertsList } from "./AlertsList";

type Props = { payload: AdminPayload };

/**
 * Dashboard ADMIN — état système + alertes + usage 7j + activité système.
 * Consomme uniquement le payload C3. Réutilise les primitives déjà créées
 * en C7/C8/C9 (DiagnosticBanner, KpiSection/KpiCard, RecentActivitySection).
 */
export function AdminDashboard({ payload }: Props) {
  const s = payload.systemStatus;
  const u = payload.usage7d;
  const dayLabel = payload.isToday
    ? "aujourd'hui"
    : `le ${formatFrenchDayLabel(payload.viewedDate)}`;

  return (
    <>
      <DiagnosticBanner
        state={mapState(s.state)}
        title={STATUS_TITLE[s.state]}
        lines={buildStatusLines(payload)}
      />

      <AlertsList alerts={payload.alerts} />

      <KpiSection title="Usage 7 derniers jours" cols={{ base: 2, md: 3, lg: 4 }}>
        <KpiCard label="Veilles" value={u.sessions} />
        <KpiCard label="Visites" value={u.visits} />
        <KpiCard label="Validations" value={u.validatedActions} />
        <KpiCard label="Photos" value={u.photos} />
      </KpiSection>

      <AgentsOnDutySection
        items={payload.agentsOnDutyToday}
        hasPlanningImport={payload.hasPlanningImport}
        canImportPlanning
        title={`Agents en service ${dayLabel}`}
        emptyTitle={`Aucun agent en service ${dayLabel}`}
        emptyDescription={`Aucun agent n'a de journée de service prévue ${dayLabel}.`}
      />

      <RecentActivitySection
        items={payload.recentActivity}
        title={
          payload.isToday
            ? "Activité système"
            : `Activité système — ${formatFrenchDayLabel(payload.viewedDate)}`
        }
        emptyMessage={payload.isToday ? undefined : "Aucune activité ce jour-là."}
      />
    </>
  );
}

function mapState(s: AdminPayload["systemStatus"]["state"]): DiagnosticState {
  if (s === "incident") return "red";
  if (s === "degraded") return "yellow";
  return "green";
}

const STATUS_TITLE: Record<AdminPayload["systemStatus"]["state"], string> = {
  ok: "Système opérationnel",
  degraded: "Système dégradé",
  incident: "Incident système",
};

function buildStatusLines(payload: AdminPayload): string[] {
  const s = payload.systemStatus;
  const lines: string[] = [];
  lines.push(
    `${pluralize(s.usersCount, "utilisateur actif", "utilisateurs actifs")} · ${pluralize(s.teamsCount, "équipe", "équipes")}`,
  );
  lines.push(`Sauvegarde : ${formatBackup(s.lastBackupAt, payload.now)}`);
  return lines;
}

function formatBackup(lastBackupAt: Date | string | null, nowIso: string): string {
  if (!lastBackupAt) return "aucune sauvegarde détectée";
  const last =
    typeof lastBackupAt === "string" ? new Date(lastBackupAt) : lastBackupAt;
  const now = new Date(nowIso);
  const diffH = Math.floor((now.getTime() - last.getTime()) / (60 * 60 * 1000));
  if (diffH < 1) return "il y a moins d'une heure";
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} jours`;
  return `le ${new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(last)}`;
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n > 1 ? plural : singular}`;
}
