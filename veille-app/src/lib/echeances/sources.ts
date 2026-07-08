/**
 * Sources Prisma unifiées du Hub Échéances (Sprint 4 C3).
 *
 * Chaque source renvoie une liste d'`EcheanceItem` scopée au périmètre
 * de l'utilisateur. Toutes les sources sont sûres en multi-équipes et
 * utilisent les helpers existants (`siteScope`, `actionScope`).
 *
 * Conventions importantes :
 *  - Slug visite trim : `trimestrielle-*` (cf. memory/business-rules.md)
 *  - Slug visite plan : `planifiee-*`
 *  - Cadences : 90 / 180 / 365 (selon `Site.isOccupied`)
 *  - Pas de N+1 : 1 seul `findMany` par source, agrégations en JS.
 */

import { actionScope, siteScope, teamScope, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  classifyVisitTemplateSlug,
  visitFrequencyDays,
  S6A7_TOLERANCE_DAYS,
} from "@/lib/today/constants";
import { log } from "@/lib/logger";
import { isCriticalEcheance } from "./criticality";
import { ctaForEcheance } from "./cta";
import { classifyEcheanceUrgency } from "./urgency";
import {
  actionEcheanceStateAt,
  echeanceBounds,
  isOverdue,
} from "./action-echeance";
import { dedupActions } from "@/lib/actions/dedup";
import type { EcheanceItem, EcheanceUrgency } from "./types";
import { differenceInCalendarDays } from "date-fns";
import { vehicleTypeLabel } from "@/lib/vehicle-types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fenêtre maximale pour les équipements (V1 — déjà périmés OU ≤ 30 j). */
const EQUIPMENT_WINDOW_DAYS = 30;

/** Garde-fou volumes — au-delà, on log un warning et on tronque. */
const VISIT_SITES_MAX = 500;
const VISIT_PER_SITE_HISTORY = 20;
const EQUIPMENT_MAX = 200;
const ACTION_MAX = 500;
/** Fréquence par défaut des tournées VS (slug `tournee-vs`, 180 j). */
const VEHICLE_ROUND_DEFAULT_FREQ = 180;
const VEHICLE_MAX = 500;
const VEHICLE_PER_HISTORY = 5;

// ─── Helpers purs internes ───────────────────────────────────────────────────

