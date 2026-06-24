/**
 * Agrégateur du Dashboard Pilotage (Sprint 5 C7).
 *
 * Réutilise au maximum :
 *  - `aggregateEcheances` (Sprint 4 C4) pour la matière brute des items
 *    (visites, équipements, actions à échéance) + scopes via siteScope.
 *  - `siteScope` / `actionScope` (Sprint 1+) pour le périmètre EDITOR.
 *  - `getEditorWeekCounters` est laissé inchangé (Today reste autonome).
 *
 * Ajoute uniquement :
 *  - calcul des KPI dérivés des items (sites sans trim, sans plan,
 *    équipements expirés) — réduction in-memory plutôt que nouvelles
 *    requêtes Prisma.
 *  - tendances par jour sur N jours (30 ou 90) : TeamActivity,
 *    Notification, SiteVisit completed, ActionValidation.
 */

import {
  actionScope,
  siteScope,
  teamScope,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateEcheances } from "@/lib/echeances/aggregator";
import type { EcheanceItem } from "@/lib/echeances/types";

export type DashboardPeriod = 30 | 90;

export type DashboardFilters = {
  period: DashboardPeriod;
  /**
   * Sprint 6 C6 — DÉPRÉCIÉ : le scope ADMIN est désormais résolu via
   * le badge header (`resolveAdminScope`). Conservé pour rétro-compat
   * du payload mais ignoré dans `aggregateDashboard`. À retirer Sprint 7+.
   */
  teamId?: string | null;
};

export type DashboardKpis = {
  criticalCount: number;
  openActions: number;
  lateActions: number;
  sitesWithoutQuarterly: number;
  sitesWithoutPlanned: number;
  expiredEquipments: number;
};

export type DashboardTrend = {
  label: string;
  total: number;
  series: number[]; // 1 entrée par jour, longueur = period
};

/** C13 — Catégorisation V1 des NC par template. */
export type NcKind = "INVENTORY" | "QUARTERLY" | "PLANNED" | "OTHER";

/** Une non-conformité ouverte affichée dans la liste détaillée du dashboard. */
export type DashboardOpenNcItem = {
  id: string;
  kind: NcKind;
  kindLabel: string;
  siteId: string;
  siteName: string;
  /** Description courte de la NC (tronquée côté UI si besoin). */
  description: string;
  /** Date de détection (ISO 8601 — `createdAt` de la NC). */
  detectedAt: string;
  /** Lien direct vers le rapport de visite d'où vient la NC. */
  visitReportUrl: string;
  /**
   * C15 — Action ImportedAction liée à la NC (via generatedActionId).
   * Null si la NC n'a pas généré d'action (cas rare, NC saisie manuellement
   * avec generateAction=false).
   */
  actionId: string | null;
};

export type DashboardOpenNCs = {
  /** Total des NC non redressées dans le périmètre. */
  total: number;
  /** Compteurs par catégorie de visite (rendu en chips). */
  byKind: { kind: NcKind; label: string; count: number }[];
  /**
   * C13.3 — Liste détaillée des NC, triées par date détection desc
   * (les plus récentes en premier). Cap à 100 pour éviter un payload
   * géant — un compteur `extra` indique le surplus.
   */
  items: DashboardOpenNcItem[];
  /** Nombre de NC non incluses dans `items` (au-delà du cap). */
  extra: number;
};

/** Une cible (agent ou site) encore en attente sur un groupe d'actions. */
export type DashboardActionTarget =
  | {
      kind: "agent";
      agentId: string;
      label: string;
    }
  | {
      kind: "site";
      siteId: string;
      label: string;
    }
  | {
      kind: "none";
      /** Action sans agent ni site (rare — actions importées historiques). */
      label: string;
    };

