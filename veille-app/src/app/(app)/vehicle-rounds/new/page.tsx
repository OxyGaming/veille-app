import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, teamScope } from "@/lib/auth";
import NewVehicleRoundClient from "./NewVehicleRoundClient";

export const dynamic = "force-dynamic";

export default async function NewVehicleRoundPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const vehicles = await prisma.vehicle.findMany({
    where: { ...teamScope(u), isActive: true },
    orderBy: { immatriculation: "asc" },
    include: { team: { select: { name: true } } },
  });
  // Dernière tournée par véhicule (pour afficher la fraîcheur).
  const lastRounds = await prisma.vehicleRound.groupBy({
    by: ["vehicleId"],
    _max: { roundDate: true },
    where: teamScope(u),
  });
  const lastByVehicle = new Map(
    lastRounds.map((r) => [r.vehicleId, r._max.roundDate])
  );
  return (
    <NewVehicleRoundClient
      vehicles={vehicles.map((v) => ({
        id: v.id,
        immatriculation: v.immatriculation,
        type: v.type,
        label: v.label,
        teamName: v.team?.name ?? null,
        lastRoundAt: lastByVehicle.get(v.id)?.toISOString() ?? null,
      }))}
    />
  );
}
