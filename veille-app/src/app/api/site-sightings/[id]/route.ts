import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertTeamAccess } from "@/lib/auth";

/**
 * Édition du commentaire d'un SiteSighting (vue Historique, PC uniquement).
 * Symétrique à /api/sightings/[id] pour les agents.
 */
const patchSchema = z.object({
  comment: z.string().trim().max(2000).nullable(),
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
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.siteSighting.findUnique({
    where: { id },
    select: { id: true, teamId: true, kind: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }
  if (!assertTeamAccess(u, existing.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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
  const next = parsed.data.comment?.trim() || null;
  if (existing.kind === "NOTE" && !next) {
    return NextResponse.json(
      { error: "Un commentaire est requis pour une note." },
      { status: 400 }
    );
  }
  const updated = await prisma.siteSighting.update({
    where: { id },
    data: { comment: next },
  });
  return NextResponse.json(updated);
}
