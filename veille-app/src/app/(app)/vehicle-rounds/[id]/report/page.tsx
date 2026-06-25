import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, getSessionUser } from "@/lib/auth";
import VehicleRoundReportClient from "./VehicleRoundReportClient";

export const dynamic = "force-dynamic";

export default async function VehicleRoundReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
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
      vehicle: { include: { team: { select: { name: true } } } },
      observer: true,
      observations: true,
    },
  });
  if (!round) notFound();
  if (!assertTeamAccess(u, round.teamId)) redirect("/vehicle-rounds");
  return (
    <VehicleRoundReportClient round={JSON.parse(JSON.stringify(round))} />
  );
}