export type DashboardActionGroup = {
  /** Titre métier (keyPoint) — tronqué côté UI si besoin. */
  title: string;
  done: number;
  total: number;
  /** done / total × 100, arrondi entier. 0 si total=0 (cas impossible côté agg). */
  percent: number;
  /**
   * C13.1 — Cibles encore ACTIVE dans le groupe (agents non vus, sites
   * non traités). Triées par nom asc. Caple à 50 pour éviter un payload
   * géant côté HTML — un compteur `pendingExtra` indique le surplus.
   */
  pending: DashboardActionTarget[];
  pendingExtra: number;
  /**
   * C13.2 — Plan d'origine si TOUTES les actions du groupe partagent
   * la même valeur (cohérence métier). Sinon `null` (groupe mixte).
   */
  planLabel: string | null;
  /**
   * C13.2 — Échéance la plus pressante parmi les actions ACTIVE du
   * groupe (ISO 8601). `null` si aucune action n'a de date.
   */
  nextDueAt: string | null;
};

export type DashboardActionsProgress = {
  /** Groupes ayant au moins 1 action ACTIVE. Tri : moins avancés en premier (priorité visuelle). */
  items: DashboardActionGroup[];
  /** Nombre total de groupes distincts avant la limite affichée. */
  totalGroups: number;
};

export type DashboardTopSite = {
  siteId: string;
  siteName: string;
  openNCs: number;
  openActions: number;
  /** Score composite (NC × 2 + actions). Tri primaire. */
  score: number;
};

export type DashboardPayload = {
  filters: DashboardFilters;
  kpis: DashboardKpis;
  trends: {
    activity: DashboardTrend;
    notifications: DashboardTrend;
    visits: DashboardTrend;
    validations: DashboardTrend;
  };
  /** C13 — NC non redressées par type de visite. */
  openNonConformities: DashboardOpenNCs;
  /** C13 — Actions actives groupées par titre, avec ratio validé/total. */
  actionsProgress: DashboardActionsProgress;
  /** C13 — Top 5 sites prioritaires (NC ouvertes + actions actives). */
  topSites: DashboardTopSite[];
  teamsAvailable: { id: string; name: string }[];
};

const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Construit une série de length `period`, alignée jour par jour (date Paris/local). */
function bucketByDay(
  rows: { createdAt?: Date; finishedAt?: Date | null }[],
  field: "createdAt" | "finishedAt",
  period: number,
  now: Date,
): number[] {
  const buckets = new Array<number>(period).fill(0);
  const startMs = new Date(now.getTime() - (period - 1) * DAY_MS).setHours(
    0,
    0,
    0,
    0,
  );
  for (const r of rows) {
    const at = r[field];
    if (!at) continue;
    const dayIdx = Math.floor((at.getTime() - startMs) / DAY_MS);
    if (dayIdx >= 0 && dayIdx < period) buckets[dayIdx]++;
  }
  return buckets;
}

function countItems(items: EcheanceItem[], kind: EcheanceItem["kind"]) {
  return items.filter((i) => i.kind === kind).length;
}

/**
 * C13 — Classifie une NC par catégorie de visite à partir du template.
 *
 * Convention seed actuelle :
 *  - INVENTORY (template.kind)    → « Veille de site »
 *  - CHECKLIST + slug "trimestrielle-*" → « Trimestrielle »
 *  - CHECKLIST + slug "planifiee-*"     → « Planifiée »
 *  - autre                              → « Autre » (fallback safe)
 */
export function classifyNcKind(template: {
  kind: string | null | undefined;
  slug: string | null | undefined;
}): NcKind {
  if (template.kind === "INVENTORY") return "INVENTORY";
  const slug = template.slug ?? "";
  if (slug.startsWith("trimestrielle")) return "QUARTERLY";
  if (slug.startsWith("planifiee")) return "PLANNED";
  return "OTHER";
}

const NC_KIND_LABEL: Record<NcKind, string> = {
  INVENTORY: "Veille de site",
  QUARTERLY: "Trimestrielle",
  PLANNED: "Planifiée",
  OTHER: "Autre",
};

/**
 * C13 — Tronque le titre métier à `max` chars (ellipse). Pure helper
 * exporté pour tests. Sert le rendu des barres de progression côté UI.
 */
