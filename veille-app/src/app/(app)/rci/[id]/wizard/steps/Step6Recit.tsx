"use client";

import { useState } from "react";
import { DateField, FieldSet, TernaryField, TextField } from "../fields-ui";
import SignaturePad from "../SignaturePad";
import type { StepProps } from "../types";
import type { RciPayload } from "@/lib/rci/fields";

/** Config d'un intervenant signataire. `key` → clés payload `sig_<key>_*`. */
type SigConfig = {
  key: string;
  label: string;
  /** SNCF Réseau supplémentaires : sous-rôle libre (ex. « Maintenance & Travaux »). */
  editableRole?: boolean;
};

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
  const [openSig, setOpenSig] = useState<string | null>(null);

  // Accès dynamiques typés aux champs sig_<key>_*
  const getStr = (k: string) => (payload[k as keyof RciPayload] as string) ?? "";
  const getBool = (k: string) => !!payload[k as keyof RciPayload];
  const setField = (k: string, v: string | boolean) =>
    patch({ [k]: v } as Partial<RciPayload>);

  // Représentants SNCF Réseau visibles (EIC + jusqu'à 2 supplémentaires).
  // Nombre initial déduit des données déjà saisies.
  const slotHasData = (key: string) =>
    !!(
      getStr(`sig_${key}_sous_role`) ||
      getStr(`sig_${key}_etablissement`) ||
      getStr(`sig_${key}_nom_fonction`) ||
      getStr(`sig_${key}_tel`) ||
      getStr(`sig_${key}_data`) ||
      getBool(`sig_${key}_absent`)
    );
  const [sncfCount, setSncfCount] = useState<number>(
    slotHasData("sncf3") ? 3 : slotHasData("sncf2") ? 2 : 1,
  );

  function clearSlot(key: string) {
    patch({
      [`sig_${key}_sous_role`]: "",
      [`sig_${key}_etablissement`]: "",
      [`sig_${key}_nom_fonction`]: "",
      [`sig_${key}_tel`]: "",
      [`sig_${key}_data`]: "",
      [`sig_${key}_absent`]: false,
    } as Partial<RciPayload>);
  }

  function renderSignatory(cfg: SigConfig, onRemove?: () => void) {
    const isAbsent = getBool(`sig_${cfg.key}_absent`);
    const isSigned = !!getStr(`sig_${cfg.key}_data`);
    const isOpen = openSig === cfg.key;
    return (
      <div
        key={cfg.key}
        className="rounded-lg border border-slate-100 p-3 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          {cfg.editableRole ? (
            <input
              type="text"
              value={getStr(`sig_${cfg.key}_sous_role`)}
              onChange={(e) => setField(`sig_${cfg.key}_sous_role`, e.target.value)}
              placeholder="Rôle (ex. Maintenance & Travaux)"
              disabled={readOnly}
              className="flex-1 min-w-0 text-xs font-semibold text-slate-700 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-400 disabled:border-transparent"
            />
          ) : (
            <span className="text-xs font-semibold text-slate-700">
              {cfg.label}
            </span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !isAbsent;
                setField(`sig_${cfg.key}_absent`, next);
                if (next) {
                  setField(`sig_${cfg.key}_data`, "");
                  if (isOpen) setOpenSig(null);
                }
              }}
              disabled={readOnly}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                isAbsent
                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {isAbsent ? "✓ Non présent" : "Non présent"}
            </button>
            {!isAbsent && (
              <button
                type="button"
                onClick={() => setOpenSig(isOpen ? null : cfg.key)}
                disabled={readOnly}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  isSigned
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                }`}
              >
                {isSigned ? (isOpen ? "Fermer" : "✓ Signé · Modifier") : "Signer"}
              </button>
            )}
            {onRemove && !readOnly && (
              <button
                type="button"
                onClick={onRemove}
                title="Retirer ce représentant"
                className="text-[11px] px-1.5 py-1 rounded-md border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <TextField
            label="Établissement"
            value={getStr(`sig_${cfg.key}_etablissement`)}
            disabled={readOnly}
            onChange={(v) => setField(`sig_${cfg.key}_etablissement`, v)}
          />
          <TextField
            label="Nom / Fonction"
            value={getStr(`sig_${cfg.key}_nom_fonction`)}
            disabled={readOnly}
            onChange={(v) => setField(`sig_${cfg.key}_nom_fonction`, v)}
          />
          <TextField
            label="Téléphone"
            value={getStr(`sig_${cfg.key}_tel`)}
            disabled={readOnly}
            onChange={(v) => setField(`sig_${cfg.key}_tel`, v)}
          />
        </div>
        {isAbsent ? (
          <p className="text-[11px] text-amber-600 italic">
            Marqué « Non présent sur place » — pas de signature.
          </p>
        ) : (
          isOpen && (
            <div>
              <p className="text-[10px] font-mono text-slate-400 uppercase mb-1">
                Signature
              </p>
              <SignaturePad
                value={getStr(`sig_${cfg.key}_data`)}
                onChange={(b64) => setField(`sig_${cfg.key}_data`, b64)}
                disabled={readOnly}
              />
            </div>
          )
        )}
      </div>
    );
  }

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
        {/* SNCF Réseau : EIC + jusqu'à 2 représentants supplémentaires */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            SNCF Réseau
          </p>
          <div className="space-y-3">
            {renderSignatory({ key: "eic", label: "EIC" })}
            {sncfCount >= 2 &&
              renderSignatory(
                { key: "sncf2", label: "Représentant SNCF Réseau", editableRole: true },
                sncfCount === 2
                  ? () => {
                      clearSlot("sncf2");
                      setSncfCount(1);
                      if (openSig === "sncf2") setOpenSig(null);
                    }
                  : undefined,
              )}
            {sncfCount >= 3 &&
              renderSignatory(
                { key: "sncf3", label: "Représentant SNCF Réseau", editableRole: true },
                () => {
                  clearSlot("sncf3");
                  setSncfCount(2);
                  if (openSig === "sncf3") setOpenSig(null);
                },
              )}
          </div>
          {sncfCount < 3 && !readOnly && (
            <button
              type="button"
              onClick={() => setSncfCount((c) => c + 1)}
              className="mt-2 text-[11px] px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              + Ajouter un représentant SNCF Réseau
            </button>
          )}
        </div>

        {/* Autres GI / Entreprises ferroviaires */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Autres GI / Entreprises ferroviaires
          </p>
          <div className="space-y-3">
            {renderSignatory({ key: "autres_gi", label: "Autres GI" })}
            {renderSignatory({ key: "ef1", label: "EF n°1" })}
            {renderSignatory({ key: "ef2", label: "EF n°2" })}
          </div>
        </div>
      </FieldSet>
    </div>
  );
}
