import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import {
  encodeTags,
  normalizeTag,
  TAG_OBLIGATOIRE,
  TAG_VEILLE_LEGALE,
} from "@/lib/tags";
import { vehicleTypeLabel } from "@/lib/vehicle-types";
import {
  defaultMessageFor,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const round = await prisma.vehicleRound.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      vehicle: true,
      observer: { select: { id: true, name: true } },
      observations: true,
    },
  });
  if (!round) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, round.teamId))
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  return NextResponse.json(round);
}

const patchSchema = z.object({
  status: z.enum(["active", "completed", "archived"]).optional(),
  generalComment: z.string().optional().nullable(),
  // Correction a posteriori de la date de tournée (cf. /api/visits/[id]).
  roundDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
    .optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const round = await prisma.vehicleRound.findUnique({ where: { id } });
  if (!round) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, round.teamId))
    return NextResponse.json({ error: "Interdit" }, { status: 403 });

  // Corriger la date de tournée est sensible (rapport potentiellement clôturé)
  // → réservé aux ADMIN/EDITOR, aligné sur la réouverture des visites.
  const changingDate = parsed.data.roundDate !== undefined;
  if (changingDate && u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json(
      { error: "Modification de la date réservée aux administrateurs et éditeurs." },
      { status: 403 },
    );
  }
  const roundDate = parsed.data.roundDate
    ? new Date(`${parsed.data.roundDate}T12:00:00`)
    : undefined;

  const goingToCompleted =
    parsed.data.status === "completed" && round.status !== "completed";
  // Corriger la date d'une tournée déjà clôturée recale aussi `finishedAt`,
  // qui pilote la cadence (prochaine tournée due). On ne touche pas à
  // `finishedAt` si le statut bascule en même temps (active/archived).
  const syncFinishedToDate =
    changingDate &&
    round.status === "completed" &&
    parsed.data.status === undefined;
  const finishedAt = goingToCompleted
    ? roundDate ?? new Date()
    : syncFinishedToDate
    ? roundDate
    : undefined;

  await prisma.vehicleRound.update({
    where: { id },
    data: {
      status: parsed.data.status,
      generalComment:
        parsed.data.generalComment === undefined
          ? undefined
          : parsed.data.generalComment,
      finishedAt,
      roundDate,
    },
  });

  // Trace d'audit de la rectification de date.
  if (changingDate) {
    await prisma.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "VEHICLE_ROUND_DATE_EDITED",
        entity: "VehicleRound",
        entityId: id,
        details: JSON.stringify({
          previousDate: round.roundDate,
          newDate: roundDate,
          vehicleId: round.vehicleId,
        }),
      },
    });
  }

  // Génération NC + actions correctives à la fermeture de la tournée.
  // Pour chaque observation NON, une `VehicleRoundNonConformity` est créée
  // accompagnée d'une `ImportedAction` (action corrective ACTIVE), liées
  // via `generatedActionId`. Idempotent : skip si la NC existe déjà
  // (cas de réouverture/refermeture).
  if (goingToCompleted) {
    await generateVehicleRoundNCs(id);
    // Flux d'activité équipe — VEHICLE_ROUND_FINISHED.
    // Vehicle.teamId est scalaire (mono-équipe en V1), donc pas de
    // duplication multi-team comme pour les sites. Le label porte
    // l'immatriculation + le nombre de NC pour donner du contexte.
    const ncCount = await prisma.vehicleRoundNonConformity.count({
      where: { roundId: id },
    });
    const label = `${round.immatriculation} (${vehicleTypeLabel(round.vehicleType)})`;
    const detail =
      ncCount > 0
        ? `${ncCount} non-conformité${ncCount > 1 ? "s" : ""} générée${ncCount > 1 ? "s" : ""}.`
        : "Aucune non-conformité.";
    await recordActivitySafe({
      teamIds: [round.teamId],
      actorId: u.id,
      actorName: u.name,
      type: "VEHICLE_ROUND_FINISHED",
      entityType: "vehicle-round",
      entityId: id,
      entityLabel: label,
      message: joinActivityParts([
        defaultMessageFor({
          type: "VEHICLE_ROUND_FINISHED",
          actorName: u.name,
          entityLabel: label,
        }),
        detail,
      ]),
      targetUrl: `/vehicle-rounds/${id}/report`,
      metadata: {
        vehicleId: round.vehicleId,
        vehicleType: round.vehicleType,
        immatriculation: round.immatriculation,
        ncCount,
      },
    });
  }
  return NextResponse.json({ ok: true });
}

async function generateVehicleRoundNCs(roundId: string): Promise<void> {
  const round = await prisma.vehicleRound.findUnique({
    where: { id: roundId },
    include: { vehicle: { select: { id: true } } },
  });
  if (!round) return;
  const koObs = await prisma.vehicleRoundObservation.findMany({
    where: { roundId, status: "NON" },
    include: {
      item: { select: { label: true } },
      nonConformity: { select: { id: true } },
    },
  });
  for (const obs of koObs) {
    if (obs.nonConformity) continue; // déjà générée
    const itemLabel = obs.item.label;
    const description = obs.comment ? `${itemLabel} — ${obs.comment}` : itemLabel;
    const dueAt = addDays(new Date(), 30);
    const externalId = `vrnc-${randomUUID()}`;
    const tags = [
      TAG_VEILLE_LEGALE,
      TAG_OBLIGATOIRE,
      "vehicule",
      "tournee-vs",
    ];
    const dedupHash = createHash("sha1")
      .update(
        [
          itemLabel.toLowerCase().trim(),
          (obs.comment ?? "").toLowerCase().trim(),
          round.immatriculation,
          dueAt.toISOString().slice(0, 10),
          tags.map(normalizeTag).sort().join(","),
        ].join("|")
      )
      .digest("hex");
    await prisma.$transaction(async (tx) => {
      const action = await tx.importedAction.create({
        data: {
          externalId,
          teamId: round.teamId,
          vehicleId: round.vehicleId,
          localStatus: "ACTIVE",
          dedupHash,
          originalStatus: "Planifiée",
          keyPoint: itemLabel,
          comment: `Tournée VS ${round.immatriculation} (${vehicleTypeLabel(round.vehicleType)}) — ${obs.comment ?? "à redresser"}`,
          veilleType: "Véhicule",
          dueAt,
          tags: encodeTags(tags),
        },
      });
      await tx.vehicleRoundNonConformity.create({
        data: {
          roundId,
          observationId: obs.id,
          itemLabel,
          description,
          generatedActionId: action.id,
        },
      });
    });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const round = await prisma.vehicleRound.findUnique({ where: { id } });
  if (!round) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, round.teamId))
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  if (round.status === "completed" && u.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Tournée terminée — suppression réservée à l'admin." },
      { status: 403 }
    );
  }
  await prisma.vehicleRound.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
