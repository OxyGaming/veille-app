"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type ImportResult = {
  importId: string;
  rowsTotal: number;
  uniqueRows?: number;
  created: number;
  updated: number;
  obsoleted: number;
  agentsCreated: number;
  unknownAgents: number;
  elapsedMs?: number;
  warnings?: string[];
};

export default function ImportClient({
  teams = [],
  defaultTeamId = null,
}: {
  teams?: { id: string; name: string }[];
  defaultTeamId?: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // Équipe cible de l'import. Toutes les lignes du fichier seront rattachées à
  // CETTE équipe (cf. cloisonnement). Défaut = équipe principale si disponible.
  const [teamId, setTeamId] = useState<string>(
    defaultTeamId && teams.some((t) => t.id === defaultTeamId)
      ? defaultTeamId
      : teams[0]?.id ?? ""
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!teamId) {
      setError("Sélectionnez une équipe cible avant l'import.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("teamId", teamId);

      // Suivi de progression via XHR (fetch n'a pas d'upload progress).
      const data = await new Promise<ImportResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/actions/import");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(j);
            else reject(new Error(j.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error("Réponse invalide"));
          }
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(fd);
      });
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Équipe cible <span className="text-rose-600">*</span>
            <span className="ml-1 text-[10px] font-normal text-slate-400">
              (toutes les lignes du fichier seront rattachées à cette équipe)
            </span>
          </label>
          {teams.length === 0 ? (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Aucune équipe disponible — rattachez-vous à une équipe pour
              importer.
            </div>
          ) : (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="input"
              required
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Fichier Excel (.xlsx)
          </label>
          <div className="flex items-center gap-3">
            <label
              htmlFor="xlsx-file"
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-xl p-6 cursor-pointer transition-colors text-slate-600"
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
                id="xlsx-file"
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={!file || busy}
          className="btn btn-primary self-start"
        >
          {busy ? "Import en cours…" : "Importer"}
        </button>
      </form>

      {busy && (
        <div className="mt-4">
          <div className="text-xs text-slate-500 mb-1.5 flex items-center justify-between">
            <span>
              {progress < 100 ? "Téléversement…" : "Parsing & enregistrement…"}
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <Icon.Check className="w-5 h-5" /> Import terminé
            {result.elapsedMs != null && (
              <span className="text-xs font-mono text-emerald-700 ml-1">
                ({(result.elapsedMs / 1000).toFixed(1)} s)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
            <Stat label="Lignes lues" value={result.rowsTotal} />
            {result.uniqueRows != null && (
              <Stat label="Lignes uniques" value={result.uniqueRows} />
            )}
            <Stat label="Créées" value={result.created} tone="ok" />
            <Stat label="Mises à jour" value={result.updated} tone="info" />
            <Stat label="Obsolètes" value={result.obsoleted} tone="warn" />
            <Stat label="Agents créés" value={result.agentsCreated} tone="ok" />
          </div>
          {result.unknownAgents > 0 && (
            <div className="mt-3 text-xs text-amber-800">
              {result.unknownAgents} ligne(s) avec agent non identifié (libellé
              sans matricule).
            </div>
          )}
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
