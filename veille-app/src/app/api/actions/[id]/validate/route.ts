import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

const schema = z.object({
  comment: z.string().nullable().optional(),
  realizedAt: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const action = await prisma.importedAction.findUnique({ where: { id } });
  if (!action) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  const scope = teamScope(u);
  if ("teamId" in scope && scope.teamId !== action.teamId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const realizedAt = parsed.data.realizedAt ? new Date(parsed.data.realizedAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const validation = await tx.actionValidation.create({
      data: {
        actionId: action.id,
        agentId: action.agentId,
        validatedById: u.id,
        teamId: action.teamId,
        realizedAt,
        comment: parsed.data.comment ?? null,
      },
    });
    await tx.importedAction.update({
      where: { id: action.id },
      data: { localStatus: "VALIDATED_LOCAL", realizedAt },
    });
    return validation;
  });

  return NextResponse.json(result);
}
