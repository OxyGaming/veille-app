/**
 * Validation automatique des actions d'un agent à partir des points clés
 * observés dans une veille.
 *
 * Règle métier (cf. spec produit) :
 *   - On considère qu'une veille « observe » un point clé dès qu'il
 *     apparaît dans une `ProcedureObservation` de la session — peu
 *     importe le statut de l'observation (l'utilisateur reste maître
 *     du choix de valider via la modale de confirmation).
 *   - Une action est candidate à la validation automatique si :
 *     * elle appartient à l'agent ciblé par la veille ;
 *     * elle appartient à l'ÉQUIPE de la veille (`teamId` de la session) —
 *       cloisonnement : on ne propose pas une action d'une autre équipe de
 *       l'agent (qui serait de toute façon refusée par la route validate) ;
 *     * son `localStatus = ACTIVE` (les autres statuts sont ignorés
 *       — déjà validée, remplacée, obsolète) ;
 *     * son `keyPoint.startsWith(pointObservé)` (comparaison sensible
 *       aux caractères, pas de fuzzy matching, pas de normalisation
 *       d'accents : on veut une équivalence stricte pour éviter toute
 *       validation accidentelle).
 *   - Une action ne remonte qu'une seule fois même si plusieurs points
 *     clés ou plusieurs occurrences d'un même point clé la matchent
 *     (dédup par `action.id`).
 *
 * La validation effective réutilise la route existante
 * `POST /api/actions/[id]/validate` — aucune logique métier n'est
 * dupliquée ici. Ce module ne fait que la **détection** des candidats.
 */

import { prisma } from "@/lib/prisma";

/**
 * Sous-type minimum d'une action utilisée par la logique de matching pur.
 * Sert aussi à découpler le pur du wrapper Prisma pour les tests.
 */
export type MatchableAction = {
  id: string;
  keyPoint: string | null;
};

/**
 * Résultat de matching enrichi : pointe sur le point clé qui a déclenché
 * la correspondance, utile pour l'UI (texte d'explication / regroupement).
 */
export type AutoValidableAction = {
  id: string;
  externalId: string;
  keyPoint: string;
  comment: string | null;
  dueAt: Date | null;
  /** Le point clé observé qui a matché (premier matching trouvé). */
  matchedBy: string;
};

/**
 * Fonction pure — matching `startsWith` strict avec dédup.
 *
 * Exposée séparément pour permettre les tests sans I/O et garantir que la
 * règle de comparaison reste centralisée (pas de duplication côté UI).
 */
export function matchActionsByKeyPoint<A extends MatchableAction>(
  actions: A[],
  observedKeyPoints: readonly string[],
): { action: A; matchedBy: string }[] {
  const points = [
    ...new Set(
      observedKeyPoints
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0),
    ),
  ];
  if (points.length === 0) return [];
  const seenActionIds = new Set<string>();
  const out: { action: A; matchedBy: string }[] = [];
  for (const a of actions) {
    if (!a.keyPoint) continue;
    if (seenActionIds.has(a.id)) continue;
    for (const p of points) {
      if (a.keyPoint.startsWith(p)) {
        out.push({ action: a, matchedBy: p });
        seenActionIds.add(a.id);
        break;
      }
    }
  }
  return out;
}

/**
 * Récupère les « points clés » observés dans une session de veille,
 * dédupliqués. Couvre deux niveaux pour matcher au plus large :
 *
 *  - le **titre de chaque procédure observée** (`Procedure.title`) — c'est
 *    le cas standard métier : les `keyPoint` des actions importées
 *    correspondent presque toujours à un titre de procédure (cf. format
 *    Excel d'import) ;
 *  - les **libellés des items de checklist** (`ChecklistItem.label`) — pour
 *    couvrir le cas où une action vise un sous-point précis.
 *
 * Aucun filtre de statut : on inclut tous les items des
 * `ProcedureObservation` de la session (cf. spec § « Point clé répété
 * plusieurs fois dans la veille → ne déclenche qu'une seule proposition »
 * — c'est garanti par la dédup `Set`).
 */
export async function getObservedKeyPointsForSession(
  sessionId: string,
): Promise<string[]> {
  if (!sessionId) return [];
  const [procedureRows, itemRows] = await Promise.all([
    prisma.procedureObservation.findMany({
      where: { sessionId },
      select: { procedure: { select: { title: true } } },
    }),
    prisma.observationItem.findMany({
      where: { procedureObservation: { sessionId } },
      select: { checklistItem: { select: { label: true } } },
    }),
  ]);
  const set = new Set<string>();
  for (const r of procedureRows) {
    const t = r.procedure?.title?.trim();
    if (t) set.add(t);
  }
  for (const r of itemRows) {
    const lbl = r.checklistItem?.label?.trim();
    if (lbl) set.add(lbl);
  }
  return [...set];
}

/**
 * Recherche les actions auto-validables pour un agent à partir d'une liste
 * de points clés observés.
 *
 * Court-circuit si `agentId` vide ou liste vide — pas d'appel Prisma.
 */
export async function findAutoValidableActions(
  agentId: string | null | undefined,
  observedKeyPoints: readonly string[],
  /** Équipe de la veille — restreint les candidats à cette équipe (cloisonnement). */
  teamId?: string | null,
): Promise<AutoValidableAction[]> {
  if (!agentId) return [];
  if (observedKeyPoints.length === 0) return [];
  const rawActions = await prisma.importedAction.findMany({
    where: {
      agentId,
      localStatus: "ACTIVE",
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id: true,
      externalId: true,
      keyPoint: true,
      comment: true,
      dueAt: true,
    },
    orderBy: { dueAt: "asc" },
  });
  return matchActionsByKeyPoint(rawActions, observedKeyPoints).map(
    ({ action, matchedBy }) => ({
      id: action.id,
      externalId: action.externalId,
      keyPoint: action.keyPoint as string,
      comment: action.comment ?? null,
      dueAt: action.dueAt ?? null,
      matchedBy,
    }),
  );
}

/**
 * Helper d'orchestration : depuis un `sessionId`, retourne la liste des
 * actions auto-validables pour son agent. Court-circuit si la session
 * n'a pas d'agent ciblé (cf. spec — les veilles sans agent ne déclenchent
 * pas la proposition).
 */
export async function findAutoValidableActionsForSession(
  sessionId: string,
): Promise<AutoValidableAction[]> {
  const session = await prisma.veilleSession.findUnique({
    where: { id: sessionId },
    select: { agentId: true, teamId: true },
  });
  if (!session?.agentId) return [];
  const points = await getObservedKeyPointsForSession(sessionId);
  return findAutoValidableActions(session.agentId, points, session.teamId);
}
