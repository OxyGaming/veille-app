import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";

/**
 * Catalogue d'équipements d'un site (référentiel pour les visites de type
 * INVENTORY).
 *
 *  - GET  : tous rôles (lecture seule pour USER).
 *  - POST : ADMIN/EDITOR (création d'un équipement).
 *
 * Le scope team est vérifié côté Site (l'utilisateur doit avoir accès au
 * site en question via une équipe).
 */
const createSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  expectedQuantity: z.number().int().min(0).nullable().optional(),
  isPerishable: z.boolean().default(false),
  expirationDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(
  _req: Request,
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
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });

  const equipments = await prisma.siteEquipment.findMany({
    where: { siteId, isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(equipments);
}

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
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id: siteId } = await ctx.params;
  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });

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
  const created = await prisma.siteEquipment.create({
    data: {
      siteId,
      label: data.label.trim(),
      category: data.category.trim(),
      expectedQuantity: data.expectedQuantity ?? null,
      isPerishable: data.isPerishable,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder,
    },
  });
  return NextResponse.json(created);
}
