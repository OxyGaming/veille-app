import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import VisitClient from "./VisitClient";

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
    where: { id, ...teamScope(u) },
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
  return (
    <VisitClient
      visit={JSON.parse(JSON.stringify(visit))}
    />
  );
}
