import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentScope, requireUser, siteScope, teamScope } from "@/lib/auth";

/**
 * Liste les valeurs disponibles pour les filtres de la page Historique :
 *  - utilisateurs ayant produit au moins un événement dans le scope
 *  - agents visibles
 *  - sites visibles
 */
export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const scope = teamScope(u);
  const [users, agents, sites] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.agent.findMany({
      where: { isActive: true, isVisible: true, ...agentScope(u) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, lastName: true, firstName: true, matricule: true },
    }),
    prisma.site.findMany({
      where: { isActive: true, isVisible: true, ...siteScope(u) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);
  // marque non utilisée mais expose la scope pour future extension UI
  void scope;
  return NextResponse.json({ users, agents, sites });
}
