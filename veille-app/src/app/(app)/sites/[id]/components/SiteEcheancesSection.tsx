/**
 * Section « Échéances du site » (Sprint 4 C8).
 *
 * Server Component. Réutilise `getEcheancesForSite` du C3 (3 sources
 * parallèles scopées siteId) — pas de N+1, pas de fetch HTTP.
 *
 * Regroupement par type (4 sous-blocs) : visite trim, visite plan,
 * équipements, actions. Sous-blocs vides masqués. Si tout est vide,
 * EmptyState global. Lien retour Hub uniquement si l'utilisateur peut
 * accéder au Hub (EDITOR / ADMIN — cf. D2).
 */

import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { EcheanceRow } from "@/app/(app)/echeances/components/EcheanceRow";
import { getEcheancesForSite } from "@/lib/echeances/sources";
import type { EcheanceItem, EcheanceKind } from "@/lib/echeances/types";

type Props = {
  user: SessionUser;
  siteId: string;
  siteIsOccupied: boolean;
};

const KIND_TITLE: Record<EcheanceKind, string> = {
  VISIT_QUARTERLY: "Visite trimestrielle",
  VISIT_PLANNED: "Visite planifiée",
  // VEHICLE_ROUND est rattaché à un véhicule, pas à un site — pas affiché
  // ici, mais le label reste défini pour satisfaire `Record<EcheanceKind>`.
  VEHICLE_ROUND: "Tournée véhicule",
  EQUIPMENT_EXPIRING: "Équipements expirants",
  ACTION_OVERDUE: "Actions ouvertes",
};

// Ordre des sections rendues — VEHICLE_ROUND volontairement exclu (cf. ci-dessus).
const KIND_ORDER: EcheanceKind[] = [
  "VISIT_QUARTERLY",
  "VISIT_PLANNED",
  "EQUIPMENT_EXPIRING",
  "ACTION_OVERDUE",
];

const LIST_LIMIT = 5;

export async function SiteEcheancesSection({
  user,
  siteId,
  siteIsOccupied,
}: Props) {
  const items = await getEcheancesForSite(user, siteId, new Date());
  const byKind: Record<EcheanceKind, EcheanceItem[]> = {
    VISIT_QUARTERLY: [],
    VISIT_PLANNED: [],
    VEHICLE_ROUND: [],
    EQUIPMENT_EXPIRING: [],
    ACTION_OVERDUE: [],
  };
  for (const item of items) byKind[item.kind].push(item);

  const canSeeHub = user.role === "EDITOR" || user.role === "ADMIN";
  const total = items.length;

  return (
    <section className="mt-6">
      <header className="flex items-baseline justify-between gap-2 mb-2.5">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Icon.Calendar className="w-4 h-4 text-indigo-600" />
          Échéances du site
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {total === 0
            ? "Tout est à jour"
            : `${total} échéance${total > 1 ? "s" : ""}`}
        </span>
      </header>

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Aucune échéance à signaler pour ce site.
        </div>
      ) : (
        <div className="space-y-3">
          {KIND_ORDER.map((k) => {
            const list = byKind[k];
            if (list.length === 0) return null;
            const visible = list.slice(0, LIST_LIMIT);
            const remaining = list.length - visible.length;
            // Pour les visites (trim/plan) on indique la cadence appliquée
            // selon Site.isOccupied — confirme visuellement la règle 90 /
            // 180 / 365 (D + memory/business-rules).
            const cadenceHint =
              k === "VISIT_QUARTERLY"
                ? "Cadence 90 jours"
                : k === "VISIT_PLANNED"
                  ? siteIsOccupied
                    ? "Cadence 180 jours (site occupé)"
                    : "Cadence 365 jours (site inoccupé)"
                  : null;
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-600">
                    {KIND_TITLE[k]}
                  </h3>
                  {cadenceHint && (
                    <span className="text-[10px] text-slate-400">
                      {cadenceHint}
                    </span>
                  )}
                </div>
                <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                  {visible.map((item) => (
                    <EcheanceRow key={item.id} item={item} />
                  ))}
                </ul>
                {remaining > 0 && canSeeHub && (
                  <Link
                    href={`/echeances?siteId=${siteId}&type=${k}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Voir les {remaining} de plus
                    <Icon.ChevronRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            );
          })}

          {canSeeHub && (
            <div className="pt-1">
              <Link
                href={`/echeances?siteId=${siteId}`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Voir toutes les échéances du site
                <Icon.ChevronRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
