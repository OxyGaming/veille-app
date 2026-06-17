/**
 * Agrégateur de la « Fiche de développement individuel » d'un agent.
 *
 * Support de dialogue managérial — pas un score, pas un classement.
 * Le vocabulaire de surface utilise "à valoriser" / "axes de développement"
 * / "points d'attention" plutôt que "forces/faiblesses".
 *
 * Côté périmètre : tous les modèles sources ont `teamId` ; cet agrégateur
 * suppose que l'appelant a déjà validé l'accès à l'agent via `agentScope(u)`.
 * On ne refait pas le filtrage ici pour rester découplé de l'auth.
 */

import { prisma } from "@/lib/prisma";

export type ObservationStatus =
  | "CONFORME"
  | "NON_CONFORME"
  | "A_REVOIR"
  | "NON_OBSERVE"
  | "NON_APPLICABLE";

/** Comptage mensuel des observations par statut, pour le bar chart 12 mois. */
export type MonthlyObservationCount = {
  /** Clé "YYYY-MM" tri-stable. */
  month: string;
  conforme: number;
  aRevoir: number;
  nonConforme: number;
};

/** Comptage par domaine de procédure, pour le bar chart horizontal. */
export type DomainBreakdown = {
  domain: string;
  total: number;
  conforme: number;
  aRevoir: number;
  nonConforme: number;
};

/** Top procédure observée, agrégée sur la période. */
export type TopProcedure = {
  procedureId: string;
  title: string;
  domain: string;
  /** Nombre d'items observés (toutes valeurs non-NO). */
  observedCount: number;
  conformeCount: number;
  aRevoirCount: number;
  nonConformeCount: number;
};

/** Extrait éditorial — un commentaire avec son contexte minimal. */
export type CommentExcerpt = {
  observationItemId: string;
  procedureTitle: string;
  itemLabel: string;
  comment: string;
  status: ObservationStatus;
  recordedAt: string; // ISO
};

/** Récurrence d'une NC sur un même point de checklist. */
export type RecurringNonConformity = {
  checklistItemId: string;
  procedureTitle: string;
  itemLabel: string;
  occurrences: number;
  lastSeenAt: string; // ISO
};

/** Entrée chronologique unifiée (un seul tableau pour la timeline). */
export type TimelineEntry = {
  type: "session" | "sighting" | "note" | "validation" | "action";
  at: string; // ISO
  title: string;
  detail: string | null;
};

/** Tendance globale comparant la 2e moitié de la période à la 1ère. */
export type Trend =
  | "increasing-nc"
  | "decreasing-nc"
  | "stable"
  | "not-enough-data";

export type AgentDevelopmentSummary = {
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string | null;
    teamName: string | null;
  };
  period: { from: string; to: string };
  /** Compteurs synthétiques (tuiles KPI). */
  counts: {
    sessions: number;
    sightings: number;
    notes: number;
    validations: number;
    openActions: number;
    proceduresObserved: number;
    observationsTotal: number;
    conforme: number;
    aRevoir: number;
    nonConforme: number;
  };
  /** Vrai si on a < 3 sessions OU < 3 sightings — affichage avertissement. */
  lowSample: boolean;
  /** Tendance NC : compare 2e moitié de la période à la 1ère. */
  trend: Trend;
  /** Mois "YYYY-MM" → comptes (12 buckets, mois sans obs = zéros). */
  monthly: MonthlyObservationCount[];
  /** Par domaine de procédure, trié par total décroissant. */
  byDomain: DomainBreakdown[];
  /** Top 5 procédures avec le plus de CONFORME (à valoriser). */
  topConforme: TopProcedure[];
  /** Top 5 procédures avec le plus de NC + A_REVOIR (axes de dév). */
  topAxes: TopProcedure[];
  /** NC récurrentes sur un même item (>= 2 occurrences). */
  recurringNCs: RecurringNonConformity[];
  /** Mois "YYYY-MM" SANS aucune session ni sighting. */
  silentMonths: string[];
  /** Jusqu'à 5 commentaires CONFORME (à valoriser). */
  positiveComments: CommentExcerpt[];
  /** Jusqu'à 5 commentaires NC/A_REVOIR (à travailler). */
  attentionComments: CommentExcerpt[];
  /** Timeline chronologique (toutes activités). */
  timeline: TimelineEntry[];
};

