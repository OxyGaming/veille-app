import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

async function loadScoped(id: string, u: Awaited<ReturnType<typeof requireUser>>) {
  const scope = teamScope(u);
  return prisma.veilleSession.findFirst({
    where: { id, ...scope },
    include: {
      agent: true,
      observer: { select: { id: true, name: true } },
      poste: true,
      secteur: true,
      procedures: {
        include: {
          procedure: true,
          items: {
            include: {
              checklistItem: true,
              photos: { select: { id: true, storagePath: true, legend: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      },
      photos: true,
      comments: { include: { author: { select: { id: true, name: true } } } },
    },
  });
}

export async function GET(
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
  const s = await loadScoped(id, u);
  if (!s) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json(s);
}

const patchSchema = z.object({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  generalComment: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  posteId: z.string().nullable().optional(),
  secteurId: z.string().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
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
  const existing = await loadScoped(id, u);
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const finishedAt =
    data.status === "completed"
      ? new Date()
      : data.finishedAt
      ? new Date(data.finishedAt)
      : undefined;
  const updated = await prisma.veilleSession.update({
    where: { id },
    data: {
      status: data.status,
      generalComment: data.generalComment ?? undefined,
      agentId: data.agentId === undefined ? undefined : data.agentId,
      posteId: data.posteId === undefined ? undefined : data.posteId,
      secteurId: data.secteurId === undefined ? undefined : data.secteurId,
      finishedAt,
    },
  });
  return NextResponse.json(updated);
}
