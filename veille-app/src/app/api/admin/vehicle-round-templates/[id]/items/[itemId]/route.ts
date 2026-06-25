import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  RESPONSE_FORMATS,
  VEHICLE_TYPE_LIST,
} from "@/lib/vehicle-types";

const patchSchema = z.object({
  label: z.string().min(1).max(280).optional(),
  applicableTypes: z
    .array(z.enum(VEHICLE_TYPE_LIST as [string, ...string[]]))
    .optional(),
  responseFormat: z
    .enum(Object.values(RESPONSE_FORMATS) as [string, ...string[]])
    .optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id: templateId, itemId } = await ctx.params;
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
  const item = await prisma.vehicleRoundItem.findUnique({
    where: { id: itemId },
    include: { section: true },
  });
  if (!item || item.section.templateId !== templateId) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }
  await prisma.vehicleRoundItem.update({
    where: { id: itemId },
    data: {
      label: parsed.data.label,
      applicableTypes:
        parsed.data.applicableTypes !== undefined
          ? JSON.stringify(parsed.data.applicableTypes)
          : undefined,
      responseFormat: parsed.data.responseFormat,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  });
  return NextResponse.json({ ok: true });
}

/**
 * Suppression :
 *  - soft (défaut) : isActive=false, l'item ne sera plus inclus dans les
 *    nouvelles tournées mais reste lié aux observations passées.
 *  - hard : suppression définitive si aucune observation rattachée.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id: templateId, itemId } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const item = await prisma.vehicleRoundItem.findUnique({
    where: { id: itemId },
    include: { section: true },
  });
  if (!item || item.section.templateId !== templateId) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }
  if (mode === "soft") {
    await prisma.vehicleRoundItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  }
  const obsCount = await prisma.vehicleRoundObservation.count({
    where: { itemId },
  });
  if (obsCount > 0) {
    return NextResponse.json(
      {
        error: `Suppression refusée — ${obsCount} observation(s) rattachée(s). Désactivez plutôt l'item.`,
      },
      { status: 409 }
    );
  }
  await prisma.vehicleRoundItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
