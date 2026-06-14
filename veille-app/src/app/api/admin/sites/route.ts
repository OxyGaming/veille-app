import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const sites = await prisma.site.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: { include: { team: true } },
      _count: {
        select: {
          visits: true,
          importedActions: { where: { localStatus: "ACTIVE" } },
        },
      },
    },
  });
  return NextResponse.json(
    sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      type: s.type,
      address: s.address,
      isActive: s.isActive,
      isVisible: s.isVisible,
      hasGreasingArea: s.hasGreasingArea,
      isOccupied: s.isOccupied,
      teamIds: s.memberships.map((m) => m.teamId),
      teamNames: s.memberships.map((m) => m.team.name),
      visitsCount: s._count.visits,
      actionsCount: s._count.importedActions,
    }))
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().max(40).optional().nullable(),
  type: z.string().max(80).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  teamIds: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
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
  // teamId principal = première équipe sélectionnée, sinon équipe de l'utilisateur.
  const primaryTeamId = data.teamIds[0] ?? u.teamId ?? null;
  const site = await prisma.site.create({
    data: {
      name: data.name,
      code: data.code ?? null,
      type: data.type ?? null,
      address: data.address ?? null,
      description: data.description ?? null,
      teamId: primaryTeamId,
      memberships: {
        create: data.teamIds.map((teamId) => ({ teamId })),
      },
    },
  });
  return NextResponse.json(site);
}