/**
 * Construit la fiche de développement pour `agentId` entre `from` et `to`.
 *
 * Aucun filtrage d'accès n'est fait ici — l'appelant doit garantir que
 * l'utilisateur a le droit de lire les données de l'agent (via `agentScope`).
 */
export async function aggregateAgentDevelopment(
  agentId: string,
  from: Date,
  to: Date,
): Promise<AgentDevelopmentSummary | null> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId },
    include: { team: { select: { name: true } } },
  });
  if (!agent) return null;

  const dateRange = { gte: from, lte: to };

  // Requêtes parallèles — toutes scopées par agentId + période.
  const [sessions, sightings, validations, openActions] = await Promise.all([
    prisma.veilleSession.findMany({
      where: { agentId, startedAt: dateRange, status: { not: "archived" } },
      orderBy: { startedAt: "asc" },
      include: {
        procedures: {
          include: {
            procedure: { select: { id: true, title: true, domain: true } },
            items: {
              include: {
                checklistItem: { select: { id: true, label: true } },
              },
            },
          },
        },
        observer: { select: { name: true } },
      },
    }),
    prisma.agentSighting.findMany({
      where: { agentId, sightedAt: dateRange },
      orderBy: { sightedAt: "asc" },
      include: { observer: { select: { name: true } } },
    }),
    prisma.actionValidation.findMany({
      where: { agentId, realizedAt: dateRange },
      orderBy: { realizedAt: "asc" },
      include: {
        action: {
          select: {
            comment: true,
            keyPoint: true,
            theme: true,
            domain: true,
          },
        },
        validatedBy: { select: { name: true } },
      },
    }),
    prisma.importedAction.findMany({
      where: { agentId, localStatus: "ACTIVE" },
      orderBy: { dueAt: "asc" },
      take: 50,
    }),
  ]);

  // Comptages par statut sur la totalité des items observés.
  let conforme = 0;
  let aRevoir = 0;
  let nonConforme = 0;
  let observationsTotal = 0;
  const proceduresSet = new Set<string>();

  // Map procédureId → agrégats pour topConforme / topAxes.
  const procStats = new Map<
    string,
    {
      procedureId: string;
      title: string;
      domain: string;
      conformeCount: number;
      aRevoirCount: number;
      nonConformeCount: number;
      observedCount: number;
    }
  >();

  // Map domaine → agrégats.
  const domainStats = new Map<
    string,
    {
      total: number;
      conforme: number;
      aRevoir: number;
      nonConforme: number;
    }
  >();

  // Map checklistItemId → récurrences NC pour `recurringNCs`.
  const itemNCs = new Map<
    string,
    {
      procedureTitle: string;
      itemLabel: string;
      occurrences: number;
      lastSeenAt: Date;
    }
  >();

  // Mois YYYY-MM → comptes pour `monthly`.
  const monthBuckets = new Map<string, MonthlyObservationCount>();
  const monthKeysInRange: string[] = [];
  {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      monthKeysInRange.push(key);
      monthBuckets.set(key, {
        month: key,
        conforme: 0,
        aRevoir: 0,
        nonConforme: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // Extraits éditoriaux (commentaires) — on garde les plus récents.
  const positiveCandidates: CommentExcerpt[] = [];
  const attentionCandidates: CommentExcerpt[] = [];

  // Mois avec au moins une session (pour silentMonths).
  const monthsWithActivity = new Set<string>();

  for (const session of sessions) {
    const sessionMonth = `${session.startedAt.getFullYear()}-${String(
      session.startedAt.getMonth() + 1,
    ).padStart(2, "0")}`;
    monthsWithActivity.add(sessionMonth);

    for (const po of session.procedures) {
      proceduresSet.add(po.procedureId);
      const procKey = po.procedureId;
      if (!procStats.has(procKey)) {
        procStats.set(procKey, {
          procedureId: po.procedureId,
          title: po.procedure.title,
          domain: po.procedure.domain,
          conformeCount: 0,
          aRevoirCount: 0,
          nonConformeCount: 0,
          observedCount: 0,
        });
      }
      const proc = procStats.get(procKey)!;

      for (const it of po.items) {
        // On exclut NON_OBSERVE et NON_APPLICABLE des stats — sans valeur métier.
        if (it.status === "NON_OBSERVE" || it.status === "NON_APPLICABLE") {
          continue;
        }
        observationsTotal++;
        proc.observedCount++;

        const month = `${it.recordedAt.getFullYear()}-${String(it.recordedAt.getMonth() + 1).padStart(2, "0")}`;
        const bucket = monthBuckets.get(month);

        const domainKey = po.procedure.domain;
        if (!domainStats.has(domainKey)) {
          domainStats.set(domainKey, {
            total: 0,
            conforme: 0,
            aRevoir: 0,
            nonConforme: 0,
          });
        }
        const dom = domainStats.get(domainKey)!;
        dom.total++;

        if (it.status === "CONFORME") {
          conforme++;
          proc.conformeCount++;
          dom.conforme++;
          if (bucket) bucket.conforme++;
          if (it.comment?.trim()) {
            positiveCandidates.push({
              observationItemId: it.id,
              procedureTitle: po.procedure.title,
              itemLabel: it.checklistItem.label,
              comment: it.comment.trim(),
              status: "CONFORME",
              recordedAt: it.recordedAt.toISOString(),
            });
          }
        } else if (it.status === "A_REVOIR") {
          aRevoir++;
          proc.aRevoirCount++;
          dom.aRevoir++;
          if (bucket) bucket.aRevoir++;
          if (it.comment?.trim()) {
            attentionCandidates.push({
              observationItemId: it.id,
              procedureTitle: po.procedure.title,
              itemLabel: it.checklistItem.label,
              comment: it.comment.trim(),
              status: "A_REVOIR",
              recordedAt: it.recordedAt.toISOString(),
            });
          }
          // Récurrence si A_REVOIR / NC sur le même item plusieurs fois.
          countRecurrence(itemNCs, it.checklistItemId, {
            procedureTitle: po.procedure.title,
            itemLabel: it.checklistItem.label,
            seenAt: it.recordedAt,
          });
        } else if (it.status === "NON_CONFORME") {
          nonConforme++;
          proc.nonConformeCount++;
          dom.nonConforme++;
          if (bucket) bucket.nonConforme++;
          if (it.comment?.trim()) {
            attentionCandidates.push({
              observationItemId: it.id,
              procedureTitle: po.procedure.title,
              itemLabel: it.checklistItem.label,
              comment: it.comment.trim(),
              status: "NON_CONFORME",
              recordedAt: it.recordedAt.toISOString(),
            });
          }
          countRecurrence(itemNCs, it.checklistItemId, {
            procedureTitle: po.procedure.title,
            itemLabel: it.checklistItem.label,
            seenAt: it.recordedAt,
          });
        }
      }
    }
  }

  for (const sg of sightings) {
    const m = `${sg.sightedAt.getFullYear()}-${String(sg.sightedAt.getMonth() + 1).padStart(2, "0")}`;
    monthsWithActivity.add(m);
  }

  const sightingsCount = sightings.filter((s) => s.kind === "SIGHT").length;
  const notesCount = sightings.filter((s) => s.kind === "NOTE").length;

  // Tendance NC : on coupe la période en 2 et compare les ratios NC/total.
  const trend = computeTrend(from, to, sessions);

  // Top 5 « à valoriser » : procédures avec le plus de CONFORME.
  const topConforme = [...procStats.values()]
    .filter((p) => p.conformeCount > 0)
    .sort((a, b) => b.conformeCount - a.conformeCount)
    .slice(0, 5);

  // Top 5 axes : procédures avec le plus de NC+A_REVOIR.
  const topAxes = [...procStats.values()]
    .filter((p) => p.nonConformeCount + p.aRevoirCount > 0)
    .sort(
      (a, b) =>
        b.nonConformeCount + b.aRevoirCount - (a.nonConformeCount + a.aRevoirCount),
    )
    .slice(0, 5);

  // Récurrences : items avec >= 2 occurrences.
  const recurringNCs = [...itemNCs.entries()]
    .filter(([, v]) => v.occurrences >= 2)
    .map(([id, v]) => ({
      checklistItemId: id,
      procedureTitle: v.procedureTitle,
      itemLabel: v.itemLabel,
      occurrences: v.occurrences,
      lastSeenAt: v.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const byDomain = [...domainStats.entries()]
    .map(([domain, s]) => ({ domain, ...s }))
    .sort((a, b) => b.total - a.total);

  // Mois sans activité : ceux de la période moins ceux qui en ont eu.
  const silentMonths = monthKeysInRange.filter(
    (m) => !monthsWithActivity.has(m),
  );

  // Tri éditorial : on garde 5 commentaires les plus récents.
  positiveCandidates.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  attentionCandidates.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  const positiveComments = positiveCandidates.slice(0, 5);
  const attentionComments = attentionCandidates.slice(0, 5);

  const lowSample = sessions.length < 3 && sightings.length < 3;

  // Timeline unifiée.
  const timeline: TimelineEntry[] = [
    ...sessions.map((s): TimelineEntry => ({
      type: "session" as const,
      at: s.startedAt.toISOString(),
      title: "Session de veille",
      detail: s.observer?.name ? `Observé par ${s.observer.name}` : null,
    })),
    ...sightings.map((sg): TimelineEntry => ({
      type: sg.kind === "NOTE" ? ("note" as const) : ("sighting" as const),
      at: sg.sightedAt.toISOString(),
      title: sg.kind === "NOTE" ? "Commentaire managérial" : "Vu en poste",
      detail: sg.comment?.trim() || null,
    })),
    ...validations.map((v): TimelineEntry => ({
      type: "validation" as const,
      at: v.realizedAt.toISOString(),
      title:
        v.action.comment ||
        v.action.keyPoint ||
        v.action.theme ||
        v.action.domain ||
        "Action validée",
      detail: v.comment?.trim() || null,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    agent: {
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      matricule: agent.matricule,
      teamName: agent.team?.name ?? null,
    },
    period: { from: from.toISOString(), to: to.toISOString() },
    counts: {
      sessions: sessions.length,
      sightings: sightingsCount,
      notes: notesCount,
      validations: validations.length,
      openActions: openActions.length,
      proceduresObserved: proceduresSet.size,
      observationsTotal,
      conforme,
      aRevoir,
      nonConforme,
    },
    lowSample,
    trend,
    monthly: monthKeysInRange.map(
      (k) => monthBuckets.get(k) ?? { month: k, conforme: 0, aRevoir: 0, nonConforme: 0 },
    ),
    byDomain,
    topConforme,
    topAxes,
    recurringNCs,
    silentMonths,
    positiveComments,
    attentionComments,
    timeline,
  };
}

function countRecurrence(
  map: Map<
    string,
    {
      procedureTitle: string;
      itemLabel: string;
      occurrences: number;
      lastSeenAt: Date;
    }
  >,
  itemId: string,
  data: { procedureTitle: string; itemLabel: string; seenAt: Date },
) {
  const existing = map.get(itemId);
  if (!existing) {
    map.set(itemId, {
      procedureTitle: data.procedureTitle,
      itemLabel: data.itemLabel,
      occurrences: 1,
      lastSeenAt: data.seenAt,
    });
    return;
  }
  existing.occurrences++;
  if (data.seenAt > existing.lastSeenAt) {
    existing.lastSeenAt = data.seenAt;
  }
}

/**
 * Calcule la tendance NC en comparant les 2 moitiés de la période.
 * Renvoie "not-enough-data" si l'une des 2 moitiés a < 3 observations
 * (le ratio n'est pas significatif sur si peu).
 */
function computeTrend(
  from: Date,
  to: Date,
  sessions: Array<{
    procedures: Array<{
      items: Array<{ status: string; recordedAt: Date }>;
    }>;
  }>,
): Trend {
  const mid = new Date((from.getTime() + to.getTime()) / 2);
  let firstHalfNc = 0;
  let firstHalfTotal = 0;
  let secondHalfNc = 0;
  let secondHalfTotal = 0;
  for (const s of sessions) {
    for (const po of s.procedures) {
      for (const it of po.items) {
        if (it.status === "NON_OBSERVE" || it.status === "NON_APPLICABLE") {
          continue;
        }
        if (it.recordedAt < mid) {
          firstHalfTotal++;
          if (it.status === "NON_CONFORME") firstHalfNc++;
        } else {
          secondHalfTotal++;
          if (it.status === "NON_CONFORME") secondHalfNc++;
        }
      }
    }
  }
  if (firstHalfTotal < 3 || secondHalfTotal < 3) return "not-enough-data";
  const firstRate = firstHalfNc / firstHalfTotal;
  const secondRate = secondHalfNc / secondHalfTotal;
  const delta = secondRate - firstRate;
  // Seuil de 5 points de NC pour qualifier de "tendance" (sinon stable).
  if (delta > 0.05) return "increasing-nc";
  if (delta < -0.05) return "decreasing-nc";
  return "stable";
}
