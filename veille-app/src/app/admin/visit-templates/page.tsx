import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VisitTemplatesAdminPage() {
  const templates = await prisma.siteVisitTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { items: true } } },
      },
      _count: { select: { visits: true } },
    },
  });
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Modèles de visite</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Grilles utilisées par les utilisateurs pour conduire leurs visites de
          site. En V1, les modèles sont seedés ; l&apos;édition viendra dans une
          version ultérieure.
        </p>
      </div>
      <div className="grid gap-4">
        {templates.map((t) => (
          <section
            key={t.id}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2 flex-wrap">
                  {t.name}
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border ${
                      t.kind === "INVENTORY"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                    title={
                      t.kind === "INVENTORY"
                        ? "Items générés depuis le catalogue Équipements du site"
                        : "Items définis par le template"
                    }
                  >
                    {t.kind}
                  </span>
                </h2>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  {t.slug} ·{" "}
                  {t.kind === "INVENTORY"
                    ? "items dynamiques (catalogue site)"
                    : `${t.sections.length} sections`}{" "}
                  · {t._count.visits} visite(s) instanciée(s)
                  {t.expectedFrequencyDays && (
                    <>
                      {" · "}
                      <span className="text-indigo-700">
                        tous les {t.expectedFrequencyDays} jours
                      </span>
                    </>
                  )}
                </div>
                {t.description && (
                  <p className="text-sm text-slate-600 mt-1">{t.description}</p>
                )}
              </div>
              <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded">
                Layout PDF : {t.pdfLayout}
              </span>
            </div>
            {t.kind === "INVENTORY" && (
              <div className="mt-3 text-xs text-slate-500 bg-emerald-50/40 border border-emerald-100 rounded-lg px-3 py-2">
                Les éléments contrôlés viennent du catalogue
                <code className="font-mono mx-1">SiteEquipment</code>
                de chaque site visité. Pour gérer le référentiel, ouvre une
                fiche site et utilise la section « Équipements attendus ».
              </div>
            )}
            <ul className="mt-3 grid gap-1 text-xs">
              {t.sections.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50"
                >
                  <span className="text-slate-400 font-mono w-6">
                    {s.sortOrder + 1}
                  </span>
                  {s.icon && <span>{s.icon}</span>}
                  <span className="font-semibold flex-1">{s.title}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      s.evalMode === "PER_ITEM"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-indigo-50 text-indigo-700"
                    }`}
                  >
                    {s.evalMode === "PER_ITEM" ? "par item" : "par section"}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {s._count.items} items
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
