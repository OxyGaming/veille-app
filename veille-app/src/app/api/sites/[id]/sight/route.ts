import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";

/**
 * Crée un « Vu » (kind=SIGHT) ou un « Commentaire personnalisé » (kind=NOTE)
 * sur un site. Symétrique au endpoint /api/agents/[id]/sight.
 */
const schema = z.object({
  kind: z.enum(["SIGHT", "NOTE"]).default("SIGHT"),
  comment: z.string().trim().max(2000).optional().nullable(),
  sightedAt: z.string().datetime().optional(),
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
  const { id: siteId } = await ctx.params;
  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!site) {
    return NextResponse.json({ error: "Site inconnu" }, { status: 404 });
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  if (parsed.data.kind === "NOTE" && !parsed.data.comment?.trim()) {
    return NextResponse.json(
      { error: "Un commentaire est requis pour une note." },
      { status: 400 }
    );
  }
  const teamId =
    site.teamId ?? site.memberships[0]?.teamId ?? u.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à ce site." },
      { status: 400 }
    );
  }
  const sighting = await prisma.siteSighting.create({
    data: {
      siteId,
      teamId,
      observerId: u.id,
      kind: parsed.data.kind,
      comment: parsed.data.comment?.trim() || null,
      sightedAt: parsed.data.sightedAt
        ? new Date(parsed.data.sightedAt)
        : new Date(),
    },
  });
  return NextResponse.json(sighting);
}
