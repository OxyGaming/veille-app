import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Synoptique Secteur",
};

/**
 * Synoptique Secteur — plan de voies interactif (Peyraud / Givors Canal).
 *
 * Le viewer est un document HTML autonome (canvas SVG + éditeur), servi
 * statiquement depuis `public/synoptique-secteur.html`. On l'embarque en
 * iframe plein cadre à l'intérieur de l'AppShell : la navigation de
 * l'application reste visible autour, l'utilisateur va et vient entre les
 * pages sans quitter l'app — le synoptique fait partie intégrante de Veille.
 */
export default function SynoptiquePage() {
  return (
    <div className="w-full h-full bg-slate-900">
      <iframe
        src="/synoptique-secteur.html"
        title="Synoptique Secteur — plan de voies du secteur Veille"
        className="block w-full h-full border-0"
        loading="lazy"
      />
    </div>
  );
}
