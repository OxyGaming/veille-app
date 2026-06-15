"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type Template = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sectionsCount: number;
  pdfLayout: string;
};
type Site = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
};

export default function NewVisitClient({
  initialSiteId = null,
  templates,
  sites,
}: {
  initialSiteId?: string | null;
  templates: Template[];
  sites: Site[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(initialSiteId);
  const [visitDate, setVisitDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [participants, setParticipants] = useState<
    { fullName: string; function: string }[]
  >([{ fullName: "", function: "" }]);
  const [siteQuery, setSiteQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tpl = templates.find((t) => t.id === templateId) ?? null;
  const site = sites.find((s) => s.id === siteId) ?? null;
  const filteredSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    if (!q) return sites.slice(0, 30);
    return sites
      .filter((s) =>
        `${s.name} ${s.code ?? ""} ${s.type ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [sites, siteQuery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId || !siteId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          siteId,
          visitDate: new Date(visitDate + "T08:00:00").toISOString(),
          participants: participants.filter((p) => p.fullName.trim()),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Échec de la création");
        return;
      }
      router.push(`/visits/${j.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-3xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-bold tracking-tight mb-1">
        Nouvelle visite de site
      </h1>
      <p className="text-sm text-slate-500 mb-5">
        Choisissez un modèle, un site et démarrez la saisie.
      </p>

      <form onSubmit={submit} className="space-y-5">
        {/* Étape 1 — Modèle */}
        <section className="card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Étape 1 — Modèle de visite
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {templates.map((t) => {
              const sel = templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left border rounded-xl p-3 transition-colors ${
                    sel
                      ? "border-indigo-600 bg-indigo-50/60"
                      : "border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-2">
                    {sel && <Icon.Check className="w-4 h-4 text-indigo-600" />}
                    {t.name}
                  </div>
                  {t.description && (
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {t.description}
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-slate-400 mt-1.5">
                    {t.sectionsCount} sections · layout PDF {t.pdfLayout}
                  </div>
                </button>
              );
            })}
            {templates.length === 0 && (
              <div className="text-sm text-slate-500 col-span-full">
                Aucun modèle disponible. Demandez à l&apos;administrateur de
                créer un modèle.
              </div>
            )}
          </div>
        </section>

        {/* Étape 2 — Site */}
        <section className="card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Étape 2 — Site (poste, gare, dépôt…)
          </div>
          {site ? (
            <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div>
                <div className="text-sm font-bold">{site.name}</div>
                <div className="text-[11px] font-mono text-slate-500">
                  {[site.code, site.type].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSiteId(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 underline"
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={siteQuery}
                  onChange={(e) => setSiteQuery(e.target.value)}
                  placeholder="Rechercher un site (nom, code, type)…"
                  className="input pl-9"
                />
              </div>
              <ul className="mt-2 max-h-60 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredSites.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => setSiteId(s.id)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50"
                  >
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {[s.code, s.type].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </li>
                ))}
                {filteredSites.length === 0 && (
                  <li className="px-3 py-3 text-xs text-slate-500 text-center">
                    {sites.length === 0
                      ? "Aucun site n'est défini. Créez-en un depuis Admin → Sites."
                      : "Aucun site ne correspond."}
                  </li>
                )}
              </ul>
            </>
          )}
        </section>

        {/* Étape 3 — Date + participants */}
        <section className="card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Étape 3 — Date et participants
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date de la visite
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="input md:max-w-[200px]"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Participants{" "}
              <span className="text-[10px] text-slate-400">
                (optionnel en V1)
              </span>
            </label>
            <div className="grid gap-2">
              {participants.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center"
                >
                  <input
                    placeholder={`Prénom Nom #${i + 1}`}
                    value={p.fullName}
                    onChange={(e) => {
                      const c = [...participants];
                      c[i] = { ...c[i], fullName: e.target.value };
                      setParticipants(c);
                    }}
                    className="input"
                  />
                  <input
                    placeholder="Fonction"
                    value={p.function}
                    onChange={(e) => {
                      const c = [...participants];
                      c[i] = { ...c[i], function: e.target.value };
                      setParticipants(c);
                    }}
                    className="input"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setParticipants((p) => [...p, { fullName: "", function: "" }])
                }
                className="text-xs text-indigo-600 underline self-start"
              >
                + Ajouter un participant
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!templateId || !siteId || busy}
            className="btn btn-primary"
          >
            <Icon.Plus className="w-4 h-4" />
            {busy ? "Création…" : "Démarrer la visite"}
          </button>
          {tpl && site && (
            <span className="text-xs text-slate-500 font-mono">
              {tpl.name} · {site.name}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
