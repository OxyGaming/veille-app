/**
 * Helpers de gestion des préférences de notification (C3).
 *
 * Les préférences sont créées en mode "lazy" : la row n'existe pas tant
 * que l'utilisateur n'a pas visité l'écran ou qu'un premier déclencheur
 * push n'a pas eu besoin de la lire. Les défauts sont définis côté
 * schéma Prisma (`pushEnabled = catEcheances = catEquipes = true`).
 */

import { prisma } from "@/lib/prisma";

/** Forme publique des préférences exposée par l'API. */
export type PreferenceShape = {
  pushEnabled: boolean;
  catEcheances: boolean;
  catEquipes: boolean;
};

const SELECT_FIELDS = {
  pushEnabled: true,
  catEcheances: true,
  catEquipes: true,
} as const;

/**
 * Renvoie les préférences du user, créées avec les défauts du schéma
 * si elles n'existent pas encore.
 *
 * Idempotent : 2 appels concurrents ne dupliquent pas la row grâce à
 * `userId @unique`. Le second appel verra l'erreur P2002 propagée par
 * Prisma — c'est volontaire, le caller (route handler) gère le retry
 * via un nouveau GET côté client.
 */
export async function getOrCreatePreference(
  userId: string,
): Promise<PreferenceShape> {
  const found = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: SELECT_FIELDS,
  });
  if (found) return found;
  const created = await prisma.notificationPreference.create({
    data: { userId },
    select: SELECT_FIELDS,
  });
  return created;
}

/**
 * Applique un patch partiel aux préférences. Garantit l'existence de
 * la row au préalable via `getOrCreatePreference`.
 *
 * Le caller a déjà validé le shape via Zod (`PreferencesPatchSchema`)
 * — donc on peut passer `patch` tel quel à Prisma.
 */
export async function updatePreference(
  userId: string,
  patch: Partial<PreferenceShape>,
): Promise<PreferenceShape> {
  await getOrCreatePreference(userId);
  const updated = await prisma.notificationPreference.update({
    where: { userId },
    data: patch,
    select: SELECT_FIELDS,
  });
  return updated;
}
