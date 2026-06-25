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

  const goingToCompleted =
    parsed.data.status === "completed" && round.status !== "completed";

  await prisma.vehicleRound.update({
    where: { id },
    data: {
      status: parsed.data.status,
      generalComment:
        parsed.data.generalComment === undefined
          ? undefined
          : parsed.data.generalComment,
      finishedAt: goingToCompleted ? new Date() : undefined,
    },
  });

  // Génération NC + actions correctives à la fermeture de la tournée.
  // Pour chaque observation NON, une `VehicleRoundNonConformity` est créée
  // accompagnée d'une `ImportedAction` (action corrective ACTIVE), liées
  // via `generatedActionId`. Idempotent : skip si la NC existe déjà
  // (cas de réouverture/refermeture).
  if (goingToCompleted) {
    await generateVehicleRoundNCs(id);
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
