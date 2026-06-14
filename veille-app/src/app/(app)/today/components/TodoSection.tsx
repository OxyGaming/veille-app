import type { ScoredItem } from "@/lib/today/types";
import { TodoCard } from "./TodoCard";
import { EmptyState } from "./EmptyState";

type Props = {
  items: ScoredItem[];
  total: number;
};

/**
 * Section « À traiter aujourd'hui » — au maximum 5 cartes. Si plus d'items
 * existent, un bouton « Voir tout (N) » s'affiche (non fonctionnel V1,
 * la page /echeances arrive en Sprint 4 avec le Hub Échéances).
 */
export function TodoSection({ items, total }: Props) {
  return (
    <section className="px-4 lg:px-8 mt-6">
      <header className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          À traiter aujourd&apos;hui
        </h2>
        {items.length > 0 && (
          <span className="text-[11px] font-mono text-slate-500">
            {items.length === total
              ? pluralizeItems(items.length)
              : `${items.length} sur ${total}`}
          </span>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune urgence aujourd'hui"
          hint="Reprenez une veille en cours ou démarrez-en une nouvelle."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <TodoCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {total > items.length && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            disabled
            className="text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            title="Vue complète disponible dans une prochaine version"
          >
            Voir tout ({total}) — bientôt
          </button>
        </div>
      )}
    </section>
  );
}

function pluralizeItems(n: number): string {
  return n <= 1 ? `${n} item` : `${n} items`;
}
