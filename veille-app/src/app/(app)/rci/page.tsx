import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import RciListClient from "./RciListClient";

export const dynamic = "force-dynamic";

export default async function RciIndexPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const rcis = await prisma.rci.findMany({
    where: { ...teamScope(u) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      author: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
  });
  const items = rcis.map((r) => ({
    id: r.id,
    status: r.status,
    title: r.title,
    dossierNumber: r.dossierNumber,
    eventAt: r.eventAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    authorName: r.author.name,
    teamName: r.team.name,
    photoCount: r._count.photos,
  }));
  return <RciListClient items={items} />;
}
