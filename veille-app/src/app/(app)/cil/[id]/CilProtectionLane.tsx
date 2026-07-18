"use client";

import { Icon } from "@/components/icons";
import type { CilActionId } from "@/lib/cil/machine";
import type { ProtectionKind, ProtectionLaneState } from "@/lib/cil/machine";
import type { CilDepecheDTO } from "@/lib/cil/types";

/**
 * « Fil d'Ariane » d'une protection (rouge circulation / bleue électrique) :
 * Protection → reprise/rétablissement partiel (optionnel) → normal (lève) → ✓.
 * Chaque nœud a un statut et déclenche la modale correspondante.
 */
const CONF: Record<
  ProtectionKind,
  {
    title: string;
    color: "rose" | "sky";
    subtype: string;
    create: CilActionId;
    partiel: CilActionId;
    normal: CilActionId;
    partielLabel: string;
    normalLabel: string;
  }
> = {
  CIRCULATION: {
    title: "Protection circulation (rouge)",
    color: "rose",
    subtype: "PROTECTION_CIRCULATION",
    create: "ADD_PROTECTION_CIRCULATION",
    partiel: "ADD_REPRISE_PARTIELLE",
    normal: "ADD_REPRISE_NORMALE",
    partielLabel: "Reprise partielle",
    normalLabel: "Reprise de la circulation",
  },
  ELECTRIQUE: {
    title: "Protection électrique (bleue)",
    color: "sky",
    subtype: "PROTECTION_ELECTRIQUE",
    create: "ADD_PROTECTION_ELECTRIQUE",
    partiel: "ADD_RETABLISSEMENT_PARTIEL",
    normal: "ADD_RETABLISSEMENT_NORMAL",
    partielLabel: "Rétablissement partiel",
    normalLabel: "Rétablissement de la tension",
  },
};

export function CilProtectionLane({
  kind,
  lane,
  depeches,
  arrivedOnSite,
  closed,
  onAction,
}: {
  kind: ProtectionKind;
  lane: ProtectionLaneState;
  depeches: CilDepecheDTO[];
  arrivedOnSite: boolean;
  closed: boolean;
  onAction: (id: CilActionId) => void;
}) {
  const c = CONF[kind];
  const ring = c.color === "rose" ? "border-rose-300" : "border-sky-300";
  const head = c.color === "rose" ? "text-rose-700" : "text-sky-700";
  const dot = c.color === "rose" ? "bg-rose-500" : "bg-sky-500";
  const btn =
    c.color === "rose"
      ? "bg-rose-600 hover:bg-rose-700 border-rose-600"
      : "bg-sky-600 hover:bg-sky-700 border-sky-600";

  const protNums = depeches
    .filter((d) => d.subtype === c.subtype)
    .sort((a, b) => a.numeroDonne - b.numeroDonne);

  const Node = ({
    state,
    label,
    detail,
    action,
  }: {
    state: "done" | "todo" | "locked";
    label: string;
    detail?: string;
    action?: CilActionId;
  }) => (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
          state === "done" ? dot : state === "locked" ? "bg-slate-200" : "border-2 border-slate-300 bg-white"
        }`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${state === "locked" ? "text-slate-400" : "text-slate-800"}`}>
          {state === "done" && <Icon.Check className="inline w-3.5 h-3.5 text-emerald-600 mr-1" />}
          {label}
        </div>
        {detail && <div className="text-[11px] text-slate-500">{detail}</div>}
        {action && state !== "done" && !closed && (
          <button
            onClick={() => onAction(action)}
            disabled={state === "locked"}
            className={`mt-1 text-xs font-semibold text-white px-2.5 py-1 rounded-lg border disabled:opacity-40 ${btn}`}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className={`card p-4 border-2 ${ring}`}>
      <h3 className={`text-sm font-bold mb-3 ${head}`}>
        {c.title}
        {lane.lifted && <span className="ml-2 text-[10px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">LEVÉE</span>}
        {lane.active && <span className="ml-2 text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">ACTIVE</span>}
      </h3>

      {!lane.created ? (
        <div className="space-y-1">
          <Node state="todo" label={`Créer la ${c.title.toLowerCase()}`} action={c.create} />
          {!arrivedOnSite && (
            <p className="text-[11px] text-amber-600 ml-4">
              Arrivée sur site non déclarée — la responsabilité est encore au CRC.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <Node
            state="done"
            label="Protection passée"
            detail={protNums.map((d) => `${d.interlocutor} n° ${d.numeroDonne}${d.numeroRecu ? `/${d.numeroRecu}` : ""}`).join(" · ")}
          />
          <Node
            state={lane.partialDone ? "done" : lane.lifted ? "locked" : "todo"}
            label={c.partielLabel}
            action={c.partiel}
          />
          <Node
            state={lane.lifted ? "done" : "todo"}
            label={c.normalLabel}
            action={c.normal}
          />
        </div>
      )}
    </section>
  );
}
