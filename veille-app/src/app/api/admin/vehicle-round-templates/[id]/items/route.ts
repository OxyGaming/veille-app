import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  RESPONSE_FORMATS,
  VEHICLE_TYPE_LIST,
} from "@/lib/vehicle-types";

const createSchema = z.object({
  sectionId: z.string().min(1),
  label: z.string().min(1).max(280),
  applicableTypes: z
    .array(z.enum(VEHICLE_TYPE_LIST as [string, ...string[]]))
    .default([]),
  responseFormat: z
    .enum(Object.values(RESPONSE_FORMATS) as [string, ...string[]])
    .default(RESPONSE_FORMATS.PRESENT_ABSENT),
  sortOrder: z.number().int().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id: templateId } = await ctx.params;
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
  const section = await prisma.vehicleRoundSection.findFirst({
    where: { id: parsed.data.sectionId, templateId },
  });
  if (!section) {
    return NextResponse.json(
      { error: "Section introuvable" },
      { status: 404 }
    );
  }
  const maxOrder = await prisma.vehicleRoundItem.findFirst({
    where: { sectionId: section.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = parsed.data.sortOrder ?? (maxOrder?.sortOrder ?? -1) + 1;
  const item = await prisma.vehicleRoundItem.create({
    data: {
      sectionId: section.id,
      label: parsed.data.label,
      applicableTypes: JSON.stringify(parsed.data.applicableTypes),
      responseFormat: parsed.data.responseFormat,
      sortOrder,
    },
  });
  return NextResponse.json(item);
}
