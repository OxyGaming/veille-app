import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import { isVehicleType } from "@/lib/vehicle-types";

/**
 * Liste des tournées véhicule, scope équipe.
 * Tri antéchronologique. Limit 100 (au-delà : pagination à prévoir en V2).
 */
export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const vehicleId = url.searchParams.get("vehicleId") ?? undefined;
  const items = await prisma.vehicleRound.findMany({
    where: {
      ...teamScope(u),
      ...(status ? { status } : {}),
      ...(vehicleId ? { vehicleId } : {}),
    },
    orderBy: { roundDate: "desc" },
    take: 100,
    include: {
      template: { select: { id: true, slug: true, name: true } },
      vehicle: {
        select: { id: true, immatriculation: true, type: true, label: true },
      },
      observer: { select: { id: true, name: true } },
      _count: { select: { observations: true } },
    },
  });
  return NextResponse.json(items);
}

const createSchema = z.object({
  vehicleId: z.string().min(1),
  templateId: z.string().optional(),
  roundDate: z.string().datetime().optional(),
});

/**
 * Crée une tournée pour un véhicule. Sélectionne automatiquement le template
 * "tournee-vs" si `templateId` non fourni.
 *
 * Side-effect : crée une observation `PENDING` pour chaque item applicable
 * au type du véhicule (filtre `applicableTypes`).
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, ...teamScope(u) },
  });
  if (!vehicle) {
    return NextResponse.json(
      { error: "Véhicule introuvable ou hors de votre périmètre." },
      { status: 404 }
    );
  }
  if (!vehicle.isActive) {
    return NextResponse.json(
      { error: "Véhicule désactivé — impossible de démarrer une tournée." },
      { status: 400 }
    );
  }
  if (!isVehicleType(vehicle.type)) {
    return NextResponse.json(
      { error: "Type de véhicule inconnu — vérifiez le référentiel." },
      { status: 400 }
    );
  }

  const template = data.templateId
    ? await prisma.vehicleRoundTemplate.findUnique({
        where: { id: data.templateId },
        include: { sections: { include: { items: true } } },
      })
    : await prisma.vehicleRoundTemplate.findUnique({
        where: { slug: "tournee-vs" },
        include: { sections: { include: { items: true } } },
      });
  if (!template || !template.isActive) {
    return NextResponse.json(
      { error: "Modèle de tournée introuvable." },
      { status: 404 }
    );
  }

  const teamId = vehicle.teamId ?? u.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à ce véhicule." },
      { status: 400 }
    );
  }

  // Filtrage des items applicables au type du véhicule.
  const allItems = template.sections.flatMap((s) =>
    s.items
      .filter((it) => it.isActive)
      .map((it) => ({ sectionId: s.id, item: it }))
  );
  const applicableItems = allItems.filter(({ item }) => {
    let types: string[];
    try {
      types = JSON.parse(item.applicableTypes);
    } catch {
      types = [];
    }
    // Tableau vide = applicable à tous les types.
    return types.length === 0 || types.includes(vehicle.type);
  });

  const round = await prisma.vehicleRound.create({
    data: {
      templateId: template.id,
      vehicleId: vehicle.id,
      teamId,
      observerId: u.id,
      roundDate: data.roundDate ? new Date(data.roundDate) : new Date(),
      status: "active",
      vehicleType: vehicle.type,
      immatriculation: vehicle.immatriculation,
    },
  });

  if (applicableItems.length > 0) {
    await prisma.vehicleRoundObservation.createMany({
      data: applicableItems.map(({ sectionId, item }) => ({
        roundId: round.id,
        sectionId,
        itemId: item.id,
        status: "PENDING",
      })),
    });
  }

  return NextResponse.json(round);
}
