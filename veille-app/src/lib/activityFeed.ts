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
import { notifyTeamHistoryAdded } from "@/lib/notifications-generators";

/** Liste exhaustive des types d'événements suivis V1 + V1.1 équipement. */
export const ACTIVITY_TYPES = [
  "SESSION_FINISHED",
  "VISIT_FINISHED",
  "VEHICLE_ROUND_FINISHED",
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
  "vehicle-round",
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
  /**
   * Émettre la notification générique `TEAM_HISTORY_ADDED` ? Défaut `true`.
   * Passer `false` quand le call-site déclenche DÉJÀ une notification dédiée
   * et plus riche pour le même événement (action assignée/validée, visite
   * terminée) — règle « une notification par événement métier ». La ligne de
   * flux d'activité (TeamActivity) reste écrite dans tous les cas.
   */
  notify?: boolean;
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

  // Sprint Push V1 C9 — déclenche TEAM_HISTORY_ADDED pour les membres
  // actifs des équipes concernées (acteur exclu). Fire-and-forget : la
  // notif ne doit jamais retarder ou casser l'écriture activité.
  // notifyTeamHistoryAdded catch en interne et renvoie 0 sur erreur.
  //
  // C9.1 — on transmet `input.message` (déjà composé via defaultMessageFor)
  // comme `detailMessage` pour que le destinataire voie le contexte
  // métier dans sa notif (ex. « Marie a terminé une visite — POS-LYON. »).
  //
  // Règle « une notif par événement » : si le call-site a déjà émis une
  // notification dédiée (notify=false), on n'ajoute PAS TEAM_HISTORY_ADDED.
  if (input.notify !== false) {
    notifyTeamHistoryAdded({
      teamIds,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      targetUrl: input.targetUrl ?? null,
      detailMessage: input.message,
    }).catch((e) => {
      log.error("activityFeed.notify.team-history.failed", {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        err: e instanceof Error ? e.message : String(e),
      });
    });
  }

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
 * Tronque un texte libre et l'encadre de guillemets français pour
 * l'intégrer à un message d'activité / push. Vide → null (le caller
 * n'ajoute rien). Tronquage à `max` chars (défaut 140) avec ellipse.
 *
 * Utilisé par les call-sites de `recordActivitySafe` pour enrichir
 * automatiquement le message avec un commentaire utilisateur.
 */
export function formatQuotedSnippet(
  text: string | null | undefined,
  max = 140,
): string | null {
  const t = text?.trim();
  if (!t) return null;
  if (t.length <= max) return `« ${t} »`;
  return `« ${t.slice(0, max - 1).trimEnd()}… »`;
}

/**
 * Joint plusieurs fragments en filtrant les valeurs vides/null. Évite
 * les doubles espaces et facilite la composition côté call-site.
 */
export function joinActivityParts(
  parts: (string | null | undefined)[],
): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0))
    .join(" ");
}

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
    case "VEHICLE_ROUND_FINISHED":
      return `${actor} a terminé une tournée VS — ${label}.`;
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
    case "vehicle-round":
      return `/vehicle-rounds/${input.entityId}/report`;
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
