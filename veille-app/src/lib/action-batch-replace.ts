/**
 * Remplacement en lot d'actions importées (admin / éditeur).
 *
 * Pour chaque action sélectionnée : crée une **nouvelle** `ImportedAction`
 * clone (mêmes `agentId`/`siteId`/`teamId`) avec le contenu fourni, puis
 * marque l'originale `localStatus = "REPLACED"`. L'originale reste en base
 * pour la traçabilité et l'historique des validations.
 *
 * Refuse les actions déjà validées (`VALIDATED_LOCAL`) — pas de sens de
 * "remplacer" une action qui a déjà été conclue côté terrain.
 *
 * Sécurité : ADMIN+EDITOR via la route. Audit log unique tracé.
 */

import { teamScope, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeTags } from "@/lib/tags";
import { randomUUID } from "node:crypto";

export const BATCH_REPLACE_MAX = 200;

export type BatchReplaceInput = {
  comment: string | null;
  keyPoint: string | null;
  theme: string | null;
  domain: string | null;
  /** ISO string ou null. Si non fourni → on hérite de l'originale. */
  dueAt?: string | null;
  /**
   * Liste de tags pour les nouvelles actions.
   *  - non fourni (`undefined`) → hérite des tags de l'originale (cas par défaut)
   *  - fourni (même tableau vide) → remplace, applique la liste telle quelle
   */
  tags?: string[];
};

export type BatchReplaceOutcome = {
  ok: true;
  requested: string[];
  /** IDs des originales remplacées (REPLACED). */
  replaced: string[];
  /** IDs des nouvelles actions créées (alignés 1:1 avec replaced). */
  createdIds: string[];
  /** Refusées car déjà validées. */
  skippedValidated: string[];
  /** Hors scope / inconnues. */
  forbidden: string[];
};

export async function batchReplaceActions(
  user: SessionUser,
  actionIds: string[],
  content: BatchReplaceInput,
): Promise<BatchReplaceOutcome> {
  const requested = Array.from(new Set(actionIds)).slice(0, BATCH_REPLACE_MAX);
  if (requested.length === 0) {
    return {
      ok: true,
      requested: [],
      replaced: [],
      createdIds: [],
      skippedValidated: [],
      forbidden: [],
    };
  }

  // Scope STRICT par teamId (aligné cloisonnement fiche agent).
  const accessible = await prisma.importedAction.findMany({
    where: { id: { in: requested }, ...teamScope(user) },
    select: {
      id: true,
      teamId: true,
      agentId: true,
      siteId: true,
      procedureId: true,
      externalId: true,
      veilleType: true,
      originalStatus: true,
      tags: true,
      dueAt: true,
      localStatus: true,
    },
  });
  const seenIds = new Set(accessible.map((a) => a.id));
  const forbidden = requested.filter((id) => !seenIds.has(id));

  const skippedValidated: string[] = [];
  const eligible: typeof accessible = [];
  for (const a of accessible) {
    if (a.localStatus === "VALIDATED_LOCAL") skippedValidated.push(a.id);
    else eligible.push(a);
  }

  const nextDueAt =
    content.dueAt === undefined
      ? undefined // hérite de l'originale (per-action)
      : content.dueAt === null
      ? null
      : new Date(content.dueAt);

  // Tags : `undefined` → hérite (per-action), liste fournie → encodage unique.
  const nextTagsEncoded =
    content.tags === undefined ? undefined : encodeTags(content.tags);

  const replaced: string[] = [];
  const createdIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const a of eligible) {
      const newId = `repl-${randomUUID()}`;
      const created = await tx.importedAction.create({
        data: {
          externalId: newId,
          teamId: a.teamId,
          agentId: a.agentId,
          siteId: a.siteId,
          procedureId: a.procedureId,
          localStatus: "ACTIVE",
          originalStatus: a.originalStatus,
          veilleType: a.veilleType,
          tags: nextTagsEncoded === undefined ? a.tags : nextTagsEncoded,
          comment: content.comment,
          keyPoint: content.keyPoint,
          theme: content.theme,
          domain: content.domain,
          dueAt: nextDueAt === undefined ? a.dueAt : nextDueAt,
        },
        select: { id: true },
      });
      await tx.importedAction.update({
        where: { id: a.id },
        data: { localStatus: "REPLACED" },
      });
      replaced.push(a.id);
      createdIds.push(created.id);
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "ACTION_BATCH_REPLACE",
        entity: "ImportedAction",
        entityId: null,
        details: JSON.stringify({
          count: replaced.length,
          requestedCount: requested.length,
          replaced,
          createdIds,
          skippedValidated,
          forbidden,
          content: {
            comment: content.comment,
            keyPoint: content.keyPoint,
            theme: content.theme,
            domain: content.domain,
            dueAt: content.dueAt ?? null,
            tags: content.tags ?? null,
          },
        }),
      },
    });
  });

  return {
    ok: true,
    requested,
    replaced,
    createdIds,
    skippedValidated,
    forbidden,
  };
}
