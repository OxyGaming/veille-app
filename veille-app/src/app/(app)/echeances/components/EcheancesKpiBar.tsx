import { KpiCard } from "@/app/(app)/today/components/KpiCard";
import { KpiSection } from "@/app/(app)/today/components/KpiSection";
import type { EcheanceKpis } from "@/lib/echeances/types";

type Props = {
  kpis: EcheanceKpis;
};

/**
 * 4 KPI principaux + indicateur transverse `Critiques` en accent rouge.
 * Les KPI suivent l'ordre PO : critiques / en retard / < 7 j / < 30 j.
 */
export function EcheancesKpiBar({ kpis }: Props) {
  const has7 = kpis.today + kpis.soon;
  return (
    <KpiSection title="Vue d'ensemble">
      <KpiCard
        label="Critiques"
        value={kpis.critical}
        tone={kpis.critical > 0 ? "danger" : "neutral"}
        hint={kpis.critical > 0 ? "à traiter en priorité" : undefined}
      />
      <KpiCard
        label="En retard"
        value={kpis.late}
        tone={kpis.late > 0 ? "danger" : "neutral"}
      />
      <KpiCard
        label="< 7 jours"
        value={has7}
        tone={has7 > 0 ? "warn" : "neutral"}
        hint={kpis.today > 0 ? `dont ${kpis.today} aujourd'hui` : undefined}
      />
      <KpiCard
        label="< 30 jours"
        value={kpis.later}
        tone={kpis.later > 0 ? "warn" : "neutral"}
      />
    </KpiSection>
  );
}
