"use client";

import {
  FieldSet,
  TernaryField,
  timeFrToIso,
  timeIsoToFr,
} from "../fields-ui";
import type { StepProps } from "../types";
import type { RciPayload, Ternary } from "@/lib/rci/fields";

type K = keyof RciPayload;

type RoleRow = {
  key: string;
  label: string;
  /** Si truthy, on rend un input libre à côté du label (cas « Autres »). */
  labelEditableKey?: K;
};

const SECTIONS: { title: string; rows: RoleRow[] }[] = [
  {
    title: "Représentants de SNCF Réseau",
    rows: [
      { key: "dpx", label: "Dirigeant de proximité ou astreinte Circulation" },
      { key: "utm", label: "Dirigeant d'UTM (ou son délégataire) ou astreinte" },
      { key: "reg", label: "Régulateur sous-station" },
    ],
  },
  {
    title: "Intervenants externes",
    rows: [
      { key: "police", label: "Police ou Gendarmerie" },
      { key: "pompiers", label: "Pompiers" },
      { key: "funebres", label: "Pompes funèbres" },
      {
        key: "autres",
        label: "Autres (à préciser)",
        labelEditableKey: "po_autres_label",
      },
    ],
  },
  {
    title: "Représentants des exploitants",
    rows: [
      { key: "ef1", label: "EF n°1" },
      { key: "ef2", label: "EF n°2" },
      { key: "convois", label: "Convois du GI" },
      { key: "suge", label: "Représentant SUGE" },
    ],
  },
  {
    title: "Représentants des autres GI",
    rows: [
      { key: "titulaire", label: "Titulaire du contrat" },
      { key: "delegataire", label: "Délégataire pour SNCF Réseau" },
    ],
  },
];

export default function Step6Presents({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => (
        <FieldSet key={s.title} title={s.title}>
          <div className="grid gap-2 sm:grid-cols-[1fr_110px_180px_110px] text-[10px] text-slate-400 font-mono uppercase mb-1">
            <span>Rôle</span>
            <span>Heure d&apos;avis</span>
            <span>Présent ?</span>
            <span>Heure d&apos;arrivée</span>
          </div>
          <div className="grid gap-1">
            {s.rows.map((r) => {
              const heureAvisKey = `po_${r.key}_heure_avis` as K;
              const presentKey = `po_${r.key}_present` as K;
              const heureArriveeKey = `po_${r.key}_heure_arrivee` as K;
              return (
                <div
                  key={r.key}
                  className="grid gap-2 items-center sm:grid-cols-[1fr_110px_180px_110px] py-1 border-b border-slate-100 last:border-b-0"
                >
                  <div className="text-xs text-slate-700">
                    {r.label}
                    {r.labelEditableKey && (
                      <input
                        type="text"
                        value={payload[r.labelEditableKey] as string}
                        onChange={(e) =>
                          patch({
                            [r.labelEditableKey!]: e.target.value,
                          } as Partial<RciPayload>)
                        }
                        disabled={readOnly}
                        placeholder="(préciser)"
                        className="ml-2 inline-block border border-slate-200 rounded px-1 py-0.5 text-xs w-32"
                      />
                    )}
                  </div>
                  <input
                    type="time"
                    value={timeFrToIso(payload[heureAvisKey] as string)}
                    onChange={(e) =>
                      patch({
                        [heureAvisKey]: timeIsoToFr(e.target.value),
                      } as Partial<RciPayload>)
                    }
                    disabled={readOnly}
                    aria-label={`${r.label} — heure d'avis`}
                    className="input text-xs"
                  />
                  <TernaryField
                    label=""
                    value={payload[presentKey] as Ternary}
                    onChange={(v) =>
                      patch({ [presentKey]: v } as Partial<RciPayload>)
                    }
                    disabled={readOnly}
                  />
                  <input
                    type="time"
                    value={timeFrToIso(payload[heureArriveeKey] as string)}
                    onChange={(e) =>
                      patch({
                        [heureArriveeKey]: timeIsoToFr(e.target.value),
                      } as Partial<RciPayload>)
                    }
                    disabled={readOnly}
                    aria-label={`${r.label} — heure d'arrivée`}
                    className="input text-xs"
                  />
                </div>
              );
            })}
          </div>
        </FieldSet>
      ))}
    </div>
  );
}
