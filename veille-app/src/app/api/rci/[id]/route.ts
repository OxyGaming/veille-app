import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";

async function loadRci(id: string) {
  return prisma.rci.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      photos: {
        select: {
          id: true,
          storagePath: true,
          legend: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
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
  const rci = await loadRci(id);
  if (!rci) return NextResponse.json({ error: "RCI inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, rci.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.json(rci);
}

const patchSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  dossierNumber: z.string().trim().max(80).nullable().optional(),
  eventAt: z.string().datetime().nullable().optional(),
  /// Stringified JSON. Le serveur ne valide pas le contenu (libre côté wizard).
  payload: z.string().max(500_000).optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

/**
 * Autosave partielle. Refuse les modifications si le RCI est FINAL (lecture seule).
 * Le passage DRAFT → FINAL est autorisé une fois ; FINAL → DRAFT non.
 */
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
  const existing = await prisma.rci.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "RCI inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (existing.status === "FINAL") {
    return NextResponse.json(
      { error: "RCI finalisé, lecture seule." },
      { status: 409 }
    );
  }
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
  if (parsed.data.payload !== undefined) {
    try {
      JSON.parse(parsed.data.payload);
    } catch {
      return NextResponse.json(
        { error: "payload doit être un JSON valide" },
        { status: 400 }
      );
    }
  }
  const updated = await prisma.rci.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.dossierNumber !== undefined
        ? { dossierNumber: parsed.data.dossierNumber }
        : {}),
      ...(parsed.data.eventAt !== undefined
        ? {
            eventAt: parsed.data.eventAt
              ? new Date(parsed.data.eventAt)
              : null,
          }
        : {}),
      ...(parsed.data.payload !== undefined
        ? { payload: parsed.data.payload }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });
  return NextResponse.json(updated);
}

/**
 * Supprime un brouillon. Refuse si FINAL (intégrité de l'archive).
 * Les photos sont cascadées via la FK ON DELETE CASCADE du schéma.
 */
export async function DELETE(
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
  const existing = await prisma.rci.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "RCI inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (existing.status === "FINAL") {
    return NextResponse.json(
      { error: "RCI finalisé, suppression interdite." },
      { status: 409 }
    );
  }
  await prisma.rci.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
