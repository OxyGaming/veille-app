import { prisma } from "@/lib/prisma";
import LinksListClient from "./LinksListClient";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const cats = await prisma.linkCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      links: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return (
    <LinksListClient
      categories={cats.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        links: c.links.map((l) => ({
          id: l.id,
          label: l.label,
          url: l.url,
          description: l.description,
        })),
      }))}
    />
  );
}
