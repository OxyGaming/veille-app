import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import SitesListClient from "./SitesListClient";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const sites = await prisma.site.findMany({
    where: { isActive: true, isVisible: true, ...siteScope(u) },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          visits: true,
          importedActions: { where: { localStatus: "ACTIVE" } },
        },
      },
    },
  });
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6">
      <div className="mb-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {sites.length} site(s) (postes d&apos;aiguillage, gares, dépôts…).
          </p>
        </div>
        <Link
          href="/admin/sites"
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          Admin → Sites
        </Link>
      </div>
      <SitesListClient
        sites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          type: s.type,
          address: s.address,
          visitsCount: s._count.visits,
          actionsCount: s._count.importedActions,
        }))}
      />
    </div>
  );
}
