import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import NewVisitClient from "./NewVisitClient";

export const dynamic = "force-dynamic";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const [templates, sites] = await Promise.all([
    prisma.siteVisitTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { sections: true } } },
    }),
    prisma.site.findMany({
      where: { isActive: true, isVisible: true, ...siteScope(u) },
      orderBy: { name: "asc" },
    }),
  ]);
  if (siteId && !sites.some((s) => s.id === siteId)) notFound();
  return (
    <NewVisitClient
      initialSiteId={siteId ?? null}
      templates={templates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        sectionsCount: t._count.sections,
        pdfLayout: t.pdfLayout,
      }))}
      sites={sites.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        type: s.type,
      }))}
    />
  );
}
