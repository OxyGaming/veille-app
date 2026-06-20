"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type PreviewResponse = {
  fileName: string | null;
  fileSizeBytes: number;
  rowsTotal: number;
  rowsService: number;
  rowsNonService: number;
  rowsImported: number;
  rowsIgnored: number;
  rowsErrored: number;
  unknownMatricules: string[];
  unknownMatriculesCount: number;
  errors: { rowIndex: number; reason: string }[];
  errorsCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  rawUchSummary: {
    byAppartenance: Record<string, number>;
    byAffectation: Record<string, number>;
  };
};

type ImportResponse = {
  importId: string;
  rowsImported: number;
  rowsIgnored: number;
  rowsErrored: number;
  elapsedMs: number;
};

const PREVIEW_LIST_DISPLAY = 20;

export default function PlanningImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<ImportResponse | null>(
    null,
  );

  function reset() {
    setFile(null);
    setPreview(null);
    setConfirmed(false);
    setError(null);
    setSuccessResult(null);
  }

  async function submitPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setSuccessResult(null);
    setPreview(null);
    setConfirmed(false);
    setPreviewBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/planning/preview", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setPreview(data as PreviewResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function submitImport() {
    if (!file || !preview || !confirmed) return;
    setError(null);
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/planning/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSuccessResult(data as ImportResponse);
      setPreview(null);
      setFile(null);
      setConfirmed(false);
      // Recharger le RSC pour rafraîchir la carte "Import actuel".
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  }

  // ─── Rendu : succès ─────────────────────────────────────────────────────
  if (successResult) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
          <Icon.Check className="w-5 h-5" /> Import effectué
          <span className="text-xs font-mono text-emerald-700 ml-1">
            ({(successResult.elapsedMs / 1000).toFixed(1)} s)
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <Stat label="Shifts importés" value={successResult.rowsImported} tone="ok" />
          <Stat label="Ignorés (matricule inconnu)" value={successResult.rowsIgnored} tone="warn" />
          <Stat label="Erreurs de parsing" value={successResult.rowsErrored} tone="warn" />
        </div>
        <button onClick={reset} className="btn btn-secondary mt-4">
          Importer un autre fichier
        </button>
      </div>
    );
  }

  // ─── Rendu : choix fichier + bouton "Analyser" ──────────────────────────
  return (
    <div className="space-y-4">
      <form onSubmit={submitPreview} className="card p-5">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Fichier planning (.ods, .xlsx, .txt, .tsv)
        </label>
        <label
          htmlFor="planning-file"
          className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl p-6 cursor-pointer transition-colors text-slate-600"
        >
          <Icon.Upload className="w-5 h-5" />
          <span className="text-sm">
            {file ? (
              <>
                <b className="text-slate-900">{file.name}</b>{" "}
                <span className="text-slate-500">
                  ({(file.size / 1024 / 1024).toFixed(2)} Mo)
                </span>
              </>
            ) : (
              "Cliquez pour sélectionner ou déposez le fichier"
            )}
          </span>
          <input
            id="planning-file"
            type="file"
            accept=".ods,.xlsx,.xls,.txt,.tsv,text/tab-separated-values,text/plain"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setConfirmed(false);
              setError(null);
            }}
          />
        </label>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="submit"
            disabled={!file || previewBusy}
            className="btn btn-primary"
          >
            {previewBusy ? "Analyse en cours…" : "Analyser le fichier"}
          </button>
          {(file || preview) && (
            <button type="button" onClick={reset} className="btn btn-secondary">
              Annuler
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="card p-5 space-y-4">
          <h3 className="text-base font-bold">Aperçu de l&apos;import</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Stat label="Lignes totales" value={preview.rowsTotal} />
            <Stat label="Lignes SERVICE" value={preview.rowsService} tone="info" />
            <Stat label="Lignes NPO (ignorées)" value={preview.rowsNonService} />
            <Stat
              label="Agents importables"
              value={preview.rowsImported}
              tone="ok"
            />
            <Stat
              label="Inconnus (ignorés)"
              value={preview.rowsIgnored}
              tone="warn"
            />
            <Stat
              label="Erreurs de parsing"
              value={preview.rowsErrored}
              tone={preview.rowsErrored > 0 ? "warn" : undefined}
            />
          </div>

          <div className="text-xs text-slate-500">
            Période couverte :{" "}
            <b className="font-mono">
              {preview.periodStart
                ? new Date(preview.periodStart).toLocaleDateString("fr-FR")
                : "—"}
            </b>{" "}
            →{" "}
            <b className="font-mono">
              {preview.periodEnd
                ? new Date(preview.periodEnd).toLocaleDateString("fr-FR")
                : "—"}
            </b>
          </div>

          {preview.unknownMatriculesCount > 0 && (
            <details className="border border-slate-200 rounded-lg p-3" open>
              <summary className="text-sm font-medium cursor-pointer">
                Matricules inconnus ({preview.unknownMatriculesCount})
              </summary>
              <div className="mt-2 text-xs font-mono text-slate-600 break-words">
                {preview.unknownMatricules
                  .slice(0, PREVIEW_LIST_DISPLAY)
                  .join(", ")}
                {preview.unknownMatriculesCount > PREVIEW_LIST_DISPLAY && (
                  <span className="text-slate-400">
                    {" "}… +
                    {preview.unknownMatriculesCount - PREVIEW_LIST_DISPLAY} autres
                  </span>
                )}
              </div>
            </details>
          )}

          {preview.errorsCount > 0 && (
            <details className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <summary className="text-sm font-medium cursor-pointer text-amber-800">
                Lignes en erreur ({preview.errorsCount})
              </summary>
              <ul className="mt-2 text-xs text-amber-800 space-y-0.5">
                {preview.errors.slice(0, PREVIEW_LIST_DISPLAY).map((e) => (
                  <li key={e.rowIndex}>
                    Ligne {e.rowIndex + 1} — {e.reason}
                  </li>
                ))}
                {preview.errorsCount > PREVIEW_LIST_DISPLAY && (
                  <li className="text-amber-700">
                    … et {preview.errorsCount - PREVIEW_LIST_DISPLAY} autres
                  </li>
                )}
              </ul>
            </details>
          )}

          <details className="border border-slate-200 rounded-lg p-3">
            <summary className="text-sm font-medium cursor-pointer">
              Diagnostic UCH (info brute — non utilisé pour le scope)
            </summary>
            <div className="mt-2 grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  UCH d&apos;appartenance
                </div>
                <ul className="space-y-0.5 font-mono">
                  {Object.entries(preview.rawUchSummary.byAppartenance)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([uch, n]) => (
                      <li key={uch}>
                        <span className="text-slate-500">{n}×</span> {uch}
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  UCH d&apos;affectation (UCH JS)
                </div>
                <ul className="space-y-0.5 font-mono">
                  {Object.entries(preview.rawUchSummary.byAffectation)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([uch, n]) => (
                      <li key={uch}>
                        <span className="text-slate-500">{n}×</span> {uch}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </details>

          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>
                Je confirme que cet import{" "}
                <b>écrase intégralement le planning précédent</b>. Tous les
                shifts existants seront supprimés et remplacés par ceux de ce
                fichier.
              </span>
            </label>
            <button
              type="button"
              onClick={submitImport}
              disabled={!confirmed || importBusy}
              className="btn btn-primary mt-3"
            >
              {importBusy ? "Import en cours…" : "Importer définitivement"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "info" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-white border-emerald-200"
      : tone === "info"
      ? "bg-white border-indigo-200"
      : tone === "warn"
      ? "bg-white border-amber-200"
      : "bg-white border-slate-200";
  return (
    <div className={`border rounded-lg p-2.5 ${cls}`}>
      <div className="text-lg font-mono font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
}
