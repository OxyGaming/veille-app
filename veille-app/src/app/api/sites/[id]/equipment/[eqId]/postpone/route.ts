import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, siteScope } from "@/lib/auth";

const schema = z.object({
  expirationDate: z.string().datetime(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Reporte la date de péremption d'un équipement (Hub Échéances —
 * bouton « Reporter » sur ligne EQUIPMENT_EXPIRING).
 *
 * Refuse les équipements désactivés (isActive=false). Transaction :
 * update expirationDate + AuditLog EQUIPMENT_POSTPONED.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; eqId: string }> }
) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id: siteId, eqId } = await ctx.params;
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

  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    select: { id: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
  }
  const eq = await prisma.siteEquipment.findFirst({
    where: { id: eqId, siteId },
    select: {
      id: true,
      label: true,
      category: true,
      expirationDate: true,
      isActive: true,
    },
  });
  if (!eq) {
    return NextResponse.json({ error: "Équipement inconnu" }, { status: 404 });
  }
  if (!eq.isActive) {
    return NextResponse.json(
      { error: "Équipement désactivé" },
      { status: 409 }
    );
  }

  const newExpirationDate = new Date(parsed.data.expirationDate);

  await prisma.$transaction([
    prisma.siteEquipment.update({
      where: { id: eq.id },
      data: { expirationDate: newExpirationDate },
    }),
    prisma.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "EQUIPMENT_POSTPONED",
        entity: "SiteEquipment",
        entityId: eq.id,
        details: JSON.stringify({
          previousExpirationDate: eq.expirationDate?.toISOString() ?? null,
          newExpirationDate: newExpirationDate.toISOString(),
          reason: parsed.data.reason,
          siteId,
          label: eq.label,
          category: eq.category,
        }),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    id: eq.id,
    expirationDate: newExpirationDate.toISOString(),
  });
}
