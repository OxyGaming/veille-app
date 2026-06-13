"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Historique des validations d'actions d'un agent — avec annulation possible
 * pendant 5 minutes (US-1.12 / cf. AUDIT.md §m30).
 *
 * Règles d'affichage de l'icône poubelle :
 *  - USER             : visible uniquement sur SES validations, et < 5 min.
 *  - EDITOR           : visible sur toutes les validations de son périmètre, < 5 min.
 *  - ADMIN            : visible à tout moment (filet de sécurité opérationnel).
 *
 * Le serveur applique la même règle (cf. DELETE /api/actions/validations/[id]),
 * donc une éventuelle désynchronisation horloge client/serveur retombe en 410.
 */

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

export type ValidationEntry = {
  id: string;
  /** ISO string (sérialisé depuis Date côté server). */
  realizedAt: string;
  /** ISO string — sert au calcul de la fenêtre 5 min. */
  createdAt: string;
  validatedById: string;
  validatedByName: string;
  comment: string | null;
  actionLabel: string;
};

type Props = {
  initial: ValidationEntry[];
  currentUserId: string;
  currentUserRole: "USER" | "EDITOR" | "ADMIN";
};

export default function RecentValidations({
  initial,
  currentUserId,
  currentUserRole,
}: Props) {
  const { dialog, ask } = useConfirmDialog();
  const [list, setList] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  // Re-render toutes les 30 s pour que les icônes poubelle disparaissent
  // sans nécessiter de refresh manuel quand la fenêtre 5 min s'épuise.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function canCancel(v: ValidationEntry): boolean {
    if (currentUserRole === "ADMIN") return true;
    const ageMs = now - new Date(v.createdAt).getTime();
    if (ageMs > CANCEL_WINDOW_MS) return false;
    if (currentUserRole === "EDITOR") return true;
    // USER : seulement sa propre validation.
    return v.validatedById === currentUserId;
  }

  async function cancel(v: ValidationEntry) {
    const ok = await ask({
      title: "Annuler cette validation ?",
      description:
        `L'action « ${v.actionLabel} » sera remise dans la liste à traiter.\n` +
        "Cette opération est tracée dans le journal d'audit.",
      confirmLabel: "Annuler la validation",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/actions/validations/${v.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setList((arr) => arr.filter((x) => x.id !== v.id));
      toast.success("Validation annulée");
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Annulation refusée");
    }
  }

  if (!list.length) {
    return (
      <ul className="grid gap-2">
        <li className="text-xs text-slate-500">Aucune validation pour le moment.</li>
      </ul>
    );
  }

  return (
    <>
      {dialog}
      <ul className="grid gap-2">
        {list.map((v) => {
          const cancellable = canCancel(v);
          return (
            <li
              key={v.id}
              className="card px-3.5 py-2.5 flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-slate-500">
                  {format(new Date(v.realizedAt), "PPp", { locale: fr })} ·{" "}
                  {v.validatedByName}
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {v.actionLabel}
                </div>
                {v.comment && (
                  <div className="text-xs text-slate-600 mt-1">« {v.comment} »</div>
                )}
              </div>
              {cancellable && (
                <button
                  type="button"
                  onClick={() => cancel(v)}
                  className="shrink-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded"
                  title="Annuler cette validation (fenêtre de 5 minutes)"
                  aria-label="Annuler la validation"
                >
                  <Icon.Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
