import { prisma } from "@/lib/prisma";
import VehicleRoundTemplatesClient from "./VehicleRoundTemplatesClient";

export const dynamic = "force-dynamic";

export default async function VehicleRoundTemplatesPage() {
  const templates = await prisma.vehicleRoundTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return (
    <VehicleRoundTemplatesClient
      templates={templates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        expectedFrequencyDays: t.expectedFrequencyDays,
        sections: t.sections.map((s) => ({
          id: s.id,
          title: s.title,
          icon: s.icon,
          items: s.items.map((i) => ({
            id: i.id,
            label: i.label,
            applicableTypes: (() => {
              try {
                return JSON.parse(i.applicableTypes) as string[];
              } catch {
                return [];
              }
            })(),
            responseFormat: i.responseFormat,
            sortOrder: i.sortOrder,
            isActive: i.isActive,
          })),
        })),
      }))}
    />
  );
}
