import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import CilListClient from "./CilListClient";

export const dynamic = "force-dynamic";

export default async function CilPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");

  const rows = await prisma.cilIncident.findMany({
    where: { ...teamScope(u) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      author: { select: { name: true } },
      _count: { select: { depeches: true, intervenants: true } },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    type: r.type,
    typeLibre: r.typeLibre,
    lieu: r.lieu,
    status: r.status,
    occurredAt: r.occurredAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
    authorName: r.author.name,
    depeches: r._count.depeches,
    intervenants: r._count.intervenants,
  }));

  return <CilListClient items={items} />;
}
