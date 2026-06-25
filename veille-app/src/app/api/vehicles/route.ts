import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Liste des véhicules accessibles à l'utilisateur courant.
 * Servie côté wizard de création de tournée + autocomplete.
 * Filtre `isActive=true` par défaut.
 */
export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const items = await prisma.vehicle.findMany({
    where: {
      ...teamScope(u),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { immatriculation: "asc" },
    include: { team: { select: { id: true, name: true } } },
  });
  return NextResponse.json(
    items.map((v) => ({
      id: v.id,
      immatriculation: v.immatriculation,
      type: v.type,
      label: v.label,
      teamId: v.teamId,
      teamName: v.team?.name ?? null,
      isActive: v.isActive,
    }))
  );
}
