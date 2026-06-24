"use client";

/**
 * Modal de résolution d'une action liée à un équipement périssable (C12).
 *
 * Apparaît AVANT le POST validate quand l'action provient d'une visite
 * INVENTORY et que l'équipement à l'origine est `isPerishable=true`.
 * Demande la nouvelle date de péremption (obligatoire) et un commentaire
 * de validation (optionnel) en une seule étape — l'utilisateur n'a pas
 * à confirmer deux fois.
 *
 * Pas de réassort partiel (décision spec) : la quantité revient au défaut
 * du catalogue, aucune édition n'est exposée à l'utilisateur.
 */

import { useState } from "react";
import { Icon } from "@/components/icons";

const DISCREPANCY_LABEL: Record<string, string> = {
  EXPIRED: "remplacé l'élément périmé",
  MISSING: "reposé l'élément manquant",
  DAMAGED: "remplacé l'élément détérioré",
  QUANTITY_LOW: "complété la quantité",
};

export type ResolveEquipmentLink = {
  equipmentId: string;
  equipmentLabel: string;
  equipmentCategory: string;
  expectedQuantity: number | null;
  discrepancyType: string | null;
  siteName: string;
};

type Props = {
  link: ResolveEquipmentLink;
  /** Commentaire de validation déjà tapé (transmis depuis le caller). */
  initialComment?: string;
  busy?: boolean;
  onClose: () => void;
  /** Appelé avec la date au format "YYYY-MM-DD" + commentaire optionnel. */
  onConfirm: (input: { expirationDate: string; comment: string }) => void;
};

export default function ResolveEquipmentModal({
  link,
  initialComment = "",
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [expirationDate, setExpirationDate] = useState("");
  const [comment, setComment] = useState(initialComment);
  const verb =
    DISCREPANCY_LABEL[link.discrepancyType ?? ""] ?? "remplacé l'élément";

  function submit() {
    if (!expirationDate) return;
    onConfirm({ expirationDate, comment: comment.trim() });
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Icon.Wrench className="w-4 h-4 text-amber-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Remplacement effectué
            </div>
            <div className="text-sm font-semibold truncate">
              {link.equipmentCategory} — {link.equipmentLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600">
            Vous avez {verb} sur <strong>{link.siteName}</strong>.
            {link.expectedQuantity != null && (
              <>
                {" "}La quantité revient au défaut du catalogue
                ({link.expectedQuantity}).
              </>
            )}
          </p>
          <label className="block text-xs font-medium text-slate-700">
            Nouvelle date de péremption <span className="text-rose-600">*</span>
            <input
              autoFocus
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="mt-1 input"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Commentaire (optionnel)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Précision sur le remplacement, fournisseur, lot…"
              maxLength={300}
              className="mt-1 input min-h-[60px]"
            />
          </label>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={busy || !expirationDate}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <Icon.Check className="w-4 h-4" />
              {busy ? "Validation…" : "Valider le remplacement"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
