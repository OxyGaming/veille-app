"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";

type FormState = {
  date_rci: string;
  dossier_numero: string;
  pk: string;
  ligne_numero: string;
  longueur_train: string;
};

const DEFAULTS: FormState = {
  date_rci: "",
  dossier_numero: "",
  pk: "",
  ligne_numero: "",
  longueur_train: "",
};

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export default function RciPocClient() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [photo, setPhoto] = useState<{
    b64: string;
    name: string;
    previewUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto({
      b64: bufToB64(buffer),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    });
  }

  async function generate() {
    setBusy(true);
    try {
      const { unwrapCjsCtor } = await import("@/lib/rci/render");
      const [DocxtemplaterNs, PizZipNs, ImageModuleNs, fileSaverNs] =
        await Promise.all([
          import("docxtemplater"),
          import("pizzip"),
          import("docxtemplater-image-module-free"),
          import("file-saver"),
        ]);
      // Déballage robuste — même fix que renderRci (cf. lib/rci/render.ts).
      const Docxtemplater = unwrapCjsCtor<
        new (
          zip: unknown,
          opts: Record<string, unknown>,
        ) => {
          render: (data: unknown) => void;
          getZip: () => { generate: (o: unknown) => Blob };
        }
      >(DocxtemplaterNs);
      const PizZip = unwrapCjsCtor<new (data: ArrayBuffer) => unknown>(PizZipNs);
      const ImageModule = unwrapCjsCtor<new (opts: unknown) => unknown>(
        ImageModuleNs,
      );
      // file-saver expose `module.exports = saveAs` (la fonction = le module).
      const saveAs = unwrapCjsCtor<typeof import("file-saver").saveAs>(
        fileSaverNs,
      );

      const res = await fetch("/rci/template-poc.docx");
      if (!res.ok) throw new Error("Template introuvable");
      const zip = new PizZip(await res.arrayBuffer());

      const imageOpts = {
        centered: false,
        getImage: (tagValue: unknown) => b64ToBytes(String(tagValue)),
        getSize: () => [400, 300] as [number, number],
      };
      const imageModule = new ImageModule(imageOpts);

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({
        ...form,
        photo: photo?.b64 ?? "",
      });

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const stamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .slice(0, 16);
      saveAs(blob, `rci-poc-${stamp}.docx`);
      toast.success("RCI généré");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(`Génération échouée : ${msg}`);
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const canGenerate =
    !busy &&
    !!photo &&
    Object.values(form).every((v) => v.trim().length > 0);

  return (
    <div className="card p-5 lg:p-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date de l'événement" hint="ex. 08/01/2026">
          <input
            type="text"
            value={form.date_rci}
            onChange={(e) => setField("date_rci", e.target.value)}
            placeholder="08/01/2026"
            className="input"
          />
        </Field>
        <Field label="N° de dossier" hint="JJMMAAHHMM - lieu">
          <input
            type="text"
            value={form.dossier_numero}
            onChange={(e) => setField("dossier_numero", e.target.value)}
            placeholder="08012026 St Romain en Gier"
            className="input"
          />
        </Field>
        <Field label="Point Kilométrique">
          <input
            type="text"
            value={form.pk}
            onChange={(e) => setField("pk", e.target.value)}
            placeholder="435.700"
            className="input"
          />
        </Field>
        <Field label="N° de ligne">
          <input
            type="text"
            value={form.ligne_numero}
            onChange={(e) => setField("ligne_numero", e.target.value)}
            placeholder="750000"
            className="input"
          />
        </Field>
        <Field label="Longueur du train (m)">
          <input
            type="text"
            value={form.longueur_train}
            onChange={(e) => setField("longueur_train", e.target.value)}
            placeholder="109.98"
            className="input"
          />
        </Field>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Photo (jointe en bas du « Schéma succinct »){" "}
          <span className="text-rose-600">*</span>
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={onPhotoChange}
          className="block text-sm"
        />
        {photo && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt="Aperçu"
              className="w-24 h-24 object-cover rounded-md border border-slate-200"
            />
            <span className="text-xs text-slate-500">{photo.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className="btn btn-primary"
        >
          <Icon.Plus className="w-4 h-4" />
          {busy ? "Génération…" : "Générer le .docx"}
        </button>
        <span className="text-[11px] text-slate-500">
          5 champs sont remplacés dans le modèle officiel + 1 photo inline.
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      {hint && (
        <span className="ml-1 text-[10px] font-mono text-slate-400">
          ({hint})
        </span>
      )}
      <div className="mt-1">{children}</div>
    </label>
  );
}
