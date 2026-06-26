/**
 * Suppression définitive en lot d'actions importées (admin).
 *
 * Contrairement à `batchObsoleteActions` (soft, réversible), ce module supprime
 * physiquement les lignes en base. Refuse les actions ayant au moins une
 * `ActionValidation` rattachée — l'admin doit d'abord annuler ces validations
 * (la cascade aveugle perdrait des traces métier).
 *
 * Sécurité : ADMIN-only au niveau route. Motif obligatoire (3–500 caractères)
 * tracé dans l'AuditLog.
 */

import { teamScope, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const BATCH_DELETE_MAX = 500;

export type BatchDeleteOutcome = {
  ok: true;
  /** IDs reçus, dédupés, plafonnés. */
  requested: string[];
  /** IDs effectivement supprimés. */
  deleted: string[];
  /** IDs refusés car ils ont au moins une validation rattachée. */
  blockedValidated: string[];
  /** IDs introuvables OU hors scope (404 silencieux — pas de fuite). */
  forbidden: string[];
};

export async function batchHardDeleteActions(
  user: SessionUser,
  actionIds: string[],
  reason: string,
): Promise<BatchDeleteOutcome> {
  const requested = Array.from(new Set(actionIds)).slice(0, BATCH_DELETE_MAX);
  if (requested.length === 0) {
    return {
      ok: true,
      requested: [],
      deleted: [],
      blockedValidated: [],
      forbidden: [],
    };
  }

  // Scope STRICT par teamId (aligné cloisonnement fiche agent).
  const accessible = await prisma.importedAction.findMany({
    where: { id: { in: requested }, ...teamScope(user) },
    select: {
      id: true,
      externalId: true,
      keyPoint: true,
      comment: true,
      agentId: true,
      siteId: true,
      teamId: true,
      _count: { select: { validations: true } },
    },
  });
  const seenIds = new Set(accessible.map((a) => a.id));
  const forbidden = requested.filter((id) => !seenIds.has(id));

  const blockedValidated: string[] = [];
  const toDelete: typeof accessible = [];
  for (const a of accessible) {
    if (a._count.validations > 0) blockedValidated.push(a.id);
    else toDelete.push(a);
  }

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.importedAction.deleteMany({
        where: { id: { in: toDelete.map((a) => a.id) } },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "ACTION_BATCH_DELETE",
        entity: "ImportedAction",
        entityId: null,
        details: JSON.stringify({
          reason,
          count: toDelete.length,
          requestedCount: requested.length,
          deleted: toDelete.map((a) => ({
            id: a.id,
            externalId: a.externalId,
            label: a.keyPoint?.trim() || a.comment?.trim()?.slice(0, 80) || null,
            agentId: a.agentId,
            siteId: a.siteId,
            teamId: a.teamId,
          })),
          blockedValidated,
          forbidden,
        }),
      },
    });
  });

  return {
    ok: true,
    requested,
    deleted: toDelete.map((a) => a.id),
    blockedValidated,
    forbidden,
  };
}
