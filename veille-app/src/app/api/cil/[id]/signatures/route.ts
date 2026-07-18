import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { SIGNATURE_OWNER_TYPES } from "@/lib/cil/types";

const bodySchema = z.object({
  ownerType: z.enum(SIGNATURE_OWNER_TYPES),
  ownerId: z.string().min(1),
  signerName: z.string().trim().max(160).nullable().optional(),
  signerRole: z.string().trim().max(120).nullable().optional(),
  /// PNG base64 sans préfixe (SignaturePad RCI).
  imageB64: z.string().min(1).max(500_000),
});

/** Vérifie que l'owner appartient bien à l'incident (anti-IDOR). */
async function ownerBelongsToIncident(
  ownerType: string,
  ownerId: string,
  incidentId: string,
): Promise<boolean> {
  switch (ownerType) {
    case "INCIDENT":
      return ownerId === incidentId;
    case "DEPECHE": {
      const d = await prisma.cilDepeche.findUnique({
        where: { id: ownerId },
        select: { incidentId: true },
      });
      return d?.incidentId === incidentId;
    }
    case "INTERVENANT": {
      const i = await prisma.cilIntervenant.findUnique({
        where: { id: ownerId },
        select: { incidentId: true },
      });
      return i?.incidentId === incidentId;
    }
    case "EVENT": {
      const e = await prisma.cilEvent.findUnique({
        where: { id: ownerId },
        select: { incidentId: true },
      });
      return e?.incidentId === incidentId;
    }
    default:
      return false;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const incident = await prisma.cilIncident.findUnique({ where: { id } });
  if (!incident)
    return NextResponse.json({ error: "Incident inconnu" }, { status: 404 });
  if (!assertTeamAccess(u, incident.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (incident.status === "CLOSED") {
    return NextResponse.json({ error: "Incident clôturé." }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;
  if (!(await ownerBelongsToIncident(p.ownerType, p.ownerId, id))) {
    return NextResponse.json(
      { error: "Élément à signer introuvable pour cet incident." },
      { status: 404 },
    );
  }
  const created = await prisma.cilSignature.create({
    data: {
      incidentId: id,
      ownerType: p.ownerType,
      ownerId: p.ownerId,
      signerName: p.signerName ?? null,
      signerRole: p.signerRole ?? null,
      imageB64: p.imageB64,
    },
  });
  return NextResponse.json({ id: created.id });
}
