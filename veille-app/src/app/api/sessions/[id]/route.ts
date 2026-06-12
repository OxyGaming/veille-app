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

/**
 * Suppression d'une session de veille.
 *  - ?mode=soft (défaut) : status="archived". Le rapport n'apparaît plus
 *    dans les listes courantes mais reste consultable.
 *  - ?mode=hard : supprime la session et toutes ses observations (cascade
 *    Prisma) UNIQUEMENT si elle est `draft` ou `active` sans observation
 *    enregistrée. Bloqué pour les sessions `completed` (l'historique doit
 *    être préservé) — utiliser le soft.
 *  - Seul l'observer ou un ADMIN/EDITOR peut supprimer.
 */
export async function DELETE(
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
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const session = await loadScoped(id, u);
  if (!session)
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  const isOwner = session.observerId === u.id;
  const isAdmin = u.role === "ADMIN" || u.role === "EDITOR";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (mode === "soft") {
    await prisma.veilleSession.update({
      where: { id },
      data: { status: "archived" },
    });
    return NextResponse.json({ ok: true });
  }

  // Hard : interdit sur session clôturée (historique à préserver).
  if (session.status === "completed") {
    return NextResponse.json(
      {
        error:
          "Session clôturée — utilisez l'archivage (mode soft) pour préserver l'historique.",
      },
      { status: 409 }
    );
  }
  // Compteur d'observations renseignées (autres que PENDING) — si > 0, refus.
  const filledObs = await prisma.observationItem.count({
    where: {
      procedureObservation: { sessionId: id },
      status: { not: "NON_OBSERVE" },
    },
  });
  if (filledObs > 0 && !isAdmin) {
    return NextResponse.json(
      {
        error: `Session contient ${filledObs} observation(s) saisie(s). Demande à un admin pour la supprimer.`,
      },
      { status: 409 }
    );
  }
  // Suppression cascade : Prisma cascade les ProcedureObservation -> ObservationItem.
  await prisma.veilleSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
