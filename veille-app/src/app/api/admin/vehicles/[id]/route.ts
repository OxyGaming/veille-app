import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { VEHICLE_TYPE_LIST } from "@/lib/vehicle-types";

const patchSchema = z.object({
  immatriculation: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.trim().toUpperCase())
    .optional(),
  type: z.enum(VEHICLE_TYPE_LIST as [string, ...string[]]).optional(),
  label: z.string().max(160).optional().nullable(),
  teamId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
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
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  try {
    await prisma.vehicle.update({
      where: { id },
      data: parsed.data,
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Cette immatriculation existe déjà." },
        { status: 409 }
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}

/**
 * Suppression :
 *  - soft (défaut) : isActive=false, le véhicule disparaît des listes courantes
 *    mais reste lié aux tournées passées.
 *  - hard : suppression définitive uniquement si aucune tournée rattachée.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  if (mode === "soft") {
    await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  const rounds = await prisma.vehicleRound.count({ where: { vehicleId: id } });
  if (rounds > 0) {
    return NextResponse.json(
      {
        error: `Suppression refusée — ${rounds} tournée(s) rattachée(s). Désactivez plutôt le véhicule.`,
      },
      { status: 409 }
    );
  }
  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
