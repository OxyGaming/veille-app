"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type Report = {
  totalLines: number;
  created: number;
  skipped: number;
  agentSightings: number;
  siteSightings: number;
  icareMarked: number;
  usersCreated: string[];
  agentMissing: string[];
  siteMissing: string[];
  errors: string[];
};

/**
 * Import CSV historique des pointages — un seul fichier CSV par opération,
 * idempotent côté serveur (externalRef = pointage-{ID}).
 */
export default function PointagesImport() {
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
      const csv = await file.text();
      const res = await fetch("/api/admin/imports/pointages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
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
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-sky-100 grid place-items-center shrink-0">
          <Icon.Upload className="w-5 h-5 text-sky-700" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold">Import historique pointages</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Fichier CSV (colonnes ID, Titre, Horodatage, Commentaire,
            Utilisateur, Saisie Icare…). La colonne « Veille » est ignorée.
            Idempotent — relancer l&apos;import n&apos;ajoute pas de doublons.
          </p>
        </div>
      </div>

      <label className="block border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/30 transition-colors">
        <Icon.Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
        <div className="text-sm font-semibold">
          {filename ?? "Cliquez pour sélectionner ou déposez le fichier"}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          .csv UTF-8 (BOM toléré)
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {busy && (
        <div className="mt-3 text-sm text-slate-500 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-500 animate-pulse" />
          Import en cours…
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="mt-3 space-y-2">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Lignes" value={report.totalLines} />
            <Stat
              label="Créées"
              value={report.created}
              color="text-emerald-700"
            />
            <Stat
              label="Déjà importées"
              value={report.skipped}
              color="text-slate-500"
            />
            <Stat
              label="Icare cochés"
              value={report.icareMarked}
              color="text-indigo-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Vu/Notes agent"
              value={report.agentSightings}
              color="text-violet-700"
            />
            <Stat
              label="Vu/Notes site"
              value={report.siteSightings}
              color="text-sky-700"
            />
          </div>

          {report.usersCreated.length > 0 && (
            <Block
              title={`Utilisateurs créés (${report.usersCreated.length})`}
              items={report.usersCreated}
              tone="info"
            />
          )}
          {report.agentMissing.length > 0 && (
            <Block
              title={`Agents non trouvés (${report.agentMissing.length})`}
              items={report.agentMissing}
              tone="warn"
            />
          )}
          {report.siteMissing.length > 0 && (
            <Block
              title={`Sites non trouvés (${report.siteMissing.length})`}
              items={report.siteMissing}
              tone="warn"
            />
          )}
          {report.errors.length > 0 && (
            <Block
              title={`Erreurs (${report.errors.length})`}
              items={report.errors.slice(0, 20)}
              tone="error"
            />
          )}
        </div>
      )}
    </div>
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

function Block({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "info" | "warn" | "error";
}) {
  const cls =
    tone === "error"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-indigo-50 border-indigo-200 text-indigo-800";
  return (
    <details className={`border rounded-lg px-3 py-2 ${cls}`}>
      <summary className="text-xs font-semibold cursor-pointer">
        {title}
      </summary>
      <ul className="text-[11px] mt-2 space-y-0.5 max-h-48 overflow-auto font-mono">
        {items.map((it, i) => (
          <li key={i} className="truncate">
            · {it}
          </li>
        ))}
      </ul>
    </details>
  );
}
