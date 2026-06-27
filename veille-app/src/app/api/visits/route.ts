import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOwningTeam, siteScope } from "@/lib/auth";

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
  // Lecture cloisonnée VIA LE SITE (décision : une visite d'un site partagé est
  // visible par toutes les équipes du site — la cadence réglementaire est au
  // niveau site). L'édition/suppression reste stricte sur teamId créateur.
  const items = await prisma.siteVisit.findMany({
    where: {
      site: siteScope(u),
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
  /** Équipe propriétaire (site multi-équipes) — requise si ambiguë. */
  teamId: z.string().optional(),
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
    include: { memberships: { select: { teamId: true } } },
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
  // Équipe propriétaire désambiguïsée (site multi-équipes) — pas d'héritage
  // automatique du teamId legacy.
  const owning = resolveOwningTeam(
    u,
    [site.teamId, ...site.memberships.map((m) => m.teamId)],
    data.teamId,
  );
  if (!owning.ok) {
    const status = owning.code === "TEAM_REQUIRED" ? 400 : 403;
    return NextResponse.json(
      {
        error:
          owning.code === "TEAM_REQUIRED"
            ? "Site partagé : précisez l'équipe de la visite."
            : owning.code === "NO_TEAM"
              ? "Aucune équipe de votre périmètre rattachée à ce site."
              : "Équipe hors de votre périmètre.",
        code: owning.code,
      },
      { status }
    );
  }
  const teamId = owning.teamId;

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
