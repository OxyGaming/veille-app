import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import S6A7AdminClient from "./S6A7AdminClient";

export const dynamic = "force-dynamic";

/**
 * Back-office S6A7 — paramétrage par site des deux familles d'éléments :
 *  - Téléphones de voie (constat de fonctionnement, sans action).
 *  - Petit matériel (dispositifs d'attention / matériel divers), logique
 *    trousse de secours.
 *
 * Réservé ADMIN/EDITOR (double garde en plus du layout admin). Les éléments
 * sont stockés dans `SiteEquipment` avec `domain = "S6A7"`.
 */
export default async function S6A7AdminPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN" && u.role !== "EDITOR") redirect("/procedures");

  const sites = await prisma.site.findMany({
    where: { isActive: true, ...siteScope(u) },
    select: { id: true, name: true, code: true },
    orderBy: [{ name: "asc" }],
  });

  return <S6A7AdminClient sites={JSON.parse(JSON.stringify(sites))} />;
}
