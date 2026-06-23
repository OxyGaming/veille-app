/**
 * Helpers de gestion des abonnements push (C3).
 *
 * Toute la logique DB des routes /api/push/subscribe vit ici, pour rester
 * testable sans Next request lifecycle (cf. lib/notifications.ts).
 *
 * Règles de sécurité :
 *  - Le userId est TOUJOURS fourni par le caller (jamais lu d'un body).
 *  - L'`endpoint` est unique globalement : si déjà connu d'un autre user,
 *    on réassigne au caller (un même device peut changer de session). La
 *    sécurité repose sur le fait que le caller s'est authentifié.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type UpsertSubscriptionInput = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform?: string | null;
  userAgent?: string | null;
};

/**
 * Crée ou met à jour un abonnement push.
 *
 *  - Si l'endpoint est inconnu → create avec `userId` du caller.
 *  - Si l'endpoint existe pour le même user → update des clés / plateforme /
 *    UA. Le champ `userId` est volontairement absent du payload update :
 *    un upsert ne doit jamais changer le propriétaire d'une row existante.
 *  - Si l'endpoint existe pour un AUTRE user (même device, session
 *    différente) → delete + create au profit du caller. La session ayant
 *    été authentifiée, on considère que ce device lui appartient.
 *
 * Reset `lastErrorAt` / `lastErrorCode` à chaque upsert : un user qui
 * réabonne avec succès remet l'endpoint en service.
 */
export async function upsertSubscription(
  input: UpsertSubscriptionInput,
): Promise<void> {
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: input.endpoint },
    select: { id: true, userId: true },
  });
  if (existing && existing.userId !== input.userId) {
    await prisma.pushSubscription.delete({ where: { id: existing.id } });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      platform: input.platform ?? null,
      userAgent: input.userAgent ?? null,
    },
    update: {
      // userId volontairement absent — cf. doc ci-dessus.
      p256dh: input.p256dh,
      auth: input.auth,
      platform: input.platform ?? null,
      userAgent: input.userAgent ?? null,
      lastErrorAt: null,
      lastErrorCode: null,
    },
  });
}

/**
 * Supprime un abonnement push uniquement si son `userId` correspond.
 *
 * Utilise `deleteMany` au lieu de `delete` pour être idempotent : pas
 * d'erreur si l'endpoint n'existe pas ou appartient à un autre user.
 *
 * Renvoie `true` si une row a effectivement été supprimée.
 */
export async function removeSubscriptionForUser(
  userId: string,
  endpoint: string,
): Promise<boolean> {
  const res = await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId },
  });
  return res.count > 0;
}

/**
 * Empreinte courte pour les logs — sha-256 hex tronqué à 16 chars.
 *
 * Évite de logger l'endpoint en clair (PII, RGPD) tout en gardant un
 * identifiant déterministe utile au debug ("est-ce le même endpoint
 * qu'on a vu hier ?").
 */
export function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
}
