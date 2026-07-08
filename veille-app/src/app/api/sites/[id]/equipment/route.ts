import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";
import { EQUIPMENT_DOMAINS, ITEM_KINDS } from "@/lib/s6a7";
import {
  defaultMessageFor,
  formatQuotedSnippet,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";

/**
 * Catalogue d'équipements d'un site (référentiel pour les visites de type
 * INVENTORY et S6A7).
 *
 *  - GET  : tous rôles (lecture seule pour USER). Filtré par `?domain=`
 *           (défaut VEILLE_SITE) pour ne pas mélanger les référentiels
 *           veille de site et S6A7.
 *  - POST : ADMIN/EDITOR (création d'un équipement).
 *
 * Le scope team est vérifié côté Site (l'utilisateur doit avoir accès au
 * site en question via une équipe).
 */
const createSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  itemKind: z.enum(ITEM_KINDS).default("MATERIEL"),
  domain: z.enum(EQUIPMENT_DOMAINS).default("VEILLE_SITE"),
  expectedQuantity: z.number().int().min(0).nullable().optional(),
  isPerishable: z.boolean().default(false),
  expirationDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(
  req: Request,
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

  // Filtre par domaine (défaut VEILLE_SITE) : le catalogue veille de site et
  // le référentiel S6A7 vivent dans la même table mais ne se mélangent pas.
  const domainParam = new URL(req.url).searchParams.get("domain");
  const domain = EQUIPMENT_DOMAINS.includes(
    domainParam as (typeof EQUIPMENT_DOMAINS)[number],
  )
    ? (domainParam as (typeof EQUIPMENT_DOMAINS)[number])
    : "VEILLE_SITE";

  const equipments = await prisma.siteEquipment.findMany({
    where: { siteId, isActive: true, domain },
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
      itemKind: data.itemKind,
      domain: data.domain,
      expectedQuantity: data.expectedQuantity ?? null,
      isPerishable: data.isPerishable,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder,
    },
  });

  // Flux d'activité — duplique sur toutes les équipes du site.
  // targetUrl pointe vers la fiche site (pas de fiche équipement V1).
  const siteFull = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      name: true,
      teamId: true,
      memberships: { select: { teamId: true } },
    },
  });
  if (siteFull) {
    const teamIds = [
      ...new Set([
        ...(siteFull.teamId ? [siteFull.teamId] : []),
        ...siteFull.memberships.map((m) => m.teamId),
      ]),
    ];
    const label = `${data.category.trim()} — ${data.label.trim()}`;
    // Enrichi C10 — quantité attendue, date de péremption, notes.
    const detailBits: string[] = [];
    if (data.expectedQuantity)
      detailBits.push(`Qté ${data.expectedQuantity}.`);
    if (data.expirationDate)
      detailBits.push(`Péremption ${data.expirationDate.slice(0, 10)}.`);
    await recordActivitySafe({
      teamIds,
      actorId: u.id,
      actorName: u.name,
      type: "EQUIPMENT_ADDED",
      entityType: "equipment",
      entityId: created.id,
      entityLabel: label,
      message: joinActivityParts([
        defaultMessageFor({
          type: "EQUIPMENT_ADDED",
          actorName: u.name,
          entityLabel: label,
        }),
        detailBits.join(" ") || null,
        formatQuotedSnippet(data.notes),
      ]),
      targetUrl: `/sites/${siteId}`,
      metadata: {
        siteId,
        siteName: siteFull.name,
        equipmentId: created.id,
        category: data.category,
        label: data.label,
      },
    });
  }

  return NextResponse.json(created);
}
