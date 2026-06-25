"use client";

import { useState } from "react";
import { DateField, FieldSet, TernaryField, TextField } from "../fields-ui";
import type { StepProps } from "../types";

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default function Step6Recit({
  payload,
  patch,
  photos,
  patchPhotos,
  readOnly,
}: StepProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    patchPhotos({ schema_succinct: bufToB64(buffer) });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-4">
      <FieldSet
        title="Récit chronologique"
        hint="Déroulé heure par heure de l'événement (avant / pendant)"
      >
        <TextField
          label="Comment ?"
          value={payload.recit_chronologique}
          placeholder={
            "Heure  Action…\n07h09  Avis CRC\n07h30  Arrivée DPx\n…"
          }
          disabled={readOnly}
          multiline
          rows={10}
          onChange={(v) => patch({ recit_chronologique: v })}
        />
      </FieldSet>

      <FieldSet title="Conséquences visibles">
        <TextField
          label="Conséquences visibles"
          value={payload.consequences_visibles}
          disabled={readOnly}
          multiline
          rows={3}
          onChange={(v) => patch({ consequences_visibles: v })}
        />
      </FieldSet>

      <FieldSet
        title="Schéma succinct"
        hint="Photo ou croquis — joint après le libellé « Schéma succinct »"
      >
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={onPhoto}
          disabled={readOnly}
          className="block text-sm"
        />
        {previewUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Aperçu"
              className="max-w-xs rounded border border-slate-200"
            />
          </div>
        )}
        {photos.schema_succinct && !previewUrl && (
          <div className="text-xs text-emerald-700">
            Photo jointe ({Math.round(photos.schema_succinct.length / 1024)}{" "}
            Kio en base64)
          </div>
        )}
      </FieldSet>

      <FieldSet title="Cases bas de page">
        <TernaryField
          label="Franchissement intempestif de signal d'arrêt — point protégé engagé ?"
          value={payload.franchissement_point_protege_engage}
          onChange={(v) => patch({ franchissement_point_protege_engage: v })}
          disabled={readOnly}
        />
        <TernaryField
          label="Photos jointes au RCI ?"
          value={payload.photos_jointes}
          onChange={(v) => patch({ photos_jointes: v })}
          disabled={readOnly}
        />
        <TernaryField
          label="Photos des titres d'habilitation des opérateurs"
          value={payload.photos_titres_habilitation}
          onChange={(v) => patch({ photos_titres_habilitation: v })}
          disabled={readOnly}
        />
      </FieldSet>

      <FieldSet title="RCI établi par + signatures">
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label="RCI établi le"
            hint="(JJ/MM/AAAA — pré-rempli avec aujourd'hui)"
            value={payload.rci_etabli_le}
            disabled={readOnly}
            onChange={(v) => patch({ rci_etabli_le: v })}
          />
          <TextField
            label="Par M / Mme"
            hint="(pré-rempli — modifiable)"
            value={payload.rci_etabli_par}
            disabled={readOnly}
            onChange={(v) => patch({ rci_etabli_par: v })}
          />
        </div>
        {[
          ["EIC", "sig_eic_nom_fonction", "sig_eic_tel"],
          ["Autres GI", "sig_autres_gi_nom_fonction", "sig_autres_gi_tel"],
          ["EF n°1", "sig_ef1_nom_fonction", "sig_ef1_tel"],
          ["EF n°2", "sig_ef2_nom_fonction", "sig_ef2_tel"],
        ].map(([label, nfKey, telKey]) => (
          <div key={label} className="grid gap-2 sm:grid-cols-[100px_1fr_180px]">
            <span className="text-xs font-medium text-slate-600 self-end pb-2">
              {label}
            </span>
            <TextField
              label="Nom / Fonction"
              value={payload[nfKey as keyof typeof payload] as string}
              disabled={readOnly}
              onChange={(v) => patch({ [nfKey]: v })}
            />
            <TextField
              label="Téléphone"
              value={payload[telKey as keyof typeof payload] as string}
              disabled={readOnly}
              onChange={(v) => patch({ [telKey]: v })}
            />
          </div>
        ))}
      </FieldSet>
    </div>
  );
}
