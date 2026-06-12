import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope, teamScope } from "@/lib/auth";

export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const siteId = url.searchParams.get("siteId") ?? undefined;
  const items = await prisma.siteVisit.findMany({
    where: {
      ...teamScope(u),
      ...(status ? { status } : {}),
      ...(siteId ? { siteId } : {}),
    },
    orderBy: { visitDate: "desc" },
    take: 100,
    include: {
      template: { select: { id: true, slug: true, name: true } },
      site: { select: { id: true, name: true, code: true, type: true } },
      observer: { select: { id: true, name: true } },
      _count: { select: { nonConformities: true, observations: true } },
    },
  });
  return NextResponse.json(items);
}

const createSchema = z.object({
  templateId: z.string().min(1),
  siteId: z.string().min(1),
  visitDate: z.string().datetime().optional(),
  participants: z
    .array(
      z.object({
        fullName: z.string().min(1).max(120),
        function: z.string().max(120).optional().nullable(),
        agentId: z.string().optional().nullable(),
      })
    )
    .max(20)
    .default([]),
});

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

  // Vérif scope site.
  const site = await prisma.site.findFirst({
    where: { id: data.siteId, ...siteScope(u) },
  });
  if (!site) {
    return NextResponse.json(
      { error: "Site introuvable ou hors de votre périmètre." },
      { status: 404 }
    );
  }
  const template = await prisma.siteVisitTemplate.findUnique({
    where: { id: data.templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Modèle inconnu" }, { status: 404 });
  }
  // teamId : équipe principale du site, sinon de l'utilisateur.
  const teamId = site.teamId ?? u.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à ce site." },
      { status: 400 }
    );
  }

  const visit = await prisma.siteVisit.create({
    data: {
      templateId: data.templateId,
      siteId: data.siteId,
      teamId,
      observerId: u.id,
      visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
      status: "active",
      metadata: JSON.stringify({
        siteName: site.name,
        siteCode: site.code,
      }),
      participants: {
        create: data.participants.map((p, i) => ({
          fullName: p.fullName,
          function: p.function ?? null,
          agentId: p.agentId ?? null,
          sortOrder: i,
        })),
      },
    },
  });

  // Snapshot eager pour les visites INVENTORY : on crée une observation par
  // équipement actif du site, pré-remplie aux valeurs du catalogue. L'agent
  // n'a plus qu'à modifier les écarts.
  if (template.kind === "INVENTORY") {
    const equipments = await prisma.siteEquipment.findMany({
      where: { siteId: data.siteId, isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    if (equipments.length > 0) {
      await prisma.siteVisitObservation.createMany({
        data: equipments.map((eq) => ({
          visitId: visit.id,
          equipmentId: eq.id,
          // sectionId / itemId restent null en mode INVENTORY.
          present: true,
          quantityObserved: eq.expectedQuantity,
          expirationDateObserved: eq.expirationDate,
          discrepancyType: null,
          status: "OUI",
        })),
      });
    }
  }

  return NextResponse.json(visit);
}
