import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import VisitClient from "./VisitClient";
import VisitInventoryClient from "./VisitInventoryClient";
import VisitS6A7Client from "./VisitS6A7Client";

export const dynamic = "force-dynamic";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const visit = await prisma.siteVisit.findFirst({
    // Lecture via le site partagé ; l'édition reste gardée côté API (teamId).
    where: { id, site: siteScope(u) },
    include: {
      template: {
        include: {
          sections: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
      site: true,
      observer: { select: { id: true, name: true } },
      participants: { orderBy: { sortOrder: "asc" } },
      observations: true,
      nonConformities: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!visit) notFound();
  // Bascule de moteur côté serveur : INVENTORY et S6A7 ont leur rendu dédié,
  // alimenté par le catalogue SiteEquipment du domaine correspondant.
  if (visit.template.kind === "INVENTORY") {
    const equipments = await prisma.siteEquipment.findMany({
      where: { siteId: visit.siteId, domain: "VEILLE_SITE" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    return (
      <VisitInventoryClient
        visit={JSON.parse(JSON.stringify(visit))}
        equipments={JSON.parse(JSON.stringify(equipments))}
      />
    );
  }
  if (visit.template.kind === "S6A7") {
    const equipments = await prisma.siteEquipment.findMany({
      where: { siteId: visit.siteId, domain: "S6A7" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    return (
      <VisitS6A7Client
        visit={JSON.parse(JSON.stringify(visit))}
        equipments={JSON.parse(JSON.stringify(equipments))}
      />
    );
  }
  return <VisitClient visit={JSON.parse(JSON.stringify(visit))} />;
}
