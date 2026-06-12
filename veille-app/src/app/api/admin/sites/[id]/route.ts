import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(160).optional(),
  code: z.string().max(40).optional().nullable(),
  type: z.string().max(80).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  hasGreasingArea: z.boolean().optional(),
  teamIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
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
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code === undefined ? undefined : parsed.data.code,
        type: parsed.data.type === undefined ? undefined : parsed.data.type,
        address:
          parsed.data.address === undefined ? undefined : parsed.data.address,
        description:
          parsed.data.description === undefined
            ? undefined
            : parsed.data.description,
        isVisible: parsed.data.isVisible,
        isActive: parsed.data.isActive,
        hasGreasingArea: parsed.data.hasGreasingArea,
      },
    });
    if (parsed.data.teamIds) {
      const wanted = new Set(parsed.data.teamIds);
      const current = await tx.siteTeam.findMany({ where: { siteId: id } });
      const currentIds = new Set(current.map((m) => m.teamId));
      const toRemove = current.filter((m) => !wanted.has(m.teamId));
      const toAdd = [...wanted].filter((t) => !currentIds.has(t));
      if (toRemove.length) {
        await tx.siteTeam.deleteMany({
          where: { id: { in: toRemove.map((m) => m.id) } },
        });
      }
      for (const teamId of toAdd) {
        await tx.siteTeam.create({ data: { siteId: id, teamId } });
      }
    }
  });
  return NextResponse.json({ ok: true });
}
