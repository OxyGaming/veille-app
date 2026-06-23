"use client";

import { TextField, FieldSet } from "../fields-ui";
import type { StepProps } from "../types";

const JOURS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

function frenchDayFromIso(iso: string): string {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return "";
  const [d, m, y] = iso.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  // JS: 0=Dimanche, 1=Lundi… on remappe sur notre table où 0=Lundi.
  const idx = (dt.getDay() + 6) % 7;
  return JOURS[idx];
}

function buildDossierNumber(dateFr: string, heure: string, lieu: string): string {
  // Format normé : JJMMAAHHMM-Lieu (ex. 0806230920-Portes)
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateFr)) return "";
  const [d, m, y] = dateFr.split("/");
  const aa = y.slice(2);
  const hh = (heure.match(/^(\d{2})/) ?? [, "00"])[1];
  const mm = (heure.match(/h(\d{2})/) ?? [, "00"])[1];
  const stamp = `${d}${m}${aa}${hh}${mm}`;
  const cleanLieu = (lieu || "").trim();
  return cleanLieu ? `${stamp}-${cleanLieu}` : stamp;
}

export default function Step1Quand({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet title="Quand ?" hint="Date, heure et jour de l'événement">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Date"
            hint="(JJ/MM/AAAA)"
            value={payload.date_evenement}
            placeholder="08/01/2026"
            disabled={readOnly}
            onChange={(v) => {
              const updates: Parameters<typeof patch>[0] = { date_evenement: v };
              const auto = frenchDayFromIso(v);
              if (auto && !payload.jour_semaine) updates.jour_semaine = auto;
              if (auto) updates.jour_semaine = auto;
              // Régénérer dossier_numero si pas figé
              const dossier = buildDossierNumber(v, payload.heure_evenement, "");
              if (!payload.dossier_numero || payload.dossier_numero.startsWith(dossier.split("-")[0].slice(0, 6))) {
                updates.dossier_numero = buildDossierNumber(
                  v,
                  payload.heure_evenement,
                  (payload.gare_section || "").split(" ")[0] || ""
                );
              }
              patch(updates);
            }}
          />
          <TextField
            label="Heure"
            hint="(HHhMM)"
            value={payload.heure_evenement}
            placeholder="07h09"
            disabled={readOnly}
            onChange={(v) => {
              const updates: Parameters<typeof patch>[0] = { heure_evenement: v };
              updates.dossier_numero = buildDossierNumber(
                payload.date_evenement,
                v,
                (payload.gare_section || "").split(" ")[0] || ""
              );
              patch(updates);
            }}
          />
          <TextField
            label="Jour"
            hint="(auto, modifiable)"
            value={payload.jour_semaine}
            placeholder="Jeudi"
            disabled={readOnly}
            onChange={(v) => patch({ jour_semaine: v })}
          />
        </div>
      </FieldSet>

      <FieldSet
        title="Numéro de dossier"
        hint="Format normé JJMMAAHHMM-Lieu — généré automatiquement"
      >
        <TextField
          label="N° de dossier"
          hint="(modifiable si besoin)"
          value={payload.dossier_numero}
          placeholder="08012026-StRomain"
          disabled={readOnly}
          onChange={(v) => patch({ dossier_numero: v })}
        />
      </FieldSet>
    </div>
  );
}
