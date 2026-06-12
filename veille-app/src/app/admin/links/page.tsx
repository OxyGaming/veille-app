import { prisma } from "@/lib/prisma";
import LinksAdminClient from "./LinksAdminClient";

export const dynamic = "force-dynamic";

export default async function LinksAdminPage() {
  const cats = await prisma.linkCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });
  return <LinksAdminClient initial={cats} />;
}
