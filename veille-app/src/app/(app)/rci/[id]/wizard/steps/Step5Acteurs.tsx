"use client";

import { FieldSet, TernaryField, TextField, TimeField } from "../fields-ui";
import type { StepProps } from "../types";
import type { RciPayload } from "@/lib/rci/fields";

type K = keyof RciPayload;

export default function Step5Acteurs({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet title="Alcoolémie">
        <TextField
          label="Personne concernée"
          value={payload.alcool_personne}
          disabled={readOnly}
          onChange={(v) => patch({ alcool_personne: v })}
        />
        <div className="flex gap-6 flex-wrap">
          <TernaryField
            label="Pratiqué"
            value={payload.alcool_pratique}
            onChange={(v) => patch({ alcool_pratique: v })}
            disabled={readOnly}
          />
          <TernaryField
            label="Positif"
            value={payload.alcool_positif}
            onChange={(v) => patch({ alcool_positif: v })}
            disabled={readOnly}
          />
        </div>
      </FieldSet>

      <FieldSet title="Accident de personne" hint="(si applicable)">
        <div className="grid gap-3 sm:grid-cols-3">
          <TernaryField
            label="Blessé"
            value={payload.ap_blesse}
            onChange={(v) => patch({ ap_blesse: v })}
            disabled={readOnly}
          />
          <TernaryField
            label="Décès"
            value={payload.ap_deces}
            onChange={(v) => patch({ ap_deces: v })}
            disabled={readOnly}
          />
          <TernaryField
            label="Suicide présumé"
            value={payload.ap_suicide_presume}
            onChange={(v) => patch({ ap_suicide_presume: v })}
            disabled={readOnly}
          />
        </div>
        <TextField
          label="Source"
          value={payload.ap_source}
          placeholder="Pompiers, OPJ, témoin…"
          disabled={readOnly}
          onChange={(v) => patch({ ap_source: v })}
        />
      </FieldSet>

      <FieldSet
        title="Mesures conservatoires"
        hint="3 lignes max (heure / par qui / mesure)"
      >
        {[1, 2, 3].map((i) => {
          const heureKey = `mc_l${i}_heure` as K;
          const parKey = `mc_l${i}_par_qui` as K;
          const mesKey = `mc_l${i}_mesures` as K;
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-[100px_180px_1fr]">
              <TimeField
                label={`Heure ${i}`}
                value={payload[heureKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [heureKey]: v } as Partial<RciPayload>)}
              />
              <TextField
                label="Par qui ?"
                value={payload[parKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [parKey]: v } as Partial<RciPayload>)}
              />
              <TextField
                label="Mesures"
                value={payload[mesKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [mesKey]: v } as Partial<RciPayload>)}
              />
            </div>
          );
        })}
        <div className="grid gap-3 sm:grid-cols-3">
          <TimeField
            label="Notification heure"
            value={payload.mc_notification_heure}
            disabled={readOnly}
            onChange={(v) => patch({ mc_notification_heure: v })}
          />
          <div className="text-xs">
            <span className="font-medium text-slate-600">Réalisé par</span>
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  patch({
                    mc_notification_dpx: !payload.mc_notification_dpx,
                    mc_notification_cogc: false,
                  })
                }
                className={`text-xs px-2 py-1 rounded border ${
                  payload.mc_notification_dpx
                    ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                DPx
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  patch({
                    mc_notification_cogc: !payload.mc_notification_cogc,
                    mc_notification_dpx: false,
                  })
                }
                className={`text-xs px-2 py-1 rounded border ${
                  payload.mc_notification_cogc
                    ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                COGC (DRC)
              </button>
            </div>
          </div>
        </div>
      </FieldSet>

      <FieldSet title="Acteurs principaux" hint="3 lignes max">
        {[1, 2, 3].map((i) => {
          const eKey = `acteur_l${i}_entreprise` as K;
          const nKey = `acteur_l${i}_nom` as K;
          const fKey = `acteur_l${i}_fonction` as K;
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <TextField
                label={`Entreprise ${i}`}
                value={payload[eKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [eKey]: v } as Partial<RciPayload>)}
              />
              <TextField
                label="Nom (facultatif)"
                value={payload[nKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [nKey]: v } as Partial<RciPayload>)}
              />
              <TextField
                label="Fonction"
                value={payload[fKey] as string}
                disabled={readOnly}
                onChange={(v) => patch({ [fKey]: v } as Partial<RciPayload>)}
              />
            </div>
          );
        })}
      </FieldSet>
    </div>
  );
}
