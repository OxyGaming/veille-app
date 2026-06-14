type Props = {
  total: number;
  filtered?: boolean;
};

/** En-tête sobre — titre + count global (ou count filtré). */
export function EcheancesHeader({ total, filtered = false }: Props) {
  return (
    <header className="px-4 lg:px-8 pt-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
        Pilotage
      </p>
      <h1 className="text-2xl font-bold text-slate-900 mt-1">Échéances</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total === 0
          ? filtered
            ? "Aucune échéance ne correspond aux filtres actifs."
            : "Aucune échéance dans votre périmètre."
          : filtered
            ? `${total} échéance${total > 1 ? "s" : ""} affichée${total > 1 ? "s" : ""} (filtres actifs).`
            : `${total} échéance${total > 1 ? "s" : ""} sur votre périmètre.`}
      </p>
    </header>
  );
}
