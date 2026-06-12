import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const ROLES = ["ADMIN", "EDITOR", "USER"] as const;

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { team: true },
  });
  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      viewAllTeams: u.viewAllTeams,
      teamId: u.teamId,
      teamName: u.team?.name ?? null,
      createdAt: u.createdAt,
    }))
  );
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(ROLES).default("USER"),
  teamId: z.string().nullable().optional(),
  viewAllTeams: z.boolean().optional(),
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  try {
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        password: hashPassword(data.password),
        role: data.role,
        teamId: data.teamId ?? null,
        viewAllTeams: data.viewAllTeams ?? false,
      },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("Unique") || message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Email déjà utilisé." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
