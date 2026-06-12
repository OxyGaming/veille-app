import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  /** Liste complète des userIds membres. */
  userIds: z.array(z.string()).optional(),
  /** Liste complète des agentIds membres. */
  agentIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      userMemberships: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      agentMemberships: { include: { agent: true } },
    },
  });
  if (!team) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json({
    id: team.id,
    name: team.name,
    code: team.code,
    isActive: team.isActive,
    users: team.userMemberships.map((m) => ({
      ...m.user,
      membershipRole: m.role,
      joinedAt: m.joinedAt,
    })),
    agents: team.agentMemberships.map((m) => ({
      ...m.agent,
      joinedAt: m.joinedAt,
    })),
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id: teamId } = await ctx.params;
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

  await prisma.$transaction(async (tx) => {
    if (parsed.data.userIds) {
      const wanted = new Set(parsed.data.userIds);
      const current = await tx.userTeam.findMany({ where: { teamId } });
      const currentIds = new Set(current.map((m) => m.userId));
      const toRemove = current.filter((m) => !wanted.has(m.userId));
      const toAdd = [...wanted].filter((u) => !currentIds.has(u));
      if (toRemove.length) {
        await tx.userTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
      }
      for (const userId of toAdd) {
        await tx.userTeam.create({ data: { userId, teamId } });
      }
    }
    if (parsed.data.agentIds) {
      const wanted = new Set(parsed.data.agentIds);
      const current = await tx.agentTeam.findMany({ where: { teamId } });
      const currentIds = new Set(current.map((m) => m.agentId));
      const toRemove = current.filter((m) => !wanted.has(m.agentId));
      const toAdd = [...wanted].filter((a) => !currentIds.has(a));
      if (toRemove.length) {
        await tx.agentTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
      }
      for (const agentId of toAdd) {
        await tx.agentTeam.create({ data: { agentId, teamId } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
