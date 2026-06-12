import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/**
 * Bascule (toggle) le masquage personnel d'un agent pour l'utilisateur
 * courant. Idempotent : si déjà masqué, on supprime l'entrée ; sinon on la
 * crée.
 *
 * N'altère jamais `Agent.isVisible` (réservé à l'admin).
 *
 * Réponse : { hidden: boolean }
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;

  // Vérifier que l'agent existe et est dans le scope de l'utilisateur.
  const exists = await prisma.agent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  const cur = await prisma.userAgentHidden.findUnique({
    where: { userId_agentId: { userId: u.id, agentId: id } },
    select: { id: true },
  });
  if (cur) {
    await prisma.userAgentHidden.delete({ where: { id: cur.id } });
    return NextResponse.json({ hidden: false });
  }
  await prisma.userAgentHidden.create({
    data: { userId: u.id, agentId: id },
  });
  return NextResponse.json({ hidden: true });
}
