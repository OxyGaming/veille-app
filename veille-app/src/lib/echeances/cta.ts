/**
 * Table de routage CTA pour les `EcheanceItem` (Sprint 4 C9 — D11).
 *
 * Centralisé pour garantir l'homogénéité Hub / drilldown site / futurs
 * consommateurs. Lecture seule (cf. D11) — pas d'édition inline.
 *
 *   | Type                 | Label par défaut       | Cible                              |
 *   | -------------------- | ---------------------- | ---------------------------------- |
 *   | VISIT_QUARTERLY      | Ouvrir le site         | /sites/{siteId}                    |
 *   | VISIT_PLANNED        | Ouvrir le site         | /sites/{siteId}                    |
 *   | EQUIPMENT_EXPIRING   | Voir le site           | /sites/{siteId}                    |
 *   | ACTION_OVERDUE       | Valider | Ouvrir       | /agents/{agentId}?actionId={id}    |
 *   |                      |                        | ou /sites/{siteId}                 |
 *   |                      |                        | ou /today (fallback)               |
 *
 * Pour `ACTION_OVERDUE` : `label = "Valider"` si l'item est en retard
 * (`daysToDue < 0`), sinon `"Ouvrir"`.
 */

import type { EcheanceCta, EcheanceKind } from "./types";

type CtaInput = {
  kind: EcheanceKind;
  /** `sourceId` brut (sans préfixe `${kind}:`) — utilisé pour les actions. */
  sourceId: string;
  daysToDue: number | null;
  siteId?: string;
  agentId?: string;
};

/** Calcule le CTA principal d'une échéance — homogène et testé. */
export function ctaForEcheance(input: CtaInput): EcheanceCta {
  const { kind, sourceId, daysToDue, siteId, agentId } = input;

  switch (kind) {
    case "VISIT_QUARTERLY":
    case "VISIT_PLANNED": {
      const href = siteId ? `/sites/${siteId}` : "/today";
      return { label: "Ouvrir le site", href };
    }
    case "EQUIPMENT_EXPIRING": {
      const href = siteId ? `/sites/${siteId}` : "/today";
      return { label: "Voir le site", href };
    }
    case "ACTION_OVERDUE": {
      const inDelay = daysToDue !== null && daysToDue < 0;
      const label = inDelay ? "Valider" : "Ouvrir";
      let href = "/today";
      if (agentId) href = `/agents/${agentId}?actionId=${sourceId}`;
      else if (siteId) href = `/sites/${siteId}`;
      return { label, href };
    }
    default: {
      // Garde-fou exhaustivité TypeScript.
      const _exhaustive: never = kind;
      void _exhaustive;
      return { label: "Ouvrir", href: "/today" };
    }
  }
}
