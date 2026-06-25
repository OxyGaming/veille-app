import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["PENDING", "OUI", "NON", "SANS_OBJET"]).optional(),
  comment: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; obsId: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id, obsId } = await ctx.params;
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
  const round = await prisma.vehicleRound.findUnique({ where: { id } });
  if (!round) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, round.teamId))
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  if (round.status === "completed") {
    return NextResponse.json(
      { error: "Tournée terminée — observations verrouillées." },
      { status: 409 }
    );
  }
  const obs = await prisma.vehicleRoundObservation.findUnique({
    where: { id: obsId },
  });
  if (!obs || obs.roundId !== id) {
    return NextResponse.json({ error: "Observation inconnue" }, { status: 404 });
  }
  await prisma.vehicleRoundObservation.update({
    where: { id: obsId },
    data: {
      status: parsed.data.status,
      comment:
        parsed.data.comment === undefined ? undefined : parsed.data.comment,
      recordedAt: new Date(),
      recordedById: u.id,
    },
  });
  return NextResponse.json({ ok: true });
}
