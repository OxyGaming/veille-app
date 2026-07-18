import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { REPRISE_AUTHORIZATIONS } from "@/lib/cil/types";

const patchSchema = z.object({
  texte: z.string().trim().max(4000).optional(),
  numeroRecu: z.string().trim().max(20).nullable().optional(),
  collationne: z.boolean().optional(),
  avisCrcAt: z.string().datetime().nullable().optional(),
  avisCosAt: z.string().datetime().nullable().optional(),
  avisOpjAt: z.string().datetime().nullable().optional(),
  departEffectifAt: z.string().datetime().nullable().optional(),
  repriseAuthorization: z.enum(REPRISE_AUTHORIZATIONS).nullable().optional(),
  destinataires: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        numeroRecu: z.string().trim().max(20).nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
});

const d = (s: string | null | undefined) =>
  s === undefined ? undefined : s ? new Date(s) : null;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; depId: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id, depId } = await ctx.params;
  const dep = await prisma.cilDepeche.findUnique({
    where: { id: depId },
    include: { incident: { select: { teamId: true, status: true, id: true } } },
  });
  if (!dep || dep.incidentId !== id) {
    return NextResponse.json({ error: "Dépêche inconnue" }, { status: 404 });
  }
  if (!assertTeamAccess(u, dep.incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (dep.incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
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
      { status: 400 },
    );
  }
  const p = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.cilDepeche.update({
      where: { id: depId },
      data: {
        ...(p.texte !== undefined ? { texte: p.texte } : {}),
        ...(p.numeroRecu !== undefined ? { numeroRecu: p.numeroRecu } : {}),
        ...(p.collationne !== undefined ? { collationne: p.collationne } : {}),
        ...(d(p.avisCrcAt) !== undefined ? { avisCrcAt: d(p.avisCrcAt) } : {}),
        ...(d(p.avisCosAt) !== undefined ? { avisCosAt: d(p.avisCosAt) } : {}),
        ...(d(p.avisOpjAt) !== undefined ? { avisOpjAt: d(p.avisOpjAt) } : {}),
        ...(d(p.departEffectifAt) !== undefined
          ? { departEffectifAt: d(p.departEffectifAt) }
          : {}),
        ...(p.repriseAuthorization !== undefined
          ? { repriseAuthorization: p.repriseAuthorization }
          : {}),
      },
    });
    if (p.destinataires !== undefined) {
      await tx.cilDepecheDestinataire.deleteMany({ where: { depecheId: depId } });
      if (p.destinataires.length) {
        await tx.cilDepecheDestinataire.createMany({
          data: p.destinataires.map((x) => ({
            depecheId: depId,
            label: x.label,
            numeroRecu: x.numeroRecu ?? null,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
