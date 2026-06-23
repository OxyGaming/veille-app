/**
 * Schémas Zod des routes push V1 (C3).
 *
 * Tous les schémas utilisent `.strict()` pour refuser les champs inconnus
 * et empêcher un client de glisser des clés non prévues (ex. `userId`).
 */

import { z } from "zod";

/** Plateformes acceptées côté abonnement. */
export const PushPlatformSchema = z.enum([
  "android",
  "ios",
  "desktop",
  "other",
]);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

/**
 * Body de POST /api/push/subscribe.
 *
 * `userId` n'est volontairement pas accepté — il est lu depuis la session.
 * Limites de taille raisonnables pour éviter un DoS via payload géant
 * (un endpoint réel fait < 500 chars, on garde 2000 par marge).
 */
export const SubscribeBodySchema = z
  .object({
    endpoint: z.string().min(1).max(2000),
    keys: z
      .object({
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
      })
      .strict(),
    platform: PushPlatformSchema.optional(),
    userAgent: z.string().max(500).optional(),
  })
  .strict();
export type SubscribeBody = z.infer<typeof SubscribeBodySchema>;

/** Body de DELETE /api/push/subscribe — seul l'endpoint à supprimer. */
export const UnsubscribeBodySchema = z
  .object({
    endpoint: z.string().min(1).max(2000),
  })
  .strict();
export type UnsubscribeBody = z.infer<typeof UnsubscribeBodySchema>;

/**
 * Body de PATCH /api/me/notification-preferences.
 *
 * Tous les champs sont optionnels (patch partiel). `.strict()` rejette
 * toute clé inconnue avec une 400 — important pour éviter d'introduire
 * une catégorie côté client sans qu'elle ait été déclarée en schéma.
 */
export const PreferencesPatchSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    catEcheances: z.boolean().optional(),
    catEquipes: z.boolean().optional(),
  })
  .strict();
export type PreferencesPatch = z.infer<typeof PreferencesPatchSchema>;
