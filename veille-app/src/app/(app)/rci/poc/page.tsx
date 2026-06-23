import RciPocClient from "./RciPocClient";

export const dynamic = "force-dynamic";

export default function RciPocPage() {
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-3xl mx-auto">
      <header className="card p-5 lg:p-6 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
          POC — Génération RCI (.docx)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Preuve de concept : 5 champs + 1 photo inline, génération 100 %
          client à partir du modèle EIC RAL v10.
        </p>
      </header>
      <RciPocClient />
    </div>
  );
}
