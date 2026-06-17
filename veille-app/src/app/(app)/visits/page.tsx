import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import { Icon } from "@/components/icons";
import VisitsListClient from "./VisitsListClient";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const visits = await prisma.siteVisit.findMany({
    where: teamScope(u),
    orderBy: { visitDate: "desc" },
    take: 100,
    include: {
      template: { select: { name: true, slug: true } },
      site: { select: { id: true, name: true, code: true } },
      observer: { select: { name: true } },
      _count: { select: { nonConformities: true } },
    },
  });
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            Visites de site
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Trimestrielle incendie, visite planifiée et autres contrôles.
          </p>
        </div>
        <Link href="/visits/new" className="btn btn-primary">
          <Icon.Plus className="w-4 h-4" /> Nouvelle visite
        </Link>
      </div>
      <VisitsListClient
        userRole={u.role as "USER" | "EDITOR" | "ADMIN"}
        visits={visits.map((v) => ({
          id: v.id,
          visitDate: v.visitDate.toISOString(),
          status: v.status,
          templateName: v.template.name,
          templateSlug: v.template.slug,
          siteName: v.site.name,
          siteCode: v.site.code,
          observerName: v.observer.name,
          ncCount: v._count.nonConformities,
        }))}
      />
    </div>
  );
}
