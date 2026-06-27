import { KpiCard } from "@/app/(app)/today/components/KpiCard";
import { KpiSection } from "@/app/(app)/today/components/KpiSection";
import type { EcheanceKpis } from "@/lib/echeances/types";

type Props = {
  kpis: EcheanceKpis;
};

/**
 * Vue d'ensemble — vocabulaire canonique (cf. docs/NOMENCLATURE-ECHEANCES.md) :
 *  - En retard (dont critiques) · À venir (≤ 7 j) · Planifiée (> 7 j).
 * « Critiques » reste un indicateur transverse (actions en retard > 7 j +
 * visites/équipements critiques), distinct du sous-compte d'actions.
 */
export function EcheancesKpiBar({ kpis }: Props) {
  const aVenir = kpis.today + kpis.soon; // aujourd'hui → J+7
  const planifiee = kpis.later + kpis.future; // au-delà de J+7
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
        label="À venir"
        value={aVenir}
        tone={aVenir > 0 ? "warn" : "neutral"}
        hint={kpis.today > 0 ? `dont ${kpis.today} aujourd'hui` : undefined}
      />
      <KpiCard
        label="Planifiée"
        value={planifiee}
        tone="neutral"
        hint="au-delà de 7 jours"
      />
    </KpiSection>
  );
}
