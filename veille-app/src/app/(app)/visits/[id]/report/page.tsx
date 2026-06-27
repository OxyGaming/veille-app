import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import VisitReportClient from "./VisitReportClient";

export const dynamic = "force-dynamic";

export default async function VisitReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const visit = await prisma.siteVisit.findFirst({
    // Rapport lisible par toutes les équipes du site (cf. cloisonnement §2).
    where: { id, site: siteScope(u) },
    include: {
      template: {
        include: {
          sections: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      site: true,
      observer: true,
      participants: { orderBy: { sortOrder: "asc" } },
      observations: true,
      nonConformities: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!visit) notFound();
  // En mode INVENTORY le rendu PDF s'appuie sur le catalogue d'équipements
  // (pas sur les observations / NC). On le pré-charge ici.
  const equipments =
    visit.template.kind === "INVENTORY"
      ? await prisma.siteEquipment.findMany({
          where: { siteId: visit.siteId, isActive: true },
          orderBy: [
            { category: "asc" },
            { sortOrder: "asc" },
            { label: "asc" },
          ],
        })
      : [];
  return (
    <VisitReportClient
      visit={JSON.parse(JSON.stringify(visit))}
      equipments={JSON.parse(JSON.stringify(equipments))}
    />
  );
}
