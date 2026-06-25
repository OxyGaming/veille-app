import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionScope, requireUser, teamScope } from "@/lib/auth";
import { vehicleTypeLabel } from "@/lib/vehicle-types";

/**
 * Stats spécifiques aux tournées véhicules de service. Deux blocs :
 *
 *  - `dashboard` : tableau de bord conformité par véhicule
 *      → dernière tournée terminée (status=completed) ;
 *      → date de dernière vérification ;
 *      → nombre d'items contrôlés / conformes (OUI) / écarts (NON) ;
 *      → taux de conformité ;
 *      → nombre d'actions correctives ouvertes (générées par les NC).
 *
 *  - `aTourner` : véhicules dont la cadence semestrielle (180 j) est
 *    dépassée ou arrive à échéance dans ≤ 30 jours. Inclut les véhicules
 *    jamais contrôlés (urgence "JAMAIS"). Trié par criticité.
 *
 * Scope :
 *  - `teamScope` pour Vehicle / VehicleRound ;
 *  - `actionScope` pour ImportedAction (actions correctives).
 */
const DEFAULT_FREQUENCY_DAYS = 180;
const DAY_MS = 24 * 3600 * 1000;

export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }

  const tScope = teamScope(u);
  const aScope = actionScope(u);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY_MS);

  // Cadence cible des tournées — on prend la plus courte des templates actifs
  // (V1 : un seul template à 180 j).
  const templates = await prisma.vehicleRoundTemplate.findMany({
    where: { isActive: true },
    select: { expectedFrequencyDays: true },
  });
  const frequency =
    templates
      .map((t) => t.expectedFrequencyDays)
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b)[0] ?? DEFAULT_FREQUENCY_DAYS;

  const vehicles = await prisma.vehicle.findMany({
    where: { ...tScope, isActive: true },
    select: { id: true, immatriculation: true, type: true, label: true },
    orderBy: { immatriculation: "asc" },
  });

  // Dernière tournée terminée par véhicule (en parallèle).
  const lastRounds = await Promise.all(
    vehicles.map((v) =>
      prisma.vehicleRound.findFirst({
        where: { vehicleId: v.id, status: "completed" },
        orderBy: { finishedAt: "desc" },
        select: {
          id: true,
          finishedAt: true,
          roundDate: true,
          observations: { select: { status: true } },
        },
      }),
    ),
  );

  // Actions correctives ouvertes liées aux véhicules — filtre par tag
  // (`tournee-vs`) et par vehicleId. SQLite : `contains` sur la string JSON.
  const openActions = await prisma.importedAction.findMany({
    where: {
      ...aScope,
      localStatus: "ACTIVE",
      vehicleId: { in: vehicles.map((v) => v.id) },
      tags: { contains: "tournee-vs" },
    },
    select: { vehicleId: true },
  });
  const openCount = new Map<string, number>();
  for (const a of openActions) {
    if (!a.vehicleId) continue;
    openCount.set(a.vehicleId, (openCount.get(a.vehicleId) ?? 0) + 1);
  }

  const dashboard = vehicles.map((v, i) => {
    const r = lastRounds[i];
    const total = r?.observations.length ?? 0;
    const conformes = r?.observations.filter((o) => o.status === "OUI").length ?? 0;
    const ecarts = r?.observations.filter((o) => o.status === "NON").length ?? 0;
    const evaluated = conformes + ecarts;
    const rate =
      evaluated > 0 ? Math.round((conformes / evaluated) * 1000) / 10 : null;
    return {
      vehicleId: v.id,
      immatriculation: v.immatriculation,
      type: v.type,
      typeLabel: vehicleTypeLabel(v.type),
      label: v.label,
      lastRoundId: r?.id ?? null,
      lastRoundDate: r?.finishedAt?.toISOString() ?? r?.roundDate?.toISOString() ?? null,
      total,
      conformes,
      ecarts,
      rate,
      openActions: openCount.get(v.id) ?? 0,
    };
  });

  // Liste « à tourner » : véhicules en retard OU dont l'échéance arrive
  // dans ≤ 30 jours, OU jamais contrôlés. Statut :
  //  - NEVER  : jamais contrôlé (critique, dueAt = null)
  //  - LATE   : dueAt < now
  //  - SOON   : now ≤ dueAt ≤ now+30j
  const aTourner = dashboard
    .map((row) => {
      const last = row.lastRoundDate ? new Date(row.lastRoundDate) : null;
      const dueAt = last
        ? new Date(last.getTime() + frequency * DAY_MS)
        : null;
      let status: "NEVER" | "LATE" | "SOON" | "OK";
      let daysToDue: number | null;
      if (!dueAt) {
        status = "NEVER";
        daysToDue = null;
      } else if (dueAt < now) {
        status = "LATE";
        daysToDue = Math.round((dueAt.getTime() - now.getTime()) / DAY_MS);
      } else if (dueAt <= in30) {
        status = "SOON";
        daysToDue = Math.round((dueAt.getTime() - now.getTime()) / DAY_MS);
      } else {
        status = "OK";
        daysToDue = Math.round((dueAt.getTime() - now.getTime()) / DAY_MS);
      }
      return { ...row, dueAt: dueAt?.toISOString() ?? null, status, daysToDue };
    })
    .filter((r) => r.status !== "OK")
    // Tri : jamais → en retard (le plus en retard d'abord) → bientôt
    .sort((a, b) => {
      const rank = { NEVER: 0, LATE: 1, SOON: 2, OK: 3 } as const;
      const ra = rank[a.status];
      const rb = rank[b.status];
      if (ra !== rb) return ra - rb;
      return (a.daysToDue ?? -Infinity) - (b.daysToDue ?? -Infinity);
    });

  return NextResponse.json({
    frequencyDays: frequency,
    dashboard,
    aTourner,
  });
}
