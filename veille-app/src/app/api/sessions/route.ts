import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

const createSchema = z.object({
  procedureIds: z.array(z.string().min(1)).min(1),
  agentId: z.string().nullable().optional(),
  posteId: z.string().nullable().optional(),
  secteurId: z.string().nullable().optional(),
  clientGeneratedId: z.string().optional(),
});

export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const where = {
    ...teamScope(u),
    ...(status ? { status } : {}),
    ...(agentId ? { agentId } : {}),
  };
  const items = await prisma.veilleSession.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      agent: true,
      observer: { select: { id: true, name: true } },
      procedures: { include: { procedure: true } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  if (!u.teamId) {
    return NextResponse.json(
      { error: "Aucune équipe associée à votre compte." },
      { status: 400 }
    );
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

  // Idempotence offline
  if (data.clientGeneratedId) {
    const existing = await prisma.veilleSession.findUnique({
      where: { clientGeneratedId: data.clientGeneratedId },
    });
    if (existing) return NextResponse.json(existing);
  }

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.veilleSession.create({
      data: {
        teamId: u.teamId!,
        observerId: u.id,
        agentId: data.agentId ?? null,
        posteId: data.posteId ?? null,
        secteurId: data.secteurId ?? null,
        status: "active",
        clientGeneratedId: data.clientGeneratedId,
      },
    });
    for (const pid of data.procedureIds) {
      const proc = await tx.procedure.findUnique({
        where: { id: pid },
        include: { items: { where: { isActive: true } } },
      });
      if (!proc) continue;
      const po = await tx.procedureObservation.create({
        data: { sessionId: s.id, procedureId: pid },
      });
      // Pré-créer les observations en NON_OBSERVE pour permettre saisie offline.
      for (const it of proc.items) {
        await tx.observationItem.create({
          data: {
            procedureObservationId: po.id,
            checklistItemId: it.id,
            status: "NON_OBSERVE",
            recordedById: u.id,
          },
        });
      }
    }
    return s;
  });

  return NextResponse.json(session);
}
