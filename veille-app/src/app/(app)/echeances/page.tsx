/**
 * Hub Échéances — vue centralisée pour EDITOR + ADMIN (Sprint 4 C5).
 *
 * Server Component. Appelle directement l'agrégateur (pas de fetch
 * HTTP) — même pattern que `/today`. Toute la donnée est rendue côté
 * serveur, l'UI gère ensuite localement la pagination « Afficher 25 de
 * plus » via un Client Component par groupe.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { aggregateEcheances } from "@/lib/echeances/aggregator";
import { isEcheancesEnabled } from "@/lib/featureFlags";
import { EcheancesHeader } from "./components/EcheancesHeader";
import { EcheancesKpiBar } from "./components/EcheancesKpiBar";
import { EcheanceGroup } from "./components/EcheanceGroup";
import type { EcheanceUrgency } from "@/lib/echeances/types";

export const dynamic = "force-dynamic";

const GROUP_TITLES: Record<EcheanceUrgency, string> = {
  late: "En retard",
  today: "Aujourd'hui",
  soon: "Dans les 7 jours",
  later: "Dans les 30 jours",
  future: "Plus tard",
};

const GROUP_ORDER: EcheanceUrgency[] = [
  "late",
  "today",
  "soon",
  "later",
  "future",
];

export default async function EcheancesPage() {
  if (!isEcheancesEnabled()) redirect("/today");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "USER") redirect("/today");

  const payload = await aggregateEcheances(user, new Date());

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <EcheancesHeader total={payload.total} />
      <EcheancesKpiBar kpis={payload.kpis} />

      {payload.total === 0 ? (
        <div className="mx-4 lg:mx-8 mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 text-center">
          Aucune échéance dans votre périmètre.
        </div>
      ) : (
        GROUP_ORDER.map((u) => (
          <EcheanceGroup
            key={u}
            urgency={u}
            title={GROUP_TITLES[u]}
            items={payload.groups[u]}
          />
        ))
      )}
    </div>
  );
}
