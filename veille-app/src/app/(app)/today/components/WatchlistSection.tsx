import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Total agrégé côté serveur (pour le compteur « 5 sur N »). */
  total: number;
  /** Nombre d'items réellement affichés (typiquement ≤ 5). */
  shown: number;
  /** Message d'état vide quand `shown === 0`. */
  emptyMessage: string;
  children: ReactNode;
};

/**
 * Coque réutilisable pour les watchlists. Header eyebrow + compteur,
 * liste ou empty state, lien « Voir tous » désactivé (cf. C5 — sera activé
 * en même temps que la page /echeances V2).
 */
export function WatchlistSection({
  title,
  total,
  shown,
  emptyMessage,
  children,
}: Props) {
  const hasMore = total > shown;
  return (
    <section className="px-4 lg:px-8 mt-6">
      <header className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {shown > 0 && (
          <span className="text-[11px] font-mono text-slate-500">
            {shown === total ? `${total}` : `${shown} sur ${total}`}
          </span>
        )}
      </header>
      {shown === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            disabled
            className="text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            title="Vue complète disponible dans une prochaine version"
          >
            Voir tous ({total}) — bientôt
          </button>
        </div>
      )}
    </section>
  );
}
