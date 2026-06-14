type Props = {
  total: number;
};

/** En-tête sobre — titre + count global. */
export function EcheancesHeader({ total }: Props) {
  return (
    <header className="px-4 lg:px-8 pt-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
        Pilotage
      </p>
      <h1 className="text-2xl font-bold text-slate-900 mt-1">Échéances</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total === 0
          ? "Aucune échéance dans votre périmètre."
          : `${total} échéance${total > 1 ? "s" : ""} sur votre périmètre.`}
      </p>
    </header>
  );
}
