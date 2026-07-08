import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";
import { ITEM_KINDS } from "@/lib/s6a7";

/**
 * Édition / suppression d'un équipement du catalogue site.
 *
 *  - PATCH  : ADMIN/EDITOR
 *  - DELETE : ADMIN/EDITOR
 *      ?mode=soft (défaut) : isActive=false (recommandé si l'équipement
 *        a déjà des observations historiques — préserve la trace)
 *      ?mode=hard : suppression définitive. Les observations en mode
 *        INVENTORY perdent leur lien (equipmentId → null) via la
 *        contrainte onDelete: SetNull.
 */
const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  itemKind: z.enum(ITEM_KINDS).optional(),
  expectedQuantity: z.number().int().min(0).nullable().optional(),
  isPerishable: z.boolean().optional(),
  expirationDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; eqId: string }> }
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
  const { id: siteId, eqId } = await ctx.params;
  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });

  const eq = await prisma.siteEquipment.findFirst({
    where: { id: eqId, siteId },
    select: { id: true },
  });
  if (!eq)
    return NextResponse.json({ error: "Équipement inconnu" }, { status: 404 });

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
  const data = parsed.data;
  const updated = await prisma.siteEquipment.update({
    where: { id: eqId },
    data: {
      label: data.label?.trim(),
      category: data.category?.trim(),
      itemKind: data.itemKind,
      expectedQuantity:
        data.expectedQuantity === undefined
          ? undefined
          : data.expectedQuantity,
      isPerishable: data.isPerishable,
      expirationDate:
        data.expirationDate === undefined
          ? undefined
          : data.expirationDate
          ? new Date(data.expirationDate)
          : null,
      notes: data.notes === undefined ? undefined : data.notes,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; eqId: string }> }
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
  const { id: siteId, eqId } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
  const eq = await prisma.siteEquipment.findFirst({
    where: { id: eqId, siteId },
    select: { id: true, label: true },
  });
  if (!eq)
    return NextResponse.json({ error: "Équipement inconnu" }, { status: 404 });

  if (mode === "soft") {
    await prisma.siteEquipment.update({
      where: { id: eqId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  }
  // mode=hard : SetNull sur observations historiques (cf. schéma).
  await prisma.siteEquipment.delete({ where: { id: eqId } });
  return NextResponse.json({ ok: true, deleted: eq.label });
}
