import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  /** Liste complète des teamIds — remplace l'appartenance actuelle. */
  teamIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
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

  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (
      parsed.data.isVisible !== undefined ||
      parsed.data.isActive !== undefined
    ) {
      await tx.agent.update({
        where: { id },
        data: {
          isVisible: parsed.data.isVisible,
          isActive: parsed.data.isActive,
        },
      });
    }
    if (parsed.data.teamIds) {
      const wanted = new Set(parsed.data.teamIds);
      const current = await tx.agentTeam.findMany({ where: { agentId: id } });
      const currentIds = new Set(current.map((m) => m.teamId));
      const toAdd = [...wanted].filter((t) => !currentIds.has(t));
      const toRemove = current.filter((m) => !wanted.has(m.teamId));
      if (toRemove.length) {
        await tx.agentTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
      }
      for (const teamId of toAdd) {
        await tx.agentTeam.create({ data: { agentId: id, teamId } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
