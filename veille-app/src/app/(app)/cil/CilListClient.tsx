"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { INCIDENT_TYPE_LABELS, type IncidentType } from "@/lib/cil/types";
import { fmtDateTimeFr } from "@/lib/cil/format";

type Item = {
  id: string;
  reference: string | null;
  type: string;
  typeLibre: string | null;
  lieu: string;
  status: string;
  occurredAt: string;
  closedAt: string | null;
  authorName: string;
  depeches: number;
  intervenants: number;
};

export default function CilListClient({ items: initial }: { items: Item[] }) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [items, setItems] = useState(initial);

  async function remove(it: Item) {
    const ok = await ask({
      title: "Supprimer cet incident ?",
      description: "Le brouillon et toutes ses données seront supprimés.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/cil/${it.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((a) => a.filter((x) => x.id !== it.id));
      toast.success("Incident supprimé");
    } else {
      toast.error("Suppression impossible");
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-4xl mx-auto">
      {dialog}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Icon.Shield className="w-6 h-6 text-rose-600" /> Livret CIL
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Assistant Chef d&apos;Incident Local — gestion d&apos;un incident et
            génération du livret officiel.
          </p>
        </div>
        <button
          onClick={() => router.push("/cil/new")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg shrink-0"
        >
          <Icon.Plus className="w-4 h-4" /> Nouvel incident
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-14 text-sm text-slate-500">
          Aucun incident. Cliquez « Nouvel incident » pour démarrer.
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map((it) => {
            const closed = it.status === "CLOSED";
            const nature =
              it.type === "AUTRE" && it.typeLibre
                ? it.typeLibre
                : INCIDENT_TYPE_LABELS[it.type as IncidentType] ?? it.type;
            return (
              <li
                key={it.id}
                className={`rounded-xl border flex items-stretch hover:shadow-md transition-all ${
                  closed ? "bg-slate-50 border-slate-200" : "bg-white border-rose-200"
                }`}
              >
                <Link href={`/cil/${it.id}`} className="flex-1 min-w-0 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {nature} · {it.lieu}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        closed
                          ? "bg-slate-200 text-slate-600"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {closed ? "CLÔTURÉ" : "EN COURS"}
                    </span>
                    {it.reference && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {it.reference}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {fmtDateTimeFr(it.occurredAt)} · par {it.authorName} ·{" "}
                    {it.depeches} dépêche(s) · {it.intervenants} intervenant(s)
                  </div>
                </Link>
                {!closed && (
                  <button
                    onClick={() => remove(it)}
                    className="px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-r-xl"
                    title="Supprimer"
                    aria-label="Supprimer l'incident"
                  >
                    <Icon.Trash className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
