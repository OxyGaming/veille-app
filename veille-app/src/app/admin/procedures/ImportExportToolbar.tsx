"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type Report = {
  strategy: "merge" | "add-only";
  received: number;
  created: number;
  updated: number;
  skipped: number;
  itemsCreated: number;
  errors: string[];
};

/**
 * Boutons import/export pour la page d'admin des procédures.
 *  - Export : déclenche un téléchargement JSON `procedures-YYYY-MM-DD.json`.
 *  - Import : ouvre une modale avec choix de stratégie (merge / add-only).
 */
export default function ImportExportToolbar() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <a
        href="/api/admin/procedures/export"
        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"
        title="Télécharger toutes les procédures en JSON"
      >
        <Icon.Download className="w-4 h-4" /> Exporter
      </a>
      <button
        onClick={() => setShowImport(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"
        title="Charger un fichier JSON de procédures"
      >
        <Icon.Upload className="w-4 h-4" /> Importer
      </button>
      {showImport && (
        <ImportModal
          onCancel={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ImportModal({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [strategy, setStrategy] = useState<"merge" | "add-only">("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    setFilename(file.name);
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        setError("Fichier JSON invalide");
        return;
      }
      const res = await fetch("/api/admin/procedures/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, payload }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Échec de l'import");
      } else {
        setReport(j as Report);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-40"
        onClick={() => !busy && onCancel()}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">Importer des procédures</h3>
          <button
            onClick={onCancel}
            disabled={busy}
            className="ml-auto text-slate-400 hover:text-slate-700 disabled:opacity-30"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Stratégie
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  strategy === "merge"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === "merge"}
                    onChange={() => setStrategy("merge")}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm font-semibold">Fusion</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Met à jour les procédures existantes (par domaine + titre) et
                  crée les nouvelles.
                </div>
              </label>
              <label
                className={`border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  strategy === "add-only"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === "add-only"}
                    onChange={() => setStrategy("add-only")}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm font-semibold">Ajout seul</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  N&apos;écrase rien. Saute les procédures qui existent déjà.
                </div>
              </label>
            </div>
          </div>

          <label className="block border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
            <Icon.Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
            <div className="text-sm font-semibold">
              {filename ?? "Cliquez pour sélectionner le fichier JSON"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Format : export généré par cette même page (version 1)
            </div>
            <input
              type="file"
              accept=".json,application/json"
              hidden
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>

          {busy && (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
              Import en cours…
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Reçues" value={report.received} />
                <Stat
                  label="Créées"
                  value={report.created}
                  color="text-emerald-700"
                />
                <Stat
                  label="MAJ"
                  value={report.updated}
                  color="text-indigo-700"
                />
                <Stat
                  label="Skippées"
                  value={report.skipped}
                  color="text-slate-500"
                />
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {report.itemsCreated} points de checklist générés
              </div>
              {report.errors.length > 0 && (
                <details className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <summary className="text-xs font-semibold text-rose-800 cursor-pointer">
                    Erreurs ({report.errors.length})
                  </summary>
                  <ul className="text-[11px] mt-2 space-y-0.5 max-h-48 overflow-auto font-mono text-rose-800">
                    {report.errors.slice(0, 20).map((it, i) => (
                      <li key={i} className="truncate">
                        · {it}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
          >
            {report ? "Fermer" : "Annuler"}
          </button>
          {report && (
            <button
              onClick={onSuccess}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
            >
              Rafraîchir la liste
            </button>
          )}
        </footer>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  color = "text-slate-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </div>
    </div>
  );
}
