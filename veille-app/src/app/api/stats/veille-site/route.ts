import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionScope, requireUser, siteScope } from "@/lib/auth";

/**
 * Stats spécifiques au mode INVENTORY ("Veille de site"). Deux blocs :
 *
 *  - `dashboard` : tableau de bord conformité par site
 *      → dernière visite Veille de site (status=completed) ;
 *      → date de dernière vérification ;
 *      → nombre d'équipements contrôlés / conformes / en écart ;
 *      → taux de conformité ;
 *      → nombre d'actions ouvertes issues de la veille de site.
 *
 *  - `renouveler` : liste des éléments **périssables** dont la date de
 *    péremption est dépassée ou < 30 jours, tous sites confondus, classés
 *    par date d'expiration croissante.
 *
 * Scope :
 *  - `siteScope` pour Site / SiteEquipment ;
 *  - `actionScope` pour ImportedAction.
 */
export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }

  const sScope = siteScope(u);
  const aScope = actionScope(u);
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000);

  const sites = await prisma.site.findMany({
    where: { ...sScope, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // Dernière visite "veille-site" terminée par site (en parallèle).
  const lastVisits = await Promise.all(
    sites.map((s) =>
      prisma.siteVisit.findFirst({
        where: {
          siteId: s.id,
          status: "completed",
          template: { slug: "veille-site" },
        },
        orderBy: { visitDate: "desc" },
        select: {
          id: true,
          visitDate: true,
          finishedAt: true,
          observations: {
            where: { equipmentId: { not: null } },
            select: { discrepancyType: true },
          },
        },
      })
    )
  );

  // Actions ouvertes liées à la veille de site : filtre par tag stocké en
  // JSON. SQLite n'a pas de path JSON, on utilise `contains` sur la string.
  const openActions = await prisma.importedAction.findMany({
    where: {
      ...aScope,
      localStatus: "ACTIVE",
      siteId: { in: sites.map((s) => s.id) },
      tags: { contains: "veille de site" },
    },
    select: { siteId: true },
  });
  const openCount = new Map<string, number>();
  for (const a of openActions) {
    if (!a.siteId) continue;
    openCount.set(a.siteId, (openCount.get(a.siteId) ?? 0) + 1);
  }

  const dashboard = sites.map((s, i) => {
    const v = lastVisits[i];
    const total = v?.observations.length ?? 0;
    const ecarts = v?.observations.filter((o) => o.discrepancyType).length ?? 0;
    const conformes = total - ecarts;
    const rate = total > 0 ? Math.round((conformes / total) * 1000) / 10 : null;
    return {
      siteId: s.id,
      siteName: s.name,
      siteCode: s.code,
      lastVisitId: v?.id ?? null,
      lastVisitDate: v?.visitDate?.toISOString() ?? null,
      total,
      conformes,
      ecarts,
      rate,
      openActions: openCount.get(s.id) ?? 0,
    };
  });

  const eqs = await prisma.siteEquipment.findMany({
    where: {
      isActive: true,
      isPerishable: true,
      expirationDate: { lt: in30 },
      site: sScope,
    },
    select: {
      id: true,
      label: true,
      category: true,
      expirationDate: true,
      expectedQuantity: true,
      site: { select: { id: true, name: true, code: true } },
    },
    orderBy: { expirationDate: "asc" },
  });
  const renouveler = eqs.map((e) => ({
    equipmentId: e.id,
    siteId: e.site.id,
    siteName: e.site.name,
    siteCode: e.site.code,
    category: e.category,
    label: e.label,
    expectedQuantity: e.expectedQuantity,
    expirationDate: e.expirationDate?.toISOString() ?? null,
    status:
      e.expirationDate && e.expirationDate < today ? "EXPIRED" : "SOON",
    daysToExpiry:
      e.expirationDate
        ? Math.round(
            (e.expirationDate.getTime() - today.getTime()) /
              (24 * 3600 * 1000)
          )
        : null,
  }));

  return NextResponse.json({ dashboard, renouveler });
}
