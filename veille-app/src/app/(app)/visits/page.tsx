import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import { Icon } from "@/components/icons";
import VisitsListClient from "./VisitsListClient";
import { vehicleTypeLabel } from "@/lib/vehicle-types";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const [visits, rounds] = await Promise.all([
    prisma.siteVisit.findMany({
      where: teamScope(u),
      orderBy: { visitDate: "desc" },
      take: 100,
      include: {
        template: { select: { name: true, slug: true } },
        site: { select: { id: true, name: true, code: true } },
        observer: { select: { name: true } },
        // Sélectionne juste `redressedDate` pour calculer ouvertes vs
        // redressées côté JS. Cap implicite par le nombre de NC par visite,
        // qui reste petit (≤ 30 typiquement). Sinon basculer sur _count
        // avec filtre `where` (Prisma 5+).
        nonConformities: { select: { redressedDate: true } },
      },
    }),
    prisma.vehicleRound.findMany({
      where: teamScope(u),
      orderBy: { roundDate: "desc" },
      take: 100,
      include: {
        template: { select: { name: true, slug: true } },
        vehicle: { select: { label: true } },
        observer: { select: { name: true } },
        nonConformities: { select: { redressedDate: true } },
      },
    }),
  ]);

  function ncCounts(rows: { redressedDate: Date | null }[]): {
    open: number;
    redressed: number;
  } {
    let open = 0;
    let redressed = 0;
    for (const r of rows) {
      if (r.redressedDate) redressed++;
      else open++;
    }
    return { open, redressed };
  }

  const visitItems = visits.map((v) => {
    const nc = ncCounts(v.nonConformities);
    return {
      kind: "visit" as const,
      id: v.id,
      date: v.visitDate.toISOString(),
      status: v.status,
      templateName: v.template.name,
      templateSlug: v.template.slug,
      targetLabel: v.site.name,
      targetSubtitle: v.site.code ?? null,
      observerName: v.observer.name,
      ncOpen: nc.open,
      ncRedressed: nc.redressed,
      href: `/visits/${v.id}`,
      reportUrl: `/visits/${v.id}/report`,
    };
  });
  const roundItems = rounds.map((r) => {
    const nc = ncCounts(r.nonConformities);
    return {
      kind: "vehicle-round" as const,
      id: r.id,
      date: r.roundDate.toISOString(),
      status: r.status,
      templateName: r.template.name,
      templateSlug: r.template.slug,
      targetLabel: r.immatriculation,
      targetSubtitle: `${vehicleTypeLabel(r.vehicleType)}${r.vehicle.label ? ` · ${r.vehicle.label}` : ""}`,
      observerName: r.observer.name,
      ncOpen: nc.open,
      ncRedressed: nc.redressed,
      href: `/vehicle-rounds/${r.id}`,
      reportUrl: `/vehicle-rounds/${r.id}/report`,
    };
  });
  const items = [...visitItems, ...roundItems].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            Visites &amp; Tournées
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visites de site (trimestrielle, planifiée…) et tournées véhicule de
            service.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/vehicle-rounds/new"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50"
          >
            <Icon.Truck className="w-4 h-4" /> Nouvelle tournée
          </Link>
          <Link href="/visits/new" className="btn btn-primary">
            <Icon.Plus className="w-4 h-4" /> Nouvelle visite
          </Link>
        </div>
      </div>
      <VisitsListClient
        userRole={u.role as "USER" | "EDITOR" | "ADMIN"}
        items={items}
      />
    </div>
  );
}
