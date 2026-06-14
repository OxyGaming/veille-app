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

/** Plafond de sécurité pour `batchObsoleteActions` (Sprint 7 C3). */
export const BATCH_OBSOLETE_MAX = 500;

/**
 * Résultat d'un batch — D8 PO : 200 même si partiel, détail complet.
 */
export type BatchObsoleteOutcome = {
  ok: true;
  /** Liste des IDs reçus, dédupés. */
  requested: string[];
  /** IDs effectivement transitionnés vers OBSOLETE (ACTIVE / REPLACED). */
  updated: string[];
  /** IDs refusés métier (VALIDATED_LOCAL). */
  skipped: string[];
  /** IDs introuvables OU hors scope (404). */
  forbidden: string[];
  /** IDs déjà OBSOLETE (idempotent). */
  alreadyObsolete: string[];
};

/**
 * Marque un lot d'actions comme OBSOLETE en une transaction Prisma.
 *
 * Lecture scopée via `actionScope(user)` — les IDs hors scope sont
 * comptés dans `forbidden` sans fuite d'existence.
 *
 * Statuts (cohérents avec `obsoleteAction`) :
 *  - `ACTIVE` / `REPLACED` → `updated`
 *  - `OBSOLETE`            → `alreadyObsolete` (idempotent)
 *  - `VALIDATED_LOCAL`     → `skipped`
 *
 * AuditLog **unique** `ACTION_BATCH_OBSOLETE` créé dans la même
 * transaction quand au moins une opération a eu lieu OU au moins un ID
 * a été vu (forbidden compte comme tentative tracée). Si `requested`
 * est vide, aucun audit n'est créé.
 */
export async function batchObsoleteActions(
  user: SessionUser,
  actionIds: string[],
): Promise<BatchObsoleteOutcome> {
  const requested = Array.from(new Set(actionIds)).slice(0, BATCH_OBSOLETE_MAX);
  if (requested.length === 0) {
    return {
      ok: true,
      requested: [],
      updated: [],
      skipped: [],
      forbidden: [],
      alreadyObsolete: [],
    };
  }

  const accessible = await prisma.importedAction.findMany({
    where: { id: { in: requested }, ...actionScope(user) },
    select: {
      id: true,
      localStatus: true,
    },
  });
  const seenIds = new Set(accessible.map((a) => a.id));
  const forbidden = requested.filter((id) => !seenIds.has(id));

  const updated: string[] = [];
  const skipped: string[] = [];
  const alreadyObsolete: string[] = [];
  for (const a of accessible) {
    if (a.localStatus === "VALIDATED_LOCAL") skipped.push(a.id);
    else if (a.localStatus === "OBSOLETE") alreadyObsolete.push(a.id);
    else updated.push(a.id);
  }

  // Transaction interactive : updateMany (conditionnel) + 1 AuditLog.
  // Pas d'écriture inutile si aucune action n'est éligible — seul le
  // log d'audit est créé pour traçabilité de la tentative.
  await prisma.$transaction(async (tx) => {
    if (updated.length > 0) {
      await tx.importedAction.updateMany({
        where: { id: { in: updated } },
        data: { localStatus: "OBSOLETE" },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "ACTION_BATCH_OBSOLETE",
        entity: "ImportedAction",
        entityId: null,
        details: JSON.stringify({
          actorId: user.id,
          count: updated.length,
          requestedCount: requested.length,
          actionIds: updated,
          skipped,
          forbidden,
          alreadyObsolete,
        }),
      },
    });
  });

  return {
    ok: true,
    requested,
    updated,
    skipped,
    forbidden,
    alreadyObsolete,
  };
}

