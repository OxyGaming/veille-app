import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectiveTeamIds, requireRole } from "@/lib/auth";

export async function GET() {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  // Cloisonnement : un EDITOR / ADMIN scopé ne liste que ses propres équipes.
  const scopeIds = effectiveTeamIds(u);
  const teams = await prisma.team.findMany({
    where: scopeIds === null ? {} : { id: { in: scopeIds } },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { users: true, agents: true, sessions: true },
      },
    },
  });
  return NextResponse.json(teams);
}

const schema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  // Création d'équipe = opération établissement, réservée à l'ADMIN GLOBAL
  // (un admin scopé ne verrait même pas l'équipe créée).
  if (effectiveTeamIds(actor) !== null) {
    return NextResponse.json(
      { error: "Création d'équipe réservée à un administrateur global." },
      { status: 403 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      isActive: parsed.data.isActive ?? true,
    },
  });
  return NextResponse.json(team);
}
