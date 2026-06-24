"use client";

/**
 * Bouton réutilisable « Valider l'action » (C15).
 *
 * Encapsule TOUT le flow de validation d'une `ImportedAction` :
 *  1. Fetch `/api/actions/[id]/equipment-link` pour savoir si on doit
 *     ouvrir ResolveEquipmentModal (cas équipement périissable C12).
 *  2. Sinon, modal légère de confirmation avec commentaire optionnel.
 *  3. POST `/api/actions/[id]/validate` (avec `equipmentUpdate` si modal
 *     C12 utilisée).
 *  4. Toast de succès + `router.refresh()` + `window.location.reload()`
 *     pour rafraîchir tous les compteurs du dashboard.
 *
 * Pensé pour s'intégrer dans la liste NC du dashboard. La logique est
 * identique à `AgentActionsClient.runValidationCascade` mais sans la
 * cascade des doublons (1 action = 1 NC ici).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import ResolveEquipmentModal, {
  type ResolveEquipmentLink,
} from "@/components/ResolveEquipmentModal";

type Props = {
  actionId: string;
  /** Description courte pour le titre de la modal de confirmation. */
  contextLabel: string;
  /** Optionnel — appelé après succès, sinon reload page. */
  onSuccess?: () => void;
};

export function ActionValidateButton({
  actionId,
  contextLabel,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState("");
  const [equipmentLink, setEquipmentLink] =
    useState<ResolveEquipmentLink | null>(null);
  const [resolvingEquipment, setResolvingEquipment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function openConfirm() {
    setBusy(true);
    try {
      // Probe d'abord le lien équipement pour décider de la modal.
      const r = await fetch(`/api/actions/${actionId}/equipment-link`, {
        credentials: "include",
        cache: "no-store",
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.linked && data?.isPerishable) {
          setEquipmentLink({
            equipmentId: data.equipmentId,
            equipmentLabel: data.equipmentLabel,
            equipmentCategory: data.equipmentCategory,
            expectedQuantity: data.expectedQuantity ?? null,
            discrepancyType: data.discrepancyType ?? null,
            siteName: data.siteName,
          });
          setResolvingEquipment(true);
          return;
        }
      }
      // Pas d'équipement périissable → modal légère.
      setConfirming(true);
      setComment("");
    } catch {
      // Erreur réseau — fallback sur la modal légère.
      setConfirming(true);
    } finally {
      setBusy(false);
    }
  }

  async function postValidate(
    equipmentUpdate: { expirationDate: string } | null,
    commentValue: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/actions/${actionId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          comment: commentValue.trim() || null,
          ...(equipmentUpdate ? { equipmentUpdate } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(j.error || "Erreur de validation");
        return;
      }
      toast.success(
        equipmentUpdate ? "Remplacement enregistré" : "Action validée",
      );
      setConfirming(false);
      setResolvingEquipment(false);
      setEquipmentLink(null);
      if (onSuccess) {
        onSuccess();
      } else {
        startTransition(() => router.refresh());
        if (typeof window !== "undefined") {
          window.setTimeout(() => window.location.reload(), 500);
        }
      }
    } catch {
      toast.error("Erreur de validation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 w-9 h-9 disabled:opacity-50"
        title={`Valider : ${contextLabel}`}
        aria-label={`Valider l'action « ${contextLabel} »`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Icon.Check className="w-4 h-4" aria-hidden />
      </button>

      {resolvingEquipment && equipmentLink && (
        <ResolveEquipmentModal
          link={equipmentLink}
          initialComment={comment}
          busy={busy}
          onClose={() => {
            setResolvingEquipment(false);
            setEquipmentLink(null);
          }}
          onConfirm={({ expirationDate, comment: c }) =>
            postValidate({ expirationDate }, c)
          }
        />
      )}

      {confirming && !resolvingEquipment && (
        <ConfirmModal
          contextLabel={contextLabel}
          comment={comment}
          setComment={setComment}
          busy={busy}
          onClose={() => setConfirming(false)}
          onConfirm={() => postValidate(null, comment)}
        />
      )}
    </>
  );
}

function ConfirmModal({
  contextLabel,
  comment,
  setComment,
  busy,
  onClose,
  onConfirm,
}: {
  contextLabel: string;
  comment: string;
  setComment: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
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
          <Icon.Check className="w-4 h-4 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Valider l&apos;action
            </div>
            <div className="text-sm font-semibold truncate">{contextLabel}</div>
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
          <label className="block text-xs font-medium text-slate-600">
            Commentaire (optionnel)
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Précision sur la réalisation…"
              maxLength={500}
              className="mt-1 input min-h-[80px]"
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
              onClick={onConfirm}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <Icon.Check className="w-4 h-4" />
              {busy ? "Validation…" : "Valider"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
