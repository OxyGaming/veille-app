import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canActOnTeam,
  effectiveTeamIds,
  hashPassword,
  requireRole,
  userScope,
} from "@/lib/auth";

const ROLES = ["ADMIN", "EDITOR", "USER"] as const;

export async function GET() {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  // Cloisonnement : un EDITOR / ADMIN scopé ne voit que les users de ses équipes.
  const users = await prisma.user.findMany({
    where: userScope(u),
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
  let actor;
  try {
    actor = await requireRole("ADMIN");
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
  const isGlobal = effectiveTeamIds(actor) === null;
  // Cloisonnement : un ADMIN scopé ne crée un user que dans son périmètre…
  if (!canActOnTeam(actor, data.teamId ?? null)) {
    return NextResponse.json(
      { error: "Équipe cible hors de votre périmètre." },
      { status: 403 }
    );
  }
  // …et ne peut pas fabriquer un compte à pouvoir global (ADMIN ou
  // viewAllTeams) — réservé à un ADMIN GLOBAL (anti-élévation de privilège).
  if (!isGlobal && (data.role === "ADMIN" || data.viewAllTeams === true)) {
    return NextResponse.json(
      { error: "Création d'un compte global réservée à un administrateur global." },
      { status: 403 }
    );
  }
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
