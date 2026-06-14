/**
 * Flux d'activité équipe — helper d'écriture (recordActivity) +
 * helpers purs de format (message, targetUrl).
 *
 * Stratégie multi-équipes V1 : DUPLICATION par équipe.
 * Si un événement concerne un site rattaché à N équipes, on insère N lignes
 * (une par équipe destinataire). Chaque équipe consomme son propre flux via
 * un simple `WHERE teamId = ?`. Plus simple que l'alternative N-N et plus
 * rapide à lire. Coût accepté pour le MVP : volumétrie × N.
 *
 * Cf. memory/business-rules.md §Sites pour le rationale multi-équipes.
 */

import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/** Liste exhaustive des types d'événements suivis V1 + V1.1 équipement. */
export const ACTIVITY_TYPES = [
  "SESSION_FINISHED",
  "VISIT_FINISHED",
  "AGENT_NOTE",
  "AGENT_SIGHTED",
  "ACTION_CREATED",
  "ACTION_VALIDATED",
  "EQUIPMENT_NON_COMPLIANT",
  "EQUIPMENT_REPLACED",
  "EQUIPMENT_ADDED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Type d'entité cible — guide la résolution de `targetUrl`. */
export const ACTIVITY_ENTITY_TYPES = [
  "session",
  "visit",
  "agent",
  "action",
  "equipment",
  "site",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export type RecordActivityInput = {
  /**
   * Équipes destinataires. La duplication est appliquée ici : 1 ligne
   * insérée par teamId. Doublons et entrées vides sont normalisés.
   * Si l'array est vide après normalisation, l'écriture est ignorée.
   */
  teamIds: string[];
  actorId?: string | null;
  /** Nom figé au moment de l'événement (survit à un changement). */
  actorName?: string | null;
  type: ActivityType;
  entityType: ActivityEntityType;
  entityId: string;
  /** Libellé court de l'entité, figé. Survit à une suppression. */
  entityLabel?: string | null;
  /** Phrase humaine prête à afficher. À calculer via `defaultMessageFor` si besoin. */
  message: string;
  /** URL cible au clic. À calculer via `defaultTargetUrlFor` si besoin. */
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Enregistre un événement dans le flux d'activité de chaque équipe
 * destinataire. Retourne le nombre de lignes insérées (= nombre d'équipes
 * distinctes après dédoublonnage). Non bloquant pour le caller : si
 * Prisma jette, l'erreur remonte ; les call-sites métier doivent
 * encapsuler dans un try/catch pour ne pas casser la mutation principale.
 */
export async function recordActivity(
  input: RecordActivityInput,
): Promise<number> {
  const teamIds = [...new Set(input.teamIds)].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  if (teamIds.length === 0) return 0;
  const metadata = JSON.stringify(input.metadata ?? {});
  const res = await prisma.teamActivity.createMany({
    data: teamIds.map((teamId) => ({
      teamId,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel ?? null,
      message: input.message,
      targetUrl: input.targetUrl ?? null,
      metadata,
    })),
  });
  return res.count;
}

/**
 * Variante non bloquante de `recordActivity` : capture toute exception et
 * la logge sans relancer. À utiliser dans les routes mutantes pour que
 * l'écriture du flux n'invalide jamais l'opération métier.
 */
export async function recordActivitySafe(
  input: RecordActivityInput,
): Promise<number> {
  try {
    return await recordActivity(input);
  } catch (err) {
    log.error("activityFeed.recordActivity.failed", {
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ─── Helpers purs (testables sans Prisma) ────────────────────────────────────

/**
 * Compose un message humain par défaut depuis le type d'événement, le nom
 * de l'acteur et le libellé de l'entité. Reste neutre quand les données
 * manquent (« Quelqu'un », « — »).
 */
export function defaultMessageFor(input: {
  type: ActivityType;
  actorName?: string | null;
  entityLabel?: string | null;
}): string {
  const actor = input.actorName?.trim() || "Quelqu'un";
  const label = input.entityLabel?.trim() || "—";
  switch (input.type) {
    case "SESSION_FINISHED":
      return `${actor} a terminé une veille — ${label}.`;
    case "VISIT_FINISHED":
      return `${actor} a terminé une visite — ${label}.`;
    case "AGENT_NOTE":
      return `${actor} a commenté ${label}.`;
    case "AGENT_SIGHTED":
      return `${actor} a vu ${label}.`;
    case "ACTION_CREATED":
      return `${actor} a créé une action sur ${label}.`;
    case "ACTION_VALIDATED":
      return `${actor} a validé une action — ${label}.`;
    case "EQUIPMENT_NON_COMPLIANT":
      return `${actor} a signalé une non-conformité sur ${label}.`;
    case "EQUIPMENT_REPLACED":
      return `${actor} a remplacé l'équipement ${label}.`;
    case "EQUIPMENT_ADDED":
      return `${actor} a ajouté un équipement — ${label}.`;
  }
}

/**
 * Calcule l'URL cible standard depuis le type d'entité. Renvoie null si
 * l'entité n'a pas de page dédiée — le caller peut fournir une URL
 * personnalisée via `targetUrl` (ex. /agents/[id] pour une action liée).
 */
export function defaultTargetUrlFor(input: {
  entityType: ActivityEntityType;
  entityId: string;
}): string | null {
  if (!input.entityId) return null;
  switch (input.entityType) {
    case "session":
      return `/sessions/${input.entityId}`;
    case "visit":
      return `/visits/${input.entityId}/report`;
    case "agent":
      return `/agents/${input.entityId}`;
    case "site":
      return `/sites/${input.entityId}`;
    // Pas de fiche dédiée — le call-site (C7) fournira une URL contextuelle
    // (ex. action → /agents/[agentId], equipment → /sites/[siteId]).
    case "action":
      return null;
    case "equipment":
      return null;
  }
}
