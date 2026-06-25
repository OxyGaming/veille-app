"use client";

import { DateField, FieldSet, TextField, TimeField } from "../fields-ui";
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
  // L'heure peut être stockée "7h30" (nouveau format payload) ou "07h30"
  // (ancien) — on accepte 1 ou 2 chiffres puis on pad-start à 2 pour le
  // dossier number.
  const hmMatch = heure.match(/^(\d{1,2})h(\d{2})$/);
  const hh = (hmMatch?.[1] ?? "00").padStart(2, "0");
  const mm = hmMatch?.[2] ?? "00";
  const stamp = `${d}${m}${aa}${hh}${mm}`;
  const cleanLieu = (lieu || "").trim();
  return cleanLieu ? `${stamp}-${cleanLieu}` : stamp;
}

export default function Step1Quand({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet
        title="Quand ?"
        hint="Date et heure de l'événement (le jour est déterminé automatiquement)"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label="Date"
            hint="(JJ/MM/AAAA)"
            value={payload.date_evenement}
            disabled={readOnly}
            onChange={(v) => {
              const updates: Parameters<typeof patch>[0] = { date_evenement: v };
              const auto = frenchDayFromIso(v);
              if (auto) updates.jour_semaine = auto;
              // Régénérer dossier_numero si pas figé manuellement
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
          <TimeField
            label="Heure"
            hint="(7h30 → 7h30 sur le Word)"
            value={payload.heure_evenement}
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
