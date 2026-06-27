/**
 * Expansion serveur des groupes d'actions (Lot 4B-3).
 *
 * Garantit qu'une action LOGIQUE est toujours traitée comme un groupe complet,
 * quel que soit l'écran : on étend un ensemble d'ancres ACTIVE à TOUTES les
 * occurrences ACTIVE partageant la même clé logique
 * (`targetType | targetId | teamId | dedupHash`).
 *
 * Règles strictes (cf. docs/DEDUP-ACTIONS-AUDIT.md) :
 *  - on n'étend QUE des ancres `localStatus = "ACTIVE"` ;
 *  - `dedupHash` null ⇒ l'ancre reste seule (aucune expansion) ;
 *  - jamais d'extension vers une autre équipe (scope `teamScope` appliqué à la
 *    requête de siblings) ni vers une autre cible (filtre par `groupKey`) ni
 *    vers un autre statut (`localStatus = "ACTIVE"`).
 *
 * Réutilise la clé canonique pure `groupKeyOf` (Lot 4B-1) — aucune logique de
 * regroupement dupliquée ici.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { teamScope, type SessionUser } from "@/lib/auth";
import { groupKeyOf } from "./dedup";

/** Client Prisma OU client de transaction (tx). */
export type ExpandClient = Pick<PrismaClient, "importedAction">;

/** Champs minimaux nécessaires au calcul de la clé de groupe. */
export const ACTION_KEY_SELECT = {
  id: true,
  teamId: true,
  agentId: true,
  siteId: true,
  vehicleId: true,
  dedupHash: true,
  localStatus: true,
} satisfies Prisma.ImportedActionSelect;

export type ActionKeyRow = {
  id: string;
  teamId: string;
  agentId: string | null;
  siteId: string | null;
  vehicleId: string | null;
  dedupHash: string | null;
  localStatus: string;
};

/**
 * Étend des ancres ACTIVE à l'ensemble des ids ACTIVE de leur(s) groupe(s)
 * logique(s). Le résultat inclut les ancres ACTIVE elles-mêmes.
 *
 * @param anchors  Lignes ancres (déjà chargées + scopées par l'appelant). Seules
 *                 celles à `localStatus = "ACTIVE"` sont étendues.
 * @param user     Pour appliquer `teamScope` à la requête de siblings (double
 *                 garde de cloisonnement, en plus du `teamId` de la clé).
 */
export async function expandActiveSiblingIds(
  client: ExpandClient,
  anchors: ActionKeyRow[],
  user: SessionUser,
): Promise<string[]> {
  const active = new Set<string>();
  const wantedKeys = new Set<string>();
  const teamIds = new Set<string>();
  const hashes = new Set<string>();

  for (const a of anchors) {
    if (a.localStatus !== "ACTIVE") continue; // on n'étend QUE des ancres ACTIVE
    active.add(a.id);
    if (a.dedupHash == null) continue; // sans dedupHash → reste seule
    wantedKeys.add(groupKeyOf(a));
    teamIds.add(a.teamId);
    hashes.add(a.dedupHash);
  }

  if (wantedKeys.size === 0) return [...active];

  // Superset borné par (équipe, dedupHash) + scope strict ; on re-filtre ensuite
  // par clé EXACTE (même cible) pour ne jamais étendre hors du groupe.
  const rows = await client.importedAction.findMany({
    where: {
      localStatus: "ACTIVE",
      teamId: { in: [...teamIds] },
      dedupHash: { in: [...hashes] },
      ...teamScope(user),
    },
    select: ACTION_KEY_SELECT,
  });
  for (const r of rows) {
    if (wantedKeys.has(groupKeyOf(r))) active.add(r.id);
  }
  return [...active];
}
