import type { RecentActivityItem } from "@/lib/today/types";

type Props = {
  items: RecentActivityItem[];
  /**
   * Titre de section ; permet de réutiliser le composant pour
   * « Dernières activités » côté USER ou « Activité récente » côté ADMIN.
   */
  title?: string;
};

/**
 * Section informative — 3 à 5 lignes d'activité récente, non cliquables.
 * Objectif : continuité visuelle, pas navigation. Si la liste est vide,
 * la section est entièrement masquée (pas d'empty state intrusif).
 */
export function RecentActivitySection({
  items,
  title = "Dernières activités",
}: Props) {
  if (items.length === 0) return null;
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h2>
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
    </section>
  );
}
