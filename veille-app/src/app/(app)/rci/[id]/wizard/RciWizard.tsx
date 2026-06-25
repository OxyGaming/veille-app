"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import {
  emptyPayload,
  type RciPayload,
  type RciPhotos,
} from "@/lib/rci/fields";
import Step1Quand from "./steps/Step1Quand";
import Step2Nature from "./steps/Step2Nature";
import Step3Ou from "./steps/Step3Ou";
import Step4Mobiles from "./steps/Step4Mobiles";
import Step5Acteurs from "./steps/Step5Acteurs";
import Step6Presents from "./steps/Step6Presents";
import Step6Recit from "./steps/Step6Recit";
import type { StepDef } from "./types";

const STEPS: StepDef[] = [
  { key: "quand", label: "Quand", short: "1. Quand", component: Step1Quand },
  { key: "nature", label: "Nature", short: "2. Nature", component: Step2Nature },
  { key: "ou", label: "Où", short: "3. Où", component: Step3Ou },
  {
    key: "mobiles",
    label: "Installations & Mobiles",
    short: "4. Mobiles",
    component: Step4Mobiles,
  },
  {
    key: "acteurs",
    label: "Acteurs & Mesures",
    short: "5. Acteurs",
    component: Step5Acteurs,
  },
  {
    key: "presents",
    label: "Présents sur place",
    short: "6. Présents",
    component: Step6Presents,
  },
  { key: "recit", label: "Récit + signatures", short: "7. Récit", component: Step6Recit },
];

function parsePayload(s: string): RciPayload {
  try {
    const v = JSON.parse(s) as Partial<RciPayload>;
    return { ...emptyPayload(), ...v };
  } catch {
    return emptyPayload();
  }
}

/** Date du jour au format Word `JJ/MM/AAAA`. */
function todayFr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Pré-remplit les champs « signatures » et « RCI établi par » à partir de
 * l'utilisateur courant — visible et modifiable dans le wizard. N'altère
 * que les champs vides : on n'écrase jamais une saisie existante.
 */
function applyDefaults(p: RciPayload, authorName: string): RciPayload {
  const out = { ...p };
  if (!out.rci_etabli_le) out.rci_etabli_le = todayFr();
  if (!out.rci_etabli_par) out.rci_etabli_par = authorName;
  if (!out.sig_eic_nom_fonction) out.sig_eic_nom_fonction = authorName;
  if (!out.sig_eic_etablissement) out.sig_eic_etablissement = "EIC RAL";
  return out;
}

export default function RciWizard({
  rciId,
  initialPayload,
  initialDossierNumber,
  initialEventAt,
  initialTitle,
  status,
  authorName,
}: {
  rciId: string;
  initialPayload: string;
  initialDossierNumber: string | null;
  initialEventAt: string | null;
  initialTitle: string | null;
  status: string;
  authorName: string;
}) {
  const router = useRouter();
  const readOnly = status === "FINAL";
  const [stepIdx, setStepIdx] = useState(0);
  const [payload, setPayload] = useState<RciPayload>(() => {
    const p = parsePayload(initialPayload);
    // Hydratation depuis colonnes scalaires si payload pas encore peuplé
    if (!p.dossier_numero && initialDossierNumber) {
      p.dossier_numero = initialDossierNumber;
    }
    if (!p.nature && initialTitle) p.nature = initialTitle;
    return applyDefaults(p, authorName);
  });
  // Photos : non persistées côté serveur dans la v1 (on les garde en mémoire
  // de la session wizard). À déplacer en BDD si besoin de partage offline.
  const [photos, setPhotos] = useState<RciPhotos>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>(initialPayload);

  function patch(updates: Partial<RciPayload>) {
    if (readOnly) return;
    setPayload((p) => ({ ...p, ...updates }));
  }
  function patchPhotos(updates: Partial<RciPhotos>) {
    if (readOnly) return;
    setPhotos((p) => ({ ...p, ...updates }));
  }

  // Autosave debounced — sauvegarde payload, eventAt et dossierNumber côté serveur.
  useEffect(() => {
    if (readOnly) return;
    const json = JSON.stringify(payload);
    if (json === lastSavedJson.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        // Calcule eventAt depuis date + heure si possible
        let eventAt: string | null = null;
        const dateMatch = payload.date_evenement.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const heureMatch = payload.heure_evenement.match(/^(\d{2})h(\d{2})$/);
        if (dateMatch && heureMatch) {
          const [, d, m, y] = dateMatch;
          const [, h, mi] = heureMatch;
          eventAt = new Date(
            Number(y),
            Number(m) - 1,
            Number(d),
            Number(h),
            Number(mi),
          ).toISOString();
        }
        const res = await fetch(`/api/rci/${rciId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: json,
            dossierNumber: payload.dossier_numero || null,
            title: payload.nature || null,
            eventAt,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(j.error || "Sauvegarde échouée");
          return;
        }
        lastSavedJson.current = json;
        setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, rciId, readOnly]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/rci/${rciId}/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, photos }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rci-${payload.dossier_numero || rciId.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document généré");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(`Génération échouée : ${msg}`);
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  const Current = STEPS[stepIdx].component;

  return (
    <div className="card p-5 lg:p-6 space-y-5">
      {/* Stepper */}
      <ol className="flex gap-1 flex-wrap text-[11px]">
        {STEPS.map((s, i) => {
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setStepIdx(i)}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : done
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {s.short}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Statut autosave */}
      <div className="text-[10px] text-slate-400 font-mono h-3">
        {saving
          ? "Sauvegarde…"
          : savedAt
            ? `Sauvegardé à ${savedAt.toLocaleTimeString("fr-FR")}`
            : "Modifications enregistrées automatiquement."}
      </div>

      {/* Étape courante */}
      <div className="min-h-[300px]">
        <Current
          payload={payload}
          patch={patch}
          photos={photos}
          patchPhotos={patchPhotos}
          readOnly={readOnly}
        />
      </div>

      {/* Navigation + génération */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 flex-wrap">
        <button
          type="button"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="text-xs text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-40"
        >
          <Icon.ChevronLeft className="w-4 h-4 inline -ml-1" /> Précédent
        </button>
        <div className="text-xs text-slate-500 font-medium">
          Étape {stepIdx + 1} / {STEPS.length} — {STEPS[stepIdx].label}
        </div>
        {stepIdx < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
            className="btn btn-primary"
          >
            Suivant <Icon.ChevronLeft className="w-4 h-4 rotate-180 -mr-1" />
          </button>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={generating || readOnly}
            className="btn btn-primary"
          >
            <Icon.Plus className="w-4 h-4" />
            {generating ? "Génération…" : "Générer le .docx"}
          </button>
        )}
      </div>
      {/* initialEventAt non utilisé mais accepté pour API future */}
      {void initialEventAt}
    </div>
  );
}
