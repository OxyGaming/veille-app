"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import SignaturePad from "@/app/(app)/rci/[id]/wizard/SignaturePad";
import TimeField from "./TimeField";
import { fmtDateTimeFr, localInputToIso, nowLocalInput } from "@/lib/cil/format";
import {
  DEPECHE_SUBTYPE_LABELS,
  type CilIncidentFull,
  type DepecheSubtype,
} from "@/lib/cil/types";

type Role = "COS" | "OPJ";

/**
 * Recueil des autorisations AVANT la dépêche de reprise / rétablissement.
 *
 * Chaque autorité présente est traitée indépendamment et enregistrée dès que
 * son accord est obtenu : le CIL peut prendre celui du COS, fermer l'écran, et
 * revenir plus tard pour l'OPJ. La dépêche ne devient accessible que lorsque
 * toutes les autorités présentes ont donné accord ET signature.
 */
export default function CilAutorisationsModal({
  incident,
  subtype,
  onClose,
  onReady,
  onDone,
}: {
  incident: CilIncidentFull;
  subtype: DepecheSubtype;
  onClose: () => void;
  /** Toutes les autorisations sont réunies → on passe à la dépêche. */
  onReady: () => void;
  /** Rafraîchit l'incident après enregistrement d'une autorisation. */
  onDone: () => void;
}) {
  const incidentId = incident.incident.id;
  const present = (role: Role) =>
    incident.intervenants.some(
      (i) => i.type === role && i.arrivedAt && !i.departedAt,
    );
  const roles: Role[] = (["COS", "OPJ"] as const).filter(present);
  const autorisationFor = (role: Role) =>
    incident.autorisations.find(
      (a) => a.subtype === subtype && a.role === role,
    );
  const complete = roles.every((r) => !!autorisationFor(r));

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Autorisations à recueillir"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <Icon.Shield className="w-4 h-4 text-rose-600" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Autorisations à recueillir</h3>
            <p className="text-[11px] text-slate-500 truncate">
              {DEPECHE_SUBTYPE_LABELS[subtype]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-3 overflow-auto">
          <p className="text-xs text-slate-600">
            Recueillez l&apos;accord de chaque autorité présente. Chaque
            autorisation est enregistrée séparément : vous pouvez fermer cet
            écran et revenir plus tard pour la suivante.
          </p>
          {roles.map((role) => (
            <AutorisationCard
              key={role}
              incidentId={incidentId}
              subtype={subtype}
              role={role}
              // Le nom a déjà été saisi à l'ajout de l'intervenant : on le
              // reprend au lieu de le redemander.
              nomAutorite={
                incident.intervenants.find(
                  (i) => i.type === role && i.arrivedAt && !i.departedAt,
                )?.nom ?? null
              }
              existing={autorisationFor(role)}
              onSaved={onDone}
            />
          ))}
        </div>

        <footer className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
          >
            Fermer
          </button>
          <button
            onClick={onReady}
            disabled={!complete}
            title={
              complete
                ? undefined
                : "Toutes les autorisations ne sont pas encore recueillies."
            }
            className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            Passer la dépêche
          </button>
        </footer>
      </div>
    </>
  );
}

function AutorisationCard({
  incidentId,
  subtype,
  role,
  nomAutorite,
  existing,
  onSaved,
}: {
  incidentId: string;
  subtype: DepecheSubtype;
  role: Role;
  nomAutorite: string | null;
  existing?: { grantedAt: string; signerName: string | null };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(!existing);
  const [at, setAt] = useState(nowLocalInput());
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const iso = localInputToIso(at);
    if (!iso || !signature) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cil/${incidentId}/autorisations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtype,
          role,
          grantedAt: iso,
          signerName: nomAutorite,
          imageB64: signature,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Enregistrement impossible");
        return;
      }
      toast.success(`Autorisation du ${role} enregistrée`);
      setOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const res = await fetch(
      `/api/cil/${incidentId}/autorisations?subtype=${subtype}&role=${role}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setSignature("");
      setOpen(true);
      onSaved();
    } else toast.error("Suppression impossible");
  }

  if (existing && !open) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
        <Icon.Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-900">
            Autorisation du {role} recueillie
          </p>
          <p className="text-[11px] text-emerald-800">
            {fmtDateTimeFr(existing.grantedAt)}
            {existing.signerName ? ` · ${existing.signerName}` : ""} · signée
          </p>
        </div>
        <button
          onClick={reset}
          className="text-[11px] text-slate-500 hover:text-rose-600 underline shrink-0"
        >
          Refaire
        </button>
      </div>
    );
  }

  const canSave = !!at && !!signature;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-900">
        Autorisation du {role}
        {nomAutorite ? ` — ${nomAutorite}` : ""} (présent sur site)
      </p>
      <TimeField label="Heure de l'autorisation" value={at} onChange={setAt} />
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Signature du {role} *
        </label>
        <SignaturePad value={signature} onChange={setSignature} />
      </div>
      {!canSave && (
        <p className="text-[11px] text-rose-700">
          Heure et signature sont requises.
        </p>
      )}
      <button
        onClick={save}
        disabled={busy || !canSave}
        className="w-full text-sm font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
      >
        {busy ? "…" : `Enregistrer l'autorisation du ${role}`}
      </button>
    </div>
  );
}
