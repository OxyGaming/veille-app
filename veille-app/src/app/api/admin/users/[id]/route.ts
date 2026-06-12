import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const ROLES = ["ADMIN", "EDITOR", "USER"] as const;

const schema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  viewAllTeams: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireRole("ADMIN");
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Garde-fous spec :
  // - interdire l'auto-désactivation
  if (parsed.data.isActive === false && target.id === me.id) {
    return NextResponse.json(
      { error: "Impossible de désactiver votre propre compte." },
      { status: 400 }
    );
  }
  // - interdire la désactivation du dernier ADMIN actif
  if (parsed.data.isActive === false && target.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Impossible de désactiver le dernier administrateur." },
        { status: 400 }
      );
    }
  }
  // - même règle si on change le rôle d'un dernier ADMIN
  if (
    parsed.data.role &&
    parsed.data.role !== "ADMIN" &&
    target.role === "ADMIN"
  ) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Impossible de retirer le rôle au dernier administrateur." },
        { status: 400 }
      );
    }
  }
  // - interdire la désactivation si l'utilisateur possède des sessions actives
  if (parsed.data.isActive === false) {
    const activeSessions = await prisma.veilleSession.count({
      where: { observerId: target.id, status: { in: ["draft", "active"] } },
    });
    if (activeSessions > 0) {
      return NextResponse.json(
        {
          error: `Impossible de désactiver : ${activeSessions} session(s) de veille active(s).`,
        },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {
    email: parsed.data.email?.toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
    teamId: parsed.data.teamId,
    viewAllTeams: parsed.data.viewAllTeams,
  };
  if (parsed.data.password) {
    update.password = hashPassword(parsed.data.password);
  }
  const updated = await prisma.user.update({ where: { id }, data: update });
  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isActive: updated.isActive,
    teamId: updated.teamId,
    viewAllTeams: updated.viewAllTeams,
  });
}

// Soft-delete — alias de PATCH isActive=false avec les mêmes garde-fous.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return PATCH(
    new Request(req.url, {
      method: "PATCH",
      headers: req.headers,
      body: JSON.stringify({ isActive: false }),
    }),
    { params: Promise.resolve({ id }) }
  );
}