function diffDaysFloor(target: Date, now: Date): number {
  return Math.floor((target.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Construit l'`EcheanceItem` d'une visite (trim ou plan) pour un site donné.
 * `lastVisitDate = null` → jamais visité, dueAt = null, daysToDue = null.
 */
function buildVisitEcheance(
  kind: "VISIT_QUARTERLY" | "VISIT_PLANNED" | "VISIT_S6A7",
  site: { id: string; name: string; isOccupied: boolean; teamIds: string[] },
  lastVisitDate: Date | null,
  now: Date,
): EcheanceItem {
  const cadence =
    kind === "VISIT_QUARTERLY"
      ? "quarterly"
      : kind === "VISIT_PLANNED"
        ? "planned"
        : "s6a7";
  const frequencyDays = visitFrequencyDays(cadence, site.isOccupied);
  const dueAt = lastVisitDate
    ? new Date(lastVisitDate.getTime() + frequencyDays * DAY_MS)
    : null;
  const daysToDue = dueAt ? diffDaysFloor(dueAt, now) : null;
  let urgency = classifyEcheanceUrgency(daysToDue);
  // Tolérance S6A7 ± 2 mois : tant que le retard reste dans la tolérance après
  // l'échéance annuelle, la visite n'est pas « en retard » — on la signale
  // « à réaliser » (today). Au-delà de la tolérance, le classement redevient
  // « late » standard (et critique via isCriticalEcheance).
  if (
    kind === "VISIT_S6A7" &&
    daysToDue !== null &&
    daysToDue < 0 &&
    daysToDue >= -S6A7_TOLERANCE_DAYS
  ) {
    urgency = "today";
  }
  const title =
    kind === "VISIT_QUARTERLY"
      ? "Visite trimestrielle"
      : kind === "VISIT_PLANNED"
        ? "Visite planifiée"
        : "Visite S6A7";
  const subtitle = site.name;
  return {
    id: `${kind}:${site.id}`,
    kind,
    title,
    subtitle,
    dueAt,
    daysToDue,
    urgency,
    isCritical: isCriticalEcheance({ kind, daysToDue }),
    context: {
      siteId: site.id,
      siteName: site.name,
      siteIsOccupied: site.isOccupied,
      teamIds: site.teamIds,
    },
    cta: ctaForEcheance({
      kind,
      sourceId: site.id,
      daysToDue,
      siteId: site.id,
    }),
  };
}

function buildEquipmentEcheance(
  row: {
    id: string;
    label: string;
    category: string;
    expirationDate: Date;
    site: {
      id: string;
      name: string;
      isOccupied: boolean;
      memberships: { teamId: string }[];
    };
  },
  now: Date,
): EcheanceItem {
  const daysToDue = diffDaysFloor(row.expirationDate, now);
  const urgency = classifyEcheanceUrgency(daysToDue);
  return {
    id: `EQUIPMENT_EXPIRING:${row.id}`,
    kind: "EQUIPMENT_EXPIRING",
    title: row.label,
    subtitle: `${row.category} — ${row.site.name}`,
    dueAt: row.expirationDate,
    daysToDue,
    urgency,
    isCritical: isCriticalEcheance({ kind: "EQUIPMENT_EXPIRING", daysToDue }),
    context: {
      siteId: row.site.id,
      siteName: row.site.name,
      siteIsOccupied: row.site.isOccupied,
      teamIds: row.site.memberships.map((m) => m.teamId),
    },
    cta: ctaForEcheance({
      kind: "EQUIPMENT_EXPIRING",
      sourceId: row.id,
      daysToDue,
      siteId: row.site.id,
    }),
  };
}

function buildActionEcheance(
  row: {
    id: string;
    teamId: string;
    agentId: string | null;
    siteId: string | null;
    keyPoint: string | null;
    comment: string | null;
    dueAt: Date;
    agent: { id: string; firstName: string | null; lastName: string | null } | null;
    site: {
      id: string;
      name: string;
      isOccupied: boolean;
      memberships: { teamId: string }[];
    } | null;
  },
  now: Date,
  meta: { occurrenceCount: number; memberIds: string[] } = {
    occurrenceCount: 1,
    memberIds: [],
  },
): EcheanceItem {
  // Classification CANONIQUE des actions (cf. lib/echeances/action-echeance.ts
  // + docs/NOMENCLATURE-ECHEANCES.md) :
  //  - « En retard »          : dueAt < aujourd'hui 00:00  → urgence `late` ;
  //  - « En retard critique » : dueAt < aujourd'hui − 7 j  → `isCritical` ;
  //  - sinon, granularité « aujourd'hui / ≤7 j / ≤30 j / au-delà » via les
  //    jours CALENDAIRES (et non un floor instantané qui classait à tort une
  //    action due plus tôt aujourd'hui comme « en retard »).
  const state = actionEcheanceStateAt(row.dueAt, echeanceBounds(now));
  const daysToDue = differenceInCalendarDays(row.dueAt, now);
  const urgency: EcheanceUrgency = isOverdue(state)
    ? "late"
    : classifyEcheanceUrgency(daysToDue);
  const isCritical = state === "OVERDUE_CRITICAL";
  const agentName =
    row.agent && (row.agent.firstName || row.agent.lastName)
      ? `${row.agent.lastName ?? ""} ${row.agent.firstName ?? ""}`.trim()
      : null;
  const title = (row.keyPoint || row.comment || "Action").trim();
  const subtitleParts: string[] = [];
  if (agentName) subtitleParts.push(agentName);
  if (row.site?.name) subtitleParts.push(row.site.name);

  // Scope teamIds : combine team direct + memberships du site (cohérent
  // avec actionScope qui accepte ces 3 chemins).
  const teamIds = new Set<string>([row.teamId]);
  if (row.site) {
    for (const m of row.site.memberships) teamIds.add(m.teamId);
  }

  return {
    id: `ACTION_OVERDUE:${row.id}`,
    kind: "ACTION_OVERDUE",
    title,
    subtitle: subtitleParts.join(" · ") || undefined,
    dueAt: row.dueAt,
    daysToDue,
    urgency,
    isCritical,
    occurrenceCount: meta.occurrenceCount,
    memberIds: meta.memberIds.length ? meta.memberIds : [row.id],
    context: {
      siteId: row.site?.id,
      siteName: row.site?.name,
      siteIsOccupied: row.site?.isOccupied,
      agentId: row.agent?.id,
      agentName: agentName ?? undefined,
      teamIds: [...teamIds],
    },
    cta: ctaForEcheance({
      kind: "ACTION_OVERDUE",
      sourceId: row.id,
      daysToDue,
      siteId: row.site?.id,
      agentId: row.agent?.id,
    }),
  };
}

// ─── Sources publiques ───────────────────────────────────────────────────────

/**
 * Pour chaque site du périmètre, produit 0 / 1 / 2 `EcheanceItem` (trim et
 * plan) selon les dernières visites complètes. Site jamais visité (sur une
 * cadence) → item avec `dueAt = null`, `daysToDue = null`, urgency `late`
 * et `isCritical = true`.
 *
 * Une seule requête Prisma + agrégation JS. `siteId` optionnel pour le
 * drilldown C8.
 */
export async function getVisitEcheances(
  user: SessionUser,
  now: Date,
  siteId?: string,
): Promise<EcheanceItem[]> {
  const where: Record<string, unknown> = { isActive: true, ...siteScope(user) };
  if (siteId) where.id = siteId;

  const sites = await prisma.site.findMany({
    where,
    select: {
      id: true,
      name: true,
      isOccupied: true,
      memberships: { select: { teamId: true } },
      visits: {
        where: { status: "completed", finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: VISIT_PER_SITE_HISTORY,
        select: {
          finishedAt: true,
          template: { select: { slug: true } },
        },
      },
      // Présence d'un référentiel S6A7 : la cadence S6A7 ne s'applique qu'aux
      // sites qui ont au moins un élément S6A7 configuré (sinon on flaggerait
      // tous les sites « jamais fait »).
      equipments: {
        where: { domain: "S6A7", isActive: true },
        select: { id: true },
        take: 1,
      },
    },
    take: VISIT_SITES_MAX,
  });

  if (sites.length === VISIT_SITES_MAX) {
    log.warn("echeances.sites.truncated", { limit: VISIT_SITES_MAX });
  }

  const items: EcheanceItem[] = [];
  for (const s of sites) {
    const teamIds = s.memberships.map((m) => m.teamId);
    let lastQuarterly: Date | null = null;
    let lastPlanned: Date | null = null;
    let lastS6a7: Date | null = null;
    for (const v of s.visits) {
      if (!v.finishedAt) continue;
      const cadence = classifyVisitTemplateSlug(v.template.slug);
      if (cadence === "quarterly" && !lastQuarterly) lastQuarterly = v.finishedAt;
      else if (cadence === "planned" && !lastPlanned) lastPlanned = v.finishedAt;
      else if (cadence === "s6a7" && !lastS6a7) lastS6a7 = v.finishedAt;
    }
    items.push(
      buildVisitEcheance(
        "VISIT_QUARTERLY",
        { id: s.id, name: s.name, isOccupied: s.isOccupied, teamIds },
        lastQuarterly,
        now,
      ),
      buildVisitEcheance(
        "VISIT_PLANNED",
        { id: s.id, name: s.name, isOccupied: s.isOccupied, teamIds },
        lastPlanned,
        now,
      ),
    );
    // Échéance S6A7 uniquement pour les sites dotés d'un référentiel S6A7.
    if ((s.equipments?.length ?? 0) > 0) {
      items.push(
        buildVisitEcheance(
          "VISIT_S6A7",
          { id: s.id, name: s.name, isOccupied: s.isOccupied, teamIds },
          lastS6a7,
          now,
        ),
      );
    }
  }
  return items;
}

/**
 * Équipements déjà périmés OU expirant ≤ 30 jours sur le périmètre.
 * Équipements `expirationDate = null` (non périssables) ignorés.
 *
 * V1 : fenêtre haute fixée à 30 j — couvre le besoin métier sans
 * remonter des centaines d'équipements à 6 mois. À élargir si demande.
 */
export async function getEquipmentEcheances(
  user: SessionUser,
  now: Date,
  siteId?: string,
): Promise<EcheanceItem[]> {
  const upperBound = new Date(now.getTime() + EQUIPMENT_WINDOW_DAYS * DAY_MS);
  const where: Record<string, unknown> = {
    isActive: true,
    expirationDate: { not: null, lte: upperBound },
    site: siteId ? { id: siteId, ...siteScope(user) } : siteScope(user),
  };

  const rows = await prisma.siteEquipment.findMany({
    where,
    orderBy: { expirationDate: "asc" },
    take: EQUIPMENT_MAX,
    select: {
      id: true,
      label: true,
      category: true,
      expirationDate: true,
      site: {
        select: {
          id: true,
          name: true,
          isOccupied: true,
          memberships: { select: { teamId: true } },
        },
      },
    },
  });

  if (rows.length === EQUIPMENT_MAX) {
    log.warn("echeances.equipments.truncated", { limit: EQUIPMENT_MAX });
  }

  return rows
    .filter((r): r is typeof r & { expirationDate: Date } => !!r.expirationDate)
    .map((r) => buildEquipmentEcheance(r, now));
}

/**
 * Actions ouvertes (`localStatus = ACTIVE`) avec `dueAt` non null, sur le
 * périmètre `actionScope`. Inclut les en retard et les à venir (au-delà
 * de 30 j si présentes — différence vs `today.getOpenActions`).
 */
export async function getActionEcheances(
  user: SessionUser,
  now: Date,
  siteId?: string,
): Promise<EcheanceItem[]> {
  const where: Record<string, unknown> = {
    ...actionScope(user),
    localStatus: "ACTIVE",
    dueAt: { not: null },
  };
  if (siteId) where.siteId = siteId;

  const rows = await prisma.importedAction.findMany({
    where,
    orderBy: { dueAt: "asc" },
    take: ACTION_MAX,
    select: {
      id: true,
      teamId: true,
      agentId: true,
      siteId: true,
      vehicleId: true,
      dedupHash: true,
      keyPoint: true,
      comment: true,
      dueAt: true,
      agent: { select: { id: true, firstName: true, lastName: true } },
      site: {
        select: {
          id: true,
          name: true,
          isOccupied: true,
          memberships: { select: { teamId: true } },
        },
      },
    },
  });

  if (rows.length === ACTION_MAX) {
    log.warn("echeances.actions.truncated", { limit: ACTION_MAX });
  }

  // Lot 4B-2 — dédoublonnage : un item par action LOGIQUE (groupe). Les KPIs et
  // la liste comptent donc des actions logiques, plus des occurrences. La cible
  // étant déjà ACTIVE + dueAt non null, l'item est construit depuis le
  // représentant (échéance la plus proche). Navigation/CTA inchangés.
  const withDue = rows.filter(
    (r): r is typeof r & { dueAt: Date } => !!r.dueAt,
  );
  const groups = dedupActions(
    withDue.map((r) => ({ ...r, localStatus: "ACTIVE" as const })),
  );
  return groups.map((g) =>
    buildActionEcheance(g.representative, now, {
      occurrenceCount: g.occurrenceCount,
      memberIds: g.memberIds,
    }),
  );
}

function buildVehicleRoundEcheance(
  vehicle: {
    id: string;
    immatriculation: string;
    type: string;
    label: string | null;
    teamId: string | null;
  },
  lastRoundDate: Date | null,
  frequencyDays: number,
  now: Date,
): EcheanceItem {
  const dueAt = lastRoundDate
    ? new Date(lastRoundDate.getTime() + frequencyDays * DAY_MS)
    : null;
  const daysToDue = dueAt ? diffDaysFloor(dueAt, now) : null;
  const urgency = classifyEcheanceUrgency(daysToDue);
  const subtitleBits = [vehicleTypeLabel(vehicle.type)];
  if (vehicle.label) subtitleBits.push(vehicle.label);
  return {
    id: `VEHICLE_ROUND:${vehicle.id}`,
    kind: "VEHICLE_ROUND",
    title: `Tournée VS · ${vehicle.immatriculation}`,
    subtitle: subtitleBits.join(" · "),
    dueAt,
    daysToDue,
    urgency,
    isCritical: isCriticalEcheance({ kind: "VEHICLE_ROUND", daysToDue }),
    context: {
      vehicleId: vehicle.id,
      vehicleImmat: vehicle.immatriculation,
      teamIds: vehicle.teamId ? [vehicle.teamId] : [],
    },
    cta: ctaForEcheance({
      kind: "VEHICLE_ROUND",
      sourceId: vehicle.id,
      daysToDue,
      vehicleId: vehicle.id,
    }),
  };
}

/**
 * Pour chaque véhicule actif du périmètre, produit 1 `EcheanceItem` reflétant
 * la dernière tournée terminée et la cadence attendue
 * (`VehicleRoundTemplate.expectedFrequencyDays`, défaut 180 j).
 *
 * Véhicule jamais contrôlé → item avec `dueAt = null`, urgency `late`,
 * `isCritical = true`. Scope équipe : filtre via `teamScope(user)` sur
 * `Vehicle.teamId` — identique au filtrage de la liste tournées.
 */
export async function getVehicleRoundEcheances(
  user: SessionUser,
  now: Date,
): Promise<EcheanceItem[]> {
  const [vehicles, templates] = await Promise.all([
    prisma.vehicle.findMany({
      where: { isActive: true, ...teamScope(user) },
      select: {
        id: true,
        immatriculation: true,
        type: true,
        label: true,
        teamId: true,
        rounds: {
          where: { status: "completed", finishedAt: { not: null } },
          orderBy: { finishedAt: "desc" },
          take: VEHICLE_PER_HISTORY,
          select: { finishedAt: true },
        },
      },
      take: VEHICLE_MAX,
    }),
    prisma.vehicleRoundTemplate.findMany({
      where: { isActive: true },
      select: { expectedFrequencyDays: true },
      take: 10,
    }),
  ]);
  if (vehicles.length === VEHICLE_MAX) {
    log.warn("echeances.vehicles.truncated", { limit: VEHICLE_MAX });
  }
  // Cadence applicable : on prend la plus courte parmi les templates actifs
  // (cas V1 — un seul template à 180 j).
  const frequency =
    templates
      .map((t) => t.expectedFrequencyDays)
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b)[0] ?? VEHICLE_ROUND_DEFAULT_FREQ;
  return vehicles.map((v) => {
    const last = v.rounds[0]?.finishedAt ?? null;
    return buildVehicleRoundEcheance(
      {
        id: v.id,
        immatriculation: v.immatriculation,
        type: v.type,
        label: v.label,
        teamId: v.teamId,
      },
      last,
      frequency,
      now,
    );
  });
}

/**
 * Drilldown — toutes les échéances scope `siteId`, 3 types fusionnés.
 * Utilisé par la section "Échéances du site" du C8.
 */
export async function getEcheancesForSite(
  user: SessionUser,
  siteId: string,
  now: Date,
): Promise<EcheanceItem[]> {
  const [visits, equipments, actions] = await Promise.all([
    getVisitEcheances(user, now, siteId),
    getEquipmentEcheances(user, now, siteId),
    getActionEcheances(user, now, siteId),
  ]);
  return [...visits, ...equipments, ...actions];
}
