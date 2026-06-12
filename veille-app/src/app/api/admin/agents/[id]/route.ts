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

/**
 * Suppression d'un agent.
 *  - ?mode=soft (défaut) : isActive=false + isVisible=false (ne touche pas à
 *    l'historique). Permet d'archiver un agent qui a quitté.
 *  - ?mode=hard : suppression définitive uniquement si aucune trace
 *    opérationnelle (session, sighting, action importée, validation).
 *    Sinon 409 avec compteurs.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  if (mode === "soft") {
    await prisma.agent.update({
      where: { id },
      data: { isActive: false, isVisible: false },
    });
    return NextResponse.json({ ok: true });
  }

  const [sessions, sightings, actions, validations] = await Promise.all([
    prisma.veilleSession.count({ where: { agentId: id } }),
    prisma.agentSighting.count({ where: { agentId: id } }),
    prisma.importedAction.count({ where: { agentId: id } }),
    prisma.actionValidation.count({ where: { agentId: id } }),
  ]);
  const counts = { sessions, sightings, actions, validations };
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonEmpty.length > 0) {
    const detail = nonEmpty.map(([k, n]) => `${n} ${k}`).join(", ");
    return NextResponse.json(
      {
        error: `Suppression refusée — l'agent a des données rattachées (${detail}). Désactivez-le plutôt.`,
        counts,
      },
      { status: 409 }
    );
  }
  await prisma.$transaction([
    prisma.agentTeam.deleteMany({ where: { agentId: id } }),
    prisma.userAgentHidden.deleteMany({ where: { agentId: id } }),
    prisma.agent.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deleted: `${agent.lastName} ${agent.firstName}` });
}
