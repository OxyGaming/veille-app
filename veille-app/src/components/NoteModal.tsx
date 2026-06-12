"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type Target = "agent" | "site";

/**
 * Modal de saisie d'un « Commentaire personnalisé » sur un agent ou un site.
 * Texte libre obligatoire + photos optionnelles (compression côté client).
 *
 * Workflow :
 *  1. POST /api/{agents|sites}/[id]/sight avec kind=NOTE → récupère sighting.id
 *  2. Pour chaque photo : POST /api/photos avec {agent|site}SightingId
 *  3. onCreated() pour rafraîchir la vue parente
 */
export default function NoteModal({
  target,
  targetId,
  targetName,
  onClose,
  onCreated,
}: {
  target: Target;
  targetId: string;
  targetName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function addFiles(picked: FileList | null) {
    if (!picked) return;
    const arr = Array.from(picked);
    const newPreviews = arr.map((f) => URL.createObjectURL(f));
    setFiles((p) => [...p, ...arr]);
    setPreviews((p) => [...p, ...newPreviews]);
  }
  function removeAt(i: number) {
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  }

  async function submit() {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      // 1. Crée le sighting (kind=NOTE).
      const url =
        target === "agent"
          ? `/api/agents/${targetId}/sight`
          : `/api/sites/${targetId}/sight`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "NOTE", comment: content.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Erreur lors de la création");
        return;
      }
      const sighting: { id: string } = await res.json();

      // 2. Upload des photos en série (préserve l'ordre).
      if (files.length) {
        const { default: imageCompression } = await import(
          "browser-image-compression"
        );
        for (let i = 0; i < files.length; i++) {
          setProgress(`Photo ${i + 1}/${files.length}…`);
          const compressed = await imageCompression(files[i], {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          });
          const fd = new FormData();
          fd.append("file", compressed, files[i].name);
          fd.append(
            target === "agent" ? "agentSightingId" : "siteSightingId",
            sighting.id
          );
          const ures = await fetch("/api/photos", {
            method: "POST",
            body: fd,
          });
          if (!ures.ok) {
            setError(`Échec à la photo ${i + 1}`);
            return;
          }
        }
      }
      onCreated();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Icon.MessageSquare className="w-4 h-4 text-indigo-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Commentaire personnalisé
            </div>
            <div className="text-sm font-semibold truncate">{targetName}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>
        <div className="p-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Commentaire <span className="text-rose-600">*</span>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Note libre — contexte, observations, point de vigilance…"
              maxLength={2000}
              className="mt-1 input min-h-[120px]"
            />
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Photos (optionnelles)
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {previews.map((src, i) => (
                <div
                  key={src}
                  className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`photo-${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute top-0.5 right-0.5 bg-slate-900/70 text-white rounded-full w-5 h-5 grid place-items-center text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 flex flex-col items-center justify-center text-slate-500 text-[10px] cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Icon.Camera className="w-5 h-5 mb-1" />
                Caméra
              </label>
              <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 flex flex-col items-center justify-center text-slate-500 text-[10px] cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Icon.ImagePlus className="w-5 h-5 mb-1" />
                Galerie
              </label>
            </div>
            {progress && (
              <div className="text-[11px] text-slate-500 mt-1.5">{progress}</div>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={!content.trim() || busy}
              className="btn btn-primary"
            >
              <Icon.MessageSquare className="w-4 h-4" />
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
