import { prisma } from "@/lib/prisma";
import VehiclesAdminClient from "./VehiclesAdminClient";

export const dynamic = "force-dynamic";

export default async function VehiclesAdminPage() {
  const [vehicles, teams] = await Promise.all([
    prisma.vehicle.findMany({
      orderBy: [{ isActive: "desc" }, { immatriculation: "asc" }],
      include: {
        team: { select: { id: true, name: true } },
        _count: { select: { rounds: true } },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <VehiclesAdminClient
      initial={vehicles.map((v) => ({
        id: v.id,
        immatriculation: v.immatriculation,
        type: v.type,
        label: v.label,
        teamId: v.teamId,
        teamName: v.team?.name ?? null,
        isActive: v.isActive,
        roundsCount: v._count.rounds,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
