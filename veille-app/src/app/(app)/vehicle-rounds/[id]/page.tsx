import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, getSessionUser } from "@/lib/auth";
import VehicleRoundClient from "./VehicleRoundClient";

export const dynamic = "force-dynamic";

export default async function VehicleRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const { id } = await params;
  const round = await prisma.vehicleRound.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      vehicle: true,
      observer: { select: { id: true, name: true } },
      observations: true,
    },
  });
  if (!round) notFound();
  if (!assertTeamAccess(u, round.teamId)) redirect("/vehicle-rounds");

  // Map item -> observation pour l'UI client.
  const obsByItem = new Map(round.observations.map((o) => [o.itemId, o]));
  const sections = round.template.sections
    .map((s) => {
      const items = s.items
        .map((it) => {
          let applicableTypes: string[];
          try {
            applicableTypes = JSON.parse(it.applicableTypes);
          } catch {
            applicableTypes = [];
          }
          const applicable =
            applicableTypes.length === 0 ||
            applicableTypes.includes(round.vehicleType);
          if (!applicable) return null;
          const obs = obsByItem.get(it.id);
          return {
            id: it.id,
            label: it.label,
            responseFormat: it.responseFormat,
            applicableTypes,
            observation: obs
              ? {
                  id: obs.id,
                  status: obs.status,
                  comment: obs.comment,
                }
              : null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (items.length === 0) return null;
      return {
        id: s.id,
        title: s.title,
        icon: s.icon,
        items,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <VehicleRoundClient
      round={{
        id: round.id,
        roundDate: round.roundDate.toISOString(),
        status: round.status,
        generalComment: round.generalComment,
        immatriculation: round.immatriculation,
        vehicleType: round.vehicleType,
        vehicleLabel: round.vehicle.label,
        templateName: round.template.name,
        observerName: round.observer.name,
      }}
      sections={sections}
      canEdit={round.status !== "completed"}
    />
  );
}
