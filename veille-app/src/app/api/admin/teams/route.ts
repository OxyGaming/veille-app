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
  const teams = await prisma.team.findMany({
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
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
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
