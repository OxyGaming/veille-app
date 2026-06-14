import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  /**
   * Nombre de colonnes par breakpoint. Par défaut : 2 mobile, 3 tablette,
   * 3 desktop — adapté aux blocs de 3 ou 6 KPI.
   */
  cols?: { base: 2 | 3; md?: 2 | 3; lg?: 3 | 4 };
};

/**
 * Section KPI réutilisable — header eyebrow + grille adaptive.
 * Mobile-first : 2 colonnes par défaut pour éviter tout scroll horizontal.
 */
export function KpiSection({
  title,
  children,
  cols = { base: 2, md: 3, lg: 3 },
}: Props) {
  const gridClass = [
    cols.base === 3 ? "grid-cols-3" : "grid-cols-2",
    cols.md === 3 ? "md:grid-cols-3" : cols.md === 2 ? "md:grid-cols-2" : "",
    cols.lg === 4 ? "lg:grid-cols-4" : cols.lg === 3 ? "lg:grid-cols-3" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h2>
      <div className={`grid gap-2.5 ${gridClass}`}>{children}</div>
    </section>
  );
}
