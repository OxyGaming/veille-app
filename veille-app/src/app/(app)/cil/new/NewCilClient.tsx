"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import {
  ETABLISSEMENTS,
  ETABLISSEMENT_LABELS,
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  type Etablissement,
  type IncidentType,
} from "@/lib/cil/types";
import { localInputToIso, nowLocalInput } from "@/lib/cil/format";

/** Découpe "Prénom Nom" (best-effort) pour préremplir l'en-tête CIL. */
function splitName(full: string): { prenom: string; nom: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: "", nom: full.trim() };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

export default function NewCilClient({ defaultCilName }: { defaultCilName: string }) {
  const router = useRouter();
  const initName = splitName(defaultCilName);
  const [type, setType] = useState<IncidentType>("INCENDIE");
  const [typeLibre, setTypeLibre] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [lieu, setLieu] = useState("");
  const [poste, setPoste] = useState("");
  const [voie, setVoie] = useState("");
  const [observations, setObservations] = useState("");
  // Localisation officielle : « en gare de » OU « entre les gares de … et de … ».
  // Choisie ICI une fois pour tout le livret, jamais redemandée ensuite.
  const [gareMode, setGareMode] = useState<"UNIQUE" | "BETWEEN">("UNIQUE");
  const [gareUnique, setGareUnique] = useState("");
  const [gareA, setGareA] = useState("");
  const [gareB, setGareB] = useState("");
  const [km, setKm] = useState("");
  const [cilNom, setCilNom] = useState(initName.nom);
  const [cilPrenom, setCilPrenom] = useState(initName.prenom);
  const [etab, setEtab] = useState<Etablissement>("EIC_RAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = lieu.trim().length > 0 && !!occurredAt;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          typeLibre: type === "AUTRE" ? typeLibre || null : null,
          occurredAt: localInputToIso(occurredAt),
          lieu,
          poste: poste || null,
          voie: voie || null,
          observations: observations || null,
          // Exclusivité : un seul mode de localisation est transmis.
          gareMode,
          gareUnique: gareMode === "UNIQUE" ? gareUnique || null : null,
          gareA: gareMode === "BETWEEN" ? gareA || null : null,
          gareB: gareMode === "BETWEEN" ? gareB || null : null,
          km: km || null,
          cilNom: cilNom || null,
          cilPrenom: cilPrenom || null,
          cilEtablissement: etab,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Création impossible");
        return;
      }
      const inc = await res.json();
      toast.success("Incident créé");
      router.push(`/cil/${inc.id}`);
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  const field = "input w-full";
  const lbl = "block text-xs font-semibold text-slate-700 mb-1";

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/cil")}
        className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-3"
      >
        <Icon.ChevronLeft className="w-4 h-4" /> Livret CIL
      </button>
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
        <Icon.Shield className="w-5 h-5 text-rose-600" /> Nouvel incident
      </h1>
      <p className="text-sm text-slate-500 mb-4">
        Le CRC est initialement responsable des protections jusqu&apos;à votre
        arrivée sur site.
      </p>

      <div className="card p-4 space-y-4">
        <div>
          <label className={lbl}>Type d&apos;incident</label>
          <div className="flex flex-wrap gap-2">
            {INCIDENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  type === t
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"
                }`}
              >
                {INCIDENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {type === "AUTRE" && (
            <input
              value={typeLibre}
              onChange={(e) => setTypeLibre(e.target.value)}
              placeholder="Préciser la nature"
              className={`${field} mt-2`}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Date et heure de l&apos;incident *</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={lbl}>Poste concerné</label>
            <input value={poste} onChange={(e) => setPoste(e.target.value)} className={field} />
          </div>
          <div>
            <label className={lbl}>Localisation / Lieu *</label>
            <input
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Ex. Givors-Canal"
              className={field}
            />
          </div>
          <div>
            <label className={lbl}>Voie</label>
            <input value={voie} onChange={(e) => setVoie(e.target.value)} className={field} />
          </div>
          <div>
            {/* Repris tel quel dans chaque dépêche : saisi ici une fois pour
                toutes plutôt qu'à la première protection. */}
            <label className={lbl}>Kilomètre</label>
            <input
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="Ex. 12,400"
              className={field}
            />
          </div>
        </div>

        <fieldset className="border border-slate-200 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-600 px-1">
            Localisation officielle (imprimée dans tout le livret)
          </legend>
          <div className="flex gap-2 mb-2">
            {(["UNIQUE", "BETWEEN"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGareMode(m)}
                className={`text-xs px-2.5 py-1 rounded-lg border ${
                  gareMode === m
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {m === "UNIQUE" ? "En gare de" : "Entre les gares de … et de …"}
              </button>
            ))}
          </div>
          {gareMode === "UNIQUE" ? (
            <input
              value={gareUnique}
              onChange={(e) => setGareUnique(e.target.value)}
              placeholder="En gare de…"
              className={field}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <input value={gareA} onChange={(e) => setGareA(e.target.value)} placeholder="Gare A" className={field} />
              <input value={gareB} onChange={(e) => setGareB(e.target.value)} placeholder="Gare B" className={field} />
            </div>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            Ce choix coche la case correspondante du livret et ne sera plus redemandé.
          </p>
        </fieldset>

        <div>
          <label className={lbl}>Observations</label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={2}
            className="input w-full min-h-[60px]"
          />
        </div>

        <fieldset className="border border-slate-200 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-600 px-1">CIL</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Nom</label>
              <input value={cilNom} onChange={(e) => setCilNom(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lbl}>Prénom</label>
              <input value={cilPrenom} onChange={(e) => setCilPrenom(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lbl}>Établissement</label>
              <select value={etab} onChange={(e) => setEtab(e.target.value as Etablissement)} className={field}>
                {ETABLISSEMENTS.map((e) => (
                  <option key={e} value={e}>
                    {ETABLISSEMENT_LABELS[e]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => router.push("/cil")}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {busy ? "Création…" : "Créer l'incident"}
          </button>
        </div>
      </div>
    </div>
  );
}