export function truncateTitle(text: string | null | undefined, max = 80): string {
  const t = (text ?? "").trim();
  if (!t) return "(sans titre)";
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function countLateKind(items: EcheanceItem[], kind: EcheanceItem["kind"]) {
  return items.filter(
    (i) =>
      i.kind === kind &&
      (i.daysToDue === null || (typeof i.daysToDue === "number" && i.daysToDue < 0)),
  ).length;
}

async function getTeamsAvailable(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  if (user.role === "ADMIN" || user.viewAllTeams) {
    return prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  if (!user.teamIds.length) return [];
  return prisma.team.findMany({
    where: { id: { in: user.teamIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Compteurs Notification — sémantique par rôle/scope (Sprint 6 C6) :
 *  - ADMIN GLOBAL : count global (toutes notifs) — vue système
 *  - ADMIN MY_TEAMS ou TEAM : count personnel — vue cohérente avec le
 *    périmètre choisi (notifs ECHEANCE_CRITICAL_ON_MY_PERIMETER de
 *    l'ADMIN sont déjà filtrées par son scope via S6 C5)
 *  - EDITOR / USER : count personnel (inchangé)
 *
 * Sans modèle team-scoped sur Notification, on garde la convention
 * « ADMIN MY_TEAMS/TEAM ≈ vue EDITOR personnelle » qui reste cohérente
 * avec ses autres KPI. Cf. memory/decisions.md.
 */
async function getNotificationCounts(
  user: SessionUser,
  windowStart: Date,
): Promise<{ createdAt: Date }[]> {
  const isAdminGlobal =
    user.role === "ADMIN" &&
    (user.adminScopeMode === null ||
      user.adminScopeMode === undefined ||
      user.adminScopeMode === "GLOBAL");
  const where: Record<string, unknown> = isAdminGlobal
    ? { createdAt: { gte: windowStart } }
    : { userId: user.id, createdAt: { gte: windowStart } };
  return prisma.notification.findMany({
    where,
    select: { createdAt: true },
    take: 10_000,
  });
}

/** Construit le payload complet du dashboard. */
export async function aggregateDashboard(
  user: SessionUser,
  now: Date,
  filters: DashboardFilters,
): Promise<DashboardPayload> {
  const period = filters.period === 90 ? 90 : 30;
  const windowStart = new Date(
    now.getTime() - (period - 1) * DAY_MS,
  );
  windowStart.setHours(0, 0, 0, 0);

  // 1. Échéances (matière brute) — réutilise l'agrégateur Sprint 4.
  //    Sprint 6 C6 : le filtre teamId local est désormais supplanté par
  //    le scope ADMIN persisté (badge header). Les helpers Prisma
  //    (siteScope / actionScope) appliquent déjà la restriction via
  //    C5. On n'a plus rien à passer ici.
  const [
    echeances,
    openActionsCount,
    lateActionsCount,
    activityRows,
    notifRows,
    visitsRows,
    validationsRows,
    openNcRows,
    actionGroupRows,
    teamsAvailable,
  ] = await Promise.all([
    aggregateEcheances(user, now),
    prisma.importedAction.count({
      where: { ...actionScope(user), localStatus: "ACTIVE" },
    }),
    prisma.importedAction.count({
      where: {
        ...actionScope(user),
        localStatus: "ACTIVE",
        dueAt: { not: null, lt: now },
      },
    }),
    prisma.teamActivity.findMany({
      where: { ...teamScope(user), createdAt: { gte: windowStart } },
      select: { createdAt: true },
      take: 10_000,
    }),
    getNotificationCounts(user, windowStart),
    prisma.siteVisit.findMany({
      where: {
        ...teamScope(user),
        status: "completed",
        finishedAt: { gte: windowStart, lte: now },
      },
      select: { finishedAt: true },
      take: 10_000,
    }),
    prisma.actionValidation.findMany({
      where: {
        action: actionScope(user),
        createdAt: { gte: windowStart },
      },
      select: { createdAt: true },
      take: 10_000,
    }),
    // C13 — NC non redressées dans le scope (via teamScope sur SiteVisit).
    // C13.3 — Select enrichi avec description + createdAt pour la liste
    // détaillée affichée dans le dashboard.
    prisma.siteVisitNonConformity.findMany({
      where: {
        redressedDate: null,
        visit: teamScope(user),
        // C16 — Masque les NC fantômes : action liée mais déjà validée
        // (REPLACED / OBSOLETE / VALIDATED_LOCAL). Le dashboard ne montre
        // que les NC réellement actionnables :
        //   - NC sans action liée (à redresser manuellement depuis le
        //     rapport de visite)
        //   - NC dont l'action est encore ACTIVE
        // Les fantômes (action déjà VALIDATED_LOCAL sans redressement)
        // sont nettoyés par scripts/fix-orphan-ncs.mjs.
        OR: [
          { generatedActionId: null },
          { generatedAction: { localStatus: "ACTIVE" } },
        ],
      },
      select: {
        id: true,
        description: true,
        createdAt: true,
        // C15 — generatedActionId pour activer la validation depuis le dashboard.
        generatedActionId: true,
        visit: {
          select: {
            id: true,
            siteId: true,
            site: { select: { id: true, name: true } },
            template: { select: { kind: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    }),
    // C13 — Toutes les actions du périmètre (ACTIVE + VALIDATED_LOCAL)
    // pour calculer les ratios par keyPoint.
    // C13.1 — Ajout du select agent pour récupérer les cibles en attente.
    // C13.2 — Ajout actionPlan + dueAt pour le sous-titre + chip échéance.
    prisma.importedAction.findMany({
      where: {
        ...actionScope(user),
        localStatus: { in: ["ACTIVE", "VALIDATED_LOCAL"] },
      },
      select: {
        keyPoint: true,
        localStatus: true,
        siteId: true,
        site: { select: { id: true, name: true } },
        agentId: true,
        agent: {
          select: { id: true, firstName: true, lastName: true },
        },
        actionPlan: true,
        dueAt: true,
      },
      take: 10_000,
    }),
    getTeamsAvailable(user),
  ]);

  // Items « late » dans le payload Sprint 4 = (urgency=late) — couvre
  // déjà « jamais visité » + « retard ». On les exploite directement.
  const lateItems = echeances.groups.late;

  const kpis: DashboardKpis = {
    criticalCount: echeances.kpis.critical,
    openActions: openActionsCount,
    lateActions: lateActionsCount,
    sitesWithoutQuarterly: countItems(lateItems, "VISIT_QUARTERLY"),
    sitesWithoutPlanned: countItems(lateItems, "VISIT_PLANNED"),
    expiredEquipments: countLateKind(lateItems, "EQUIPMENT_EXPIRING"),
  };

  const series = {
    activity: bucketByDay(activityRows, "createdAt", period, now),
    notifications: bucketByDay(notifRows, "createdAt", period, now),
    visits: bucketByDay(
      visitsRows.map((v) => ({ finishedAt: v.finishedAt })),
      "finishedAt",
      period,
      now,
    ),
    validations: bucketByDay(validationsRows, "createdAt", period, now),
  };

  // ─── C13 — NC non redressées par catégorie de visite ─────────────────────
  // C13.3 — En plus du décompte par catégorie, on expose la liste
  // détaillée des NC (site, description, date) pour un pilotage concret.
  const NC_LIST_CAP = 100;
  const ncCountByKind: Record<NcKind, number> = {
    INVENTORY: 0,
    QUARTERLY: 0,
    PLANNED: 0,
    OTHER: 0,
  };
  const ncItemsAll: DashboardOpenNcItem[] = [];
  for (const nc of openNcRows) {
    const kind = classifyNcKind(nc.visit.template);
    ncCountByKind[kind]++;
    if (!nc.visit.site) continue;
    ncItemsAll.push({
      id: nc.id,
      kind,
      kindLabel: NC_KIND_LABEL[kind],
      siteId: nc.visit.site.id,
      siteName: nc.visit.site.name,
      description: truncateTitle(nc.description, 140),
      detectedAt: nc.createdAt.toISOString(),
      visitReportUrl: `/visits/${nc.visit.id}/report`,
      actionId: nc.generatedActionId,
    });
  }
  // L'ordre des kinds importe pour le rendu (gauche → droite).
  const openNonConformities: DashboardOpenNCs = {
    total: openNcRows.length,
    byKind: (["INVENTORY", "QUARTERLY", "PLANNED", "OTHER"] as NcKind[])
      // C13.3 — Ne montre que les catégories avec au moins 1 NC ouverte
      // pour réduire le bruit visuel.
      .filter((k) => ncCountByKind[k] > 0)
      .map((k) => ({
        kind: k,
        label: NC_KIND_LABEL[k],
        count: ncCountByKind[k],
      })),
    items: ncItemsAll.slice(0, NC_LIST_CAP),
    extra: Math.max(0, ncItemsAll.length - NC_LIST_CAP),
  };

  // ─── C13 — Actions agrégées par titre ────────────────────────────────────
  // C13.1 — Pour chaque groupe, on collecte aussi la liste des cibles
  // (agent ou site) ACTIVE pour permettre le détail au clic côté UI.
  // C13.2 — On ajoute le plan d'origine partagé + l'échéance la plus
  //         proche pour donner du contexte de pilotage.
  const PENDING_CAP = 50;
  type AggrAction = {
    done: number;
    total: number;
    pending: DashboardActionTarget[];
    /** Set des actionPlan rencontrés (null inclus) — pour test unicité. */
    plans: Set<string | null>;
    /** Premier plan non-null observé (pour exposer la valeur si unique). */
    firstPlan: string | null;
    /** Date la plus proche parmi les actions ACTIVE. */
    nextDueAt: Date | null;
  };
  const actionByTitle = new Map<string, AggrAction>();
  for (const a of actionGroupRows) {
    const title = truncateTitle(a.keyPoint);
    const agg = actionByTitle.get(title) ?? {
      done: 0,
      total: 0,
      pending: [] as DashboardActionTarget[],
      plans: new Set<string | null>(),
      firstPlan: null,
      nextDueAt: null,
    };
    agg.total++;
    const planNorm = a.actionPlan?.trim() || null;
    agg.plans.add(planNorm);
    if (planNorm && !agg.firstPlan) agg.firstPlan = planNorm;
    if (a.localStatus === "VALIDATED_LOCAL") {
      agg.done++;
    } else {
      // ACTIVE → on note la cible en attente (dédupliquée plus bas).
      if (a.agent) {
        const label = `${a.agent.lastName} ${a.agent.firstName}`.trim();
        agg.pending.push({ kind: "agent", agentId: a.agent.id, label });
      } else if (a.site) {
        agg.pending.push({
          kind: "site",
          siteId: a.site.id,
          label: a.site.name,
        });
      } else {
        agg.pending.push({ kind: "none", label: "(sans cible)" });
      }
      // Échéance la plus proche calculée uniquement sur les ACTIVE
      // (une action déjà validée n'a plus de pression d'échéance).
      if (a.dueAt && (!agg.nextDueAt || a.dueAt < agg.nextDueAt)) {
        agg.nextDueAt = a.dueAt;
      }
    }
    actionByTitle.set(title, agg);
  }
  const allGroups: DashboardActionGroup[] = [];
  for (const [title, agg] of actionByTitle) {
    // On garde uniquement les groupes ayant encore au moins 1 action ACTIVE
    // (sinon le groupe est "fini" et ne mérite pas une barre).
    if (agg.total - agg.done <= 0) continue;
    const percent = Math.round((agg.done / agg.total) * 100);
    // C13.1 — Déduplique par identité (agentId / siteId) pour éviter
    // les doublons quand un même agent a 2 actions ACTIVE distinctes
    // sur le même keyPoint (cas typique des dedupHash).
    const seen = new Set<string>();
    const uniquePending = agg.pending.filter((t) => {
      const key =
        t.kind === "agent"
          ? `a:${t.agentId}`
          : t.kind === "site"
            ? `s:${t.siteId}`
            : `n:${t.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Tri pending par label asc — stable et lisible côté UI.
    uniquePending.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const pendingCapped = uniquePending.slice(0, PENDING_CAP);
    const pendingExtra = Math.max(0, uniquePending.length - PENDING_CAP);
    // C13.2 — Plan exposé uniquement si toutes les actions partagent
    // la même valeur (un seul élément dans le Set). Sinon on n'affiche
    // rien plutôt que d'induire en erreur sur l'origine.
    const planLabel = agg.plans.size === 1 ? agg.firstPlan : null;
    allGroups.push({
      title,
      done: agg.done,
      total: agg.total,
      percent,
      pending: pendingCapped,
      pendingExtra,
      planLabel,
      nextDueAt: agg.nextDueAt ? agg.nextDueAt.toISOString() : null,
    });
  }
  // Tri : moins avancés (% croissant) puis taille (total décroissant)
  // pour mettre les gros chantiers en haut.
  allGroups.sort((a, b) => a.percent - b.percent || b.total - a.total);
  // C13.2 — Cap retiré : on affiche tous les groupes pour éviter qu'une
  // action nouvellement créée disparaisse silencieusement du dashboard.
  // Le scroll vertical côté UI gère la lisibilité quand la liste devient
  // longue.
  const actionsProgress: DashboardActionsProgress = {
    items: allGroups,
    totalGroups: allGroups.length,
  };

  // ─── C13 — Top sites prioritaires ────────────────────────────────────────
  type SiteAccu = { siteName: string; openNCs: number; openActions: number };
  const siteAccu = new Map<string, SiteAccu>();
  for (const nc of openNcRows) {
    if (!nc.visit.site) continue;
    const sid = nc.visit.site.id;
    const acc = siteAccu.get(sid) ?? {
      siteName: nc.visit.site.name,
      openNCs: 0,
      openActions: 0,
    };
    acc.openNCs++;
    siteAccu.set(sid, acc);
  }
  for (const a of actionGroupRows) {
    if (a.localStatus !== "ACTIVE") continue;
    if (!a.site) continue;
    const sid = a.site.id;
    const acc = siteAccu.get(sid) ?? {
      siteName: a.site.name,
      openNCs: 0,
      openActions: 0,
    };
    acc.openActions++;
    siteAccu.set(sid, acc);
  }
  const topSites: DashboardTopSite[] = [...siteAccu.entries()]
    .map(([siteId, acc]) => ({
      siteId,
      siteName: acc.siteName,
      openNCs: acc.openNCs,
      openActions: acc.openActions,
      // Score composite : NC pèsent double (engagement métier plus lourd
      // qu'une action ad-hoc).
      score: acc.openNCs * 2 + acc.openActions,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.openNCs - a.openNCs ||
        b.openActions - a.openActions,
    )
    .slice(0, 5);

  return {
    // Sprint 6 C6 : teamId neutralisé (le scope ADMIN supplante).
    filters: { period, teamId: null },
    kpis,
    trends: {
      activity: {
        label: "Activité",
        total: series.activity.reduce((a, b) => a + b, 0),
        series: series.activity,
      },
      notifications: {
        label: "Notifications créées",
        total: series.notifications.reduce((a, b) => a + b, 0),
        series: series.notifications,
      },
      visits: {
        label: "Visites réalisées",
        total: series.visits.reduce((a, b) => a + b, 0),
        series: series.visits,
      },
      validations: {
        label: "Actions validées",
        total: series.validations.reduce((a, b) => a + b, 0),
        series: series.validations,
      },
    },
    openNonConformities,
    actionsProgress,
    topSites,
    teamsAvailable,
  };
}

// Helpers exportés pour tests unitaires.
export const __test = { bucketByDay, countItems, countLateKind, ymd };
