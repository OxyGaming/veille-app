import type { RecentActivityItem } from "@/lib/today/types";

type Props = {
  items: RecentActivityItem[];
  /**
   * Titre de section ; permet de réutiliser le composant pour
   * « Dernières activités » côté USER ou « Activité récente » côté ADMIN.
   */
  title?: string;
  /**
   * Si fourni, affiche ce message quand `items` est vide au lieu de masquer
   * la section — utilisé lors de la navigation par jour (/today?date=...)
   * pour distinguer explicitement "rien ce jour-là" d'un état par défaut.
   * Sans cette prop, comportement historique : section masquée si vide.
   */
  emptyMessage?: string;
};

/**
 * Section informative — activité (récente ou du jour consulté), non
 * cliquable. Si `items` est vide et `emptyMessage` absent, la section est
 * entièrement masquée (comportement historique, pas d'empty state intrusif
 * sur la vue "aujourd'hui" par défaut).
 */
export function RecentActivitySection({
  items,
  title = "Dernières activités",
  emptyMessage,
}: Props) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-xs text-slate-500 text-center">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="text-xs text-slate-700 leading-relaxed"
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
