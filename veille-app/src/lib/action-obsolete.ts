/**
 * Logique métier centrale pour la suppression logique des actions
 * importées (Sprint 7 C1).
 *
 * Règle métier : on ne supprime jamais physiquement une action — on
 * bascule `localStatus = "OBSOLETE"`. Les actions OBSOLETE sont alors
 * filtrées hors de Today / Hub Échéances / Dashboard / fiches agent
 * et site / génération de notifications futures.
 *
 * Statuts d'entrée pris en charge :
 *  - `ACTIVE` | `REPLACED` → transition vers OBSOLETE + AuditLog
 *  - `OBSOLETE`           → idempotent (no-op, pas d'AuditLog)
 *  - `VALIDATED_LOCAL`    → refus métier (409)
 *
 * Scope ADMIN Sprint 6 hérité automatiquement via `actionScope(u)`.
 */

import { actionScope, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ObsoleteOutcome =
  /** Transition réussie ACTIVE/REPLACED → OBSOLETE. */
  | {
      kind: "ok";
      actionId: string;
      previousStatus: string;
      newStatus: "OBSOLETE";
      noop: false;
    }
  /** Action déjà OBSOLETE — aucun changement, aucun AuditLog. */
  | {
      kind: "noop";
      actionId: string;
      previousStatus: "OBSOLETE";
      newStatus: "OBSOLETE";
      noop: true;
    }
  /** Action déjà validée — refus métier. */
  | {
      kind: "validated";
      actionId: string;
      currentStatus: "VALIDATED_LOCAL";
    }
  /** Action introuvable OU hors scope (404 — pas de fuite d'existence). */
  | { kind: "not_found"; actionId: string };

/**
 * Tente de marquer une action comme OBSOLETE pour le compte de `user`.
 *
 * - Atomique : transaction Prisma `[update, auditLog.create]`.
 * - Idempotent sur OBSOLETE (no-op, pas d'audit).
 * - Refuse VALIDATED_LOCAL avec un code dédié.
 * - Aucun side-effect réseau (pas de notif, pas d'activité).
 */
export async function obsoleteAction(
  user: SessionUser,
  actionId: string,
): Promise<ObsoleteOutcome> {
  // Lecture scopée — `actionScope` applique le scope EDITOR/ADMIN Sprint 6.
  // Si l'action n'existe pas OU est hors scope : kind = not_found (404).
  const action = await prisma.importedAction.findFirst({
    where: { id: actionId, ...actionScope(user) },
    select: {
      id: true,
      localStatus: true,
      agentId: true,
      siteId: true,
      teamId: true,
      keyPoint: true,
      comment: true,
      externalId: true,
    },
  });
  if (!action) return { kind: "not_found", actionId };

  if (action.localStatus === "VALIDATED_LOCAL") {
    return {
      kind: "validated",
      actionId: action.id,
      currentStatus: "VALIDATED_LOCAL",
    };
  }

  if (action.localStatus === "OBSOLETE") {
    return {
      kind: "noop",
      actionId: action.id,
      previousStatus: "OBSOLETE",
      newStatus: "OBSOLETE",
      noop: true,
    };
  }

  const previousStatus = action.localStatus;
  const label =
    action.keyPoint?.trim() ||
    action.comment?.trim() ||
    `Action ${action.externalId}`;

  await prisma.$transaction([
    prisma.importedAction.update({
      where: { id: action.id },
      data: { localStatus: "OBSOLETE" },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "ACTION_OBSOLETE",
        entity: "ImportedAction",
        entityId: action.id,
        details: JSON.stringify({
          previousStatus,
          newStatus: "OBSOLETE",
          agentId: action.agentId,
          siteId: action.siteId,
          teamId: action.teamId,
          label,
        }),
      },
    }),
  ]);

  return {
    kind: "ok",
    actionId: action.id,
    previousStatus,
    newStatus: "OBSOLETE",
    noop: false,
  };
}
