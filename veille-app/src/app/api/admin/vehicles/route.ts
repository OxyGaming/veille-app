import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { VEHICLE_TYPE_LIST } from "@/lib/vehicle-types";

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ isActive: "desc" }, { immatriculation: "asc" }],
    include: {
      team: { select: { id: true, name: true } },
      _count: { select: { rounds: true } },
    },
  });
  return NextResponse.json(
    vehicles.map((v) => ({
      id: v.id,
      immatriculation: v.immatriculation,
      type: v.type,
      label: v.label,
      teamId: v.teamId,
      teamName: v.team?.name ?? null,
      isActive: v.isActive,
      roundsCount: v._count.rounds,
    }))
  );
}

const createSchema = z.object({
  immatriculation: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.trim().toUpperCase()),
  type: z.enum(VEHICLE_TYPE_LIST as [string, ...string[]]),
  label: z.string().max(160).optional().nullable(),
  teamId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const teamId = data.teamId ?? u.teamId ?? null;
  try {
    const v = await prisma.vehicle.create({
      data: {
        immatriculation: data.immatriculation,
        type: data.type,
        label: data.label ?? null,
        teamId,
      },
    });
    return NextResponse.json(v);
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
}
