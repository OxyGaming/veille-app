import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Stats qualité de saisie :
 *  - conformityRate     : par section, % CONFORME vs NON_CONFORME vs SANS_OBJET
 *  - ncPerTemplate      : nombre moyen de NC par visite, par template
 *  - photoCoverage      : % de Notes / Vu / NC avec photos
 *  - ncRecurrence       : NC qui réapparaissent sur visites successives d'un site
 */
export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from") + "T00:00:00")
    : new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to") + "T23:59:59")
    : new Date();

  const scope = teamScope(u);

  const [obs, visits, agentSightings, siteSightings] = await Promise.all([
    // Observations dans la fenêtre, avec section + template.
    prisma.siteVisitObservation.findMany({
      where: {
        visit: { ...scope, visitDate: { gte: from, lte: to } },
      },
      select: {
        status: true,
        section: { select: { title: true, evalMode: true } },
      },
    }),
    // Visites + NC count + template.
    prisma.siteVisit.findMany({
      where: { ...scope, visitDate: { gte: from, lte: to } },
      select: {
        siteId: true,
        site: { select: { name: true } },
        template: { select: { name: true } },
        nonConformities: { select: { id: true, description: true } },
      },
    }),
    // Sightings agent avec photos count.
    prisma.agentSighting.findMany({
      where: { ...scope, sightedAt: { gte: from, lte: to } },
      select: {
        kind: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.siteSighting.findMany({
      where: { ...scope, sightedAt: { gte: from, lte: to } },
      select: {
        kind: true,
        _count: { select: { photos: true } },
      },
    }),
  ]);

  // 1. Taux de conformité par section.
  const bySectionMap = new Map<
    string,
    { conform: number; nonConform: number; sansObjet: number }
  >();
  for (const o of obs) {
    // Mode INVENTORY : observation rattachée à un SiteEquipment, pas à une
    // section. On l'ignore ici, le taux par section est dérivé seulement
    // des modes CHECKLIST (PER_ITEM / PER_SECTION).
    if (!o.section) continue;
    const title = o.section.title;
    const row = bySectionMap.get(title) ?? {
      conform: 0,
      nonConform: 0,
      sansObjet: 0,
    };
    if (o.status === "CONFORME" || o.status === "OUI") row.conform++;
    else if (o.status === "NON_CONFORME" || o.status === "NON")
      row.nonConform++;
    else if (o.status === "SANS_OBJET") row.sansObjet++;
    bySectionMap.set(title, row);
  }
  const conformityRate = [...bySectionMap.entries()]
    .map(([title, c]) => {
      const total = c.conform + c.nonConform + c.sansObjet;
      return {
        title,
        conform: c.conform,
        nonConform: c.nonConform,
        sansObjet: c.sansObjet,
        total,
        rate: total > 0 ? Math.round((c.conform / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // 2. NC par template.
  const byTpl = new Map<string, { visits: number; nc: number }>();
  for (const v of visits) {
    const k = v.template.name;
    const row = byTpl.get(k) ?? { visits: 0, nc: 0 };
    row.visits++;
    row.nc += v.nonConformities.length;
    byTpl.set(k, row);
  }
  const ncPerTemplate = [...byTpl.entries()].map(([name, r]) => ({
    name,
    visits: r.visits,
    nc: r.nc,
    avg: r.visits > 0 ? Math.round((r.nc / r.visits) * 10) / 10 : 0,
  }));

  // 3. Couverture en photos.
  const cover = (
    items: { _count: { photos: number } }[],
    kindMatch?: (i: { kind: string }) => boolean
  ) => {
    let withP = 0;
    let total = 0;
    for (const i of items as {
      kind: string;
      _count: { photos: number };
    }[]) {
      if (kindMatch && !kindMatch(i)) continue;
      total++;
      if (i._count.photos > 0) withP++;
    }
    return { with: withP, total };
  };
  const allSightings = [...agentSightings, ...siteSightings];
  const photoCoverage = {
    notes: cover(allSightings, (i) => i.kind === "NOTE"),
    sightings: cover(allSightings, (i) => i.kind === "SIGHT"),
  };

  // 4. NC récidivantes sur un même site.
  // Normalisation simple : description.toLowerCase().slice(0,80)
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  const ncBySite = new Map<string, Map<string, number>>();
  const siteNameMap = new Map<string, string>();
  for (const v of visits) {
    siteNameMap.set(v.siteId, v.site.name);
    for (const nc of v.nonConformities) {
      const key = norm(nc.description);
      if (!key) continue;
      const m = ncBySite.get(v.siteId) ?? new Map<string, number>();
      m.set(key, (m.get(key) ?? 0) + 1);
      ncBySite.set(v.siteId, m);
    }
  }
  const ncRecurrence: {
    siteName: string;
    description: string;
    occurrences: number;
  }[] = [];
  for (const [siteId, m] of ncBySite) {
    for (const [desc, n] of m) {
      if (n >= 2) {
        ncRecurrence.push({
          siteName: siteNameMap.get(siteId) ?? "—",
          description: desc,
          occurrences: n,
        });
      }
    }
  }
  ncRecurrence.sort((a, b) => b.occurrences - a.occurrences);

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    conformityRate,
    ncPerTemplate,
    photoCoverage,
    ncRecurrence: ncRecurrence.slice(0, 20),
  });
}
