/**
 * Lien action ↔ équipement (C12).
 *
 * Une action générée par une visite INVENTORY a la convention
 * d'`externalId = "nc-inv-{observationId}"` (cf. `/api/visits/[id]/route.ts`
 * `generateInventoryNonConformities`). On exploite cette convention
 * pour retrouver à coup sûr l'équipement d'origine sans migration.
 *
 * Si l'action a été créée manuellement (POST /api/agents/[id]/actions
 * ou /api/sites/[id]/actions), `externalId` ne commence pas par `nc-inv-`
 * → renvoie `null`. Conforme au périmètre A décidé en spec.
 */

import { prisma } from "@/lib/prisma";

export type EquipmentLinkInfo = {
  equipmentId: string;
  equipmentLabel: string;
  equipmentCategory: string;
  isPerishable: boolean;
  /** Quantité par défaut au catalogue. Jamais éditée (spec : pas de réassort partiel). */
  expectedQuantity: number | null;
  /** Date de péremption actuelle côté catalogue (utile pour pré-remplir). */
  currentExpirationDate: string | null;
  /** Type d'écart constaté lors de la visite. Sert à adapter le message UI. */
  discrepancyType: string | null;
  siteId: string;
  siteName: string;
  /** Toutes les équipes rattachées au site (pour TEAM_HISTORY_ADDED). */
  teamIds: string[];
};

const EXTERNAL_PREFIX = "nc-inv-";

/**
 * Extrait l'`observationId` depuis l'`externalId` d'une action si elle
 * a été générée par une NC d'inventaire. Pure helper testable.
 */
export function parseObservationIdFromExternalId(
  externalId: string | null,
): string | null {
  if (!externalId || !externalId.startsWith(EXTERNAL_PREFIX)) return null;
  const obsId = externalId.slice(EXTERNAL_PREFIX.length);
  return obsId.length > 0 ? obsId : null;
}

/**
 * Récupère les infos d'équipement associées à une action générée par
 * une visite INVENTORY. Renvoie `null` si :
 *  - l'action n'a pas d'`externalId` au format attendu,
 *  - l'observation correspondante a été supprimée,
 *  - l'observation n'a pas d'équipement lié (cas pathologique).
 */
export async function getEquipmentLinkForAction(
  actionId: string,
): Promise<EquipmentLinkInfo | null> {
  const action = await prisma.importedAction.findUnique({
    where: { id: actionId },
    select: { externalId: true },
  });
  if (!action) return null;
  const observationId = parseObservationIdFromExternalId(action.externalId);
  if (!observationId) return null;

  const obs = await prisma.siteVisitObservation.findUnique({
    where: { id: observationId },
    select: {
      discrepancyType: true,
      equipment: {
        select: {
          id: true,
          label: true,
          category: true,
          isPerishable: true,
          expectedQuantity: true,
          expirationDate: true,
          site: {
            select: {
              id: true,
              name: true,
              teamId: true,
              memberships: { select: { teamId: true } },
            },
          },
        },
      },
    },
  });
  if (!obs?.equipment) return null;

  const eq = obs.equipment;
  const teamIds = [
    ...new Set(
      [
        ...(eq.site.teamId ? [eq.site.teamId] : []),
        ...eq.site.memberships.map((m) => m.teamId),
      ].filter((t): t is string => Boolean(t)),
    ),
  ];

  return {
    equipmentId: eq.id,
    equipmentLabel: eq.label,
    equipmentCategory: eq.category,
    isPerishable: eq.isPerishable,
    expectedQuantity: eq.expectedQuantity,
    currentExpirationDate: eq.expirationDate
      ? eq.expirationDate.toISOString()
      : null,
    discrepancyType: obs.discrepancyType,
    siteId: eq.site.id,
    siteName: eq.site.name,
    teamIds,
  };
}
