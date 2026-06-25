"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  RESPONSE_FORMAT_LABELS,
  vehicleTypeLabel,
  type ResponseFormat,
} from "@/lib/vehicle-types";

type Observation = {
  id: string;
  status: string;
  comment: string | null;
};
type Item = {
  id: string;
  label: string;
  responseFormat: string;
  applicableTypes: string[];
  observation: Observation | null;
};
type Section = {
  id: string;
  title: string;
  icon: string | null;
  items: Item[];
};
type Round = {
  id: string;
  roundDate: string;
  status: string;
  generalComment: string | null;
  immatriculation: string;
  vehicleType: string;
  vehicleLabel: string | null;
  templateName: string;
  observerName: string;
};

const STATUS_TONE: Record<string, string> = {
  OUI: "bg-emerald-600 text-white border-emerald-600",
  NON: "bg-rose-600 text-white border-rose-600",
  SANS_OBJET: "bg-slate-600 text-white border-slate-600",
  PENDING: "bg-slate-50 text-slate-600 border-slate-200",
};

function isResponseFormat(value: string): value is ResponseFormat {
  return value in RESPONSE_FORMAT_LABELS;
}

export default function VehicleRoundClient({
  round,
  sections: initialSections,
  canEdit,
}: {
  round: Round;
  sections: Section[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [sections, setSections] = useState(initialSections);
  const [generalComment, setGeneralComment] = useState(
    round.generalComment ?? ""
  );
  const [savingComment, setSavingComment] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const total = allItems.length;
  const evaluated = allItems.filter(
    (i) => i.observation && i.observation.status !== "PENDING"
  ).length;
  const ko = allItems.filter((i) => i.observation?.status === "NON").length;
  const pending = total - evaluated;
  const evaluatedCount = total - pending;
  const conformity =
    evaluatedCount > 0
      ? Math.round(((evaluatedCount - ko) / evaluatedCount) * 100)
      : null;

  async function setStatus(item: Item, status: "OUI" | "NON" | "SANS_OBJET") {
    if (!item.observation || !canEdit) return;
    const obsId = item.observation.id;
    // Optimistic update
    setSections((arr) =>
      arr.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === item.id && i.observation
            ? { ...i, observation: { ...i.observation, status } }
            : i
        ),
      }))
    );
    const res = await fetch(
      `/api/vehicle-rounds/${round.id}/observations/${obsId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    if (!res.ok) {
      toast.error("Sauvegarde refusée");
      // Rollback
      setSections((arr) =>
        arr.map((s) => ({
          ...s,
          items: s.items.map((i) =>
            i.id === item.id ? { ...item } : i
          ),
        }))
      );
    }
  }

  async function setComment(item: Item, comment: string) {
    if (!item.observation || !canEdit) return;
    const obsId = item.observation.id;
    setSections((arr) =>
      arr.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === item.id && i.observation
            ? { ...i, observation: { ...i.observation, comment } }
            : i
        ),
      }))
    );
    await fetch(`/api/vehicle-rounds/${round.id}/observations/${obsId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || null }),
    });
  }

  async function saveGeneralComment() {
    setSavingComment(true);
    const res = await fetch(`/api/vehicle-rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalComment: generalComment || null }),
    });
    setSavingComment(false);
    if (res.ok) toast.success("Commentaire enregistré");
    else toast.error("Sauvegarde refusée");
  }

  async function finish() {
    if (pending > 0) {
      const ok = await ask({
        title: `Terminer avec ${pending} item(s) non saisi(s) ?`,
        description:
          "Les items non saisis seront comptés comme « non observés ». Vous pourrez consulter le rapport mais l'édition sera fermée.",
        confirmLabel: "Terminer",
      });
      if (!ok) return;
    } else {
      const ok = await ask({
        title: "Terminer la tournée ?",
        description: "L'édition sera fermée. Vous pourrez consulter le rapport.",
        confirmLabel: "Terminer",
      });
      if (!ok) return;
    }
    setFinishing(true);
    const res = await fetch(`/api/vehicle-rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    setFinishing(false);
    if (res.ok) {
      toast.success("Tournée terminée");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Sauvegarde refusée");
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-4xl mx-auto">
      {dialog}
      <div className="mb-4">
        <Link
          href="/vehicle-rounds"
          className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
        >
          <Icon.ChevronLeft className="w-3 h-3" /> Tournées
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2 flex-wrap">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight font-mono">
              {round.immatriculation}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {vehicleTypeLabel(round.vehicleType)}
              {round.vehicleLabel ? ` · ${round.vehicleLabel}` : ""}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {round.templateName} · Tournée du{" "}
              {format(new Date(round.roundDate), "PPP", { locale: fr })} ·
              Observateur : {round.observerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {round.status === "completed" && (
              <>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold border border-emerald-200">
                  TERMINÉE
                </span>
                <Link
                  href={`/vehicle-rounds/${round.id}/report`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  <Icon.FileText className="w-4 h-4" /> Rapport
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Récap */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Évalués
          </div>
          <div className="text-lg font-bold mt-0.5">
            {evaluated} / {total}
          </div>
        </div>
        <div className="card px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Non conformes
          </div>
          <div
            className={`text-lg font-bold mt-0.5 ${ko > 0 ? "text-rose-700" : "text-slate-700"}`}
          >
            {ko}
          </div>
        </div>
        <div className="card px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Conformité
          </div>
          <div
            className={`text-lg font-bold mt-0.5 ${
              conformity === null
                ? "text-slate-400"
                : conformity === 100
                  ? "text-emerald-700"
                  : conformity >= 80
                    ? "text-amber-700"
                    : "text-rose-700"
            }`}
          >
            {conformity === null ? "—" : `${conformity}%`}
          </div>
        </div>
      </div>

      {/* Sections + items */}
      <div className="space-y-4">
        {sections.map((s) => (
          <section
            key={s.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <header className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <span>{s.icon ?? "📋"}</span>
              <h2 className="text-sm font-bold text-slate-800">{s.title}</h2>
              <span className="text-[11px] text-slate-500 ml-auto">
                {s.items.filter(
                  (i) => i.observation && i.observation.status !== "PENDING"
                ).length}{" "}
                / {s.items.length}
              </span>
            </header>
            <ul className="divide-y divide-slate-100">
              {s.items.map((item) => {
                const fmt = isResponseFormat(item.responseFormat)
                  ? RESPONSE_FORMAT_LABELS[item.responseFormat]
                  : RESPONSE_FORMAT_LABELS.PRESENT_ABSENT;
                const status = item.observation?.status ?? "PENDING";
                return (
                  <li key={item.id} className="px-4 py-3">
                    <div className="text-sm text-slate-800">{item.label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setStatus(item, "OUI")}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                          status === "OUI"
                            ? STATUS_TONE.OUI
                            : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                        } disabled:opacity-50`}
                      >
                        {fmt.oui}
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setStatus(item, "NON")}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                          status === "NON"
                            ? STATUS_TONE.NON
                            : "bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                        } disabled:opacity-50`}
                      >
                        {fmt.non}
                      </button>
                      {fmt.sansObjet && (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setStatus(item, "SANS_OBJET")}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                            status === "SANS_OBJET"
                              ? STATUS_TONE.SANS_OBJET
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          } disabled:opacity-50`}
                        >
                          {fmt.sansObjet}
                        </button>
                      )}
                    </div>
                    {(status === "NON" || item.observation?.comment) && (
                      <input
                        type="text"
                        disabled={!canEdit}
                        defaultValue={item.observation?.comment ?? ""}
                        onBlur={(e) => setComment(item, e.target.value)}
                        placeholder="Commentaire (facultatif)…"
                        className="mt-2 w-full text-xs rounded-md border border-slate-200 px-2.5 py-1.5 disabled:opacity-60"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Commentaire général + actions */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4">
        <label className="text-sm font-semibold text-slate-800 block mb-2">
          Commentaire général
        </label>
        <textarea
          value={generalComment}
          disabled={!canEdit}
          onChange={(e) => setGeneralComment(e.target.value)}
          onBlur={saveGeneralComment}
          rows={3}
          placeholder="Observations complémentaires, contexte de la tournée…"
          className="w-full text-sm rounded-md border border-slate-200 px-3 py-2 disabled:opacity-60"
        />
        {savingComment && (
          <div className="text-xs text-slate-400 mt-1">Enregistrement…</div>
        )}
      </div>

      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex justify-end">
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-lg disabled:opacity-50"
          >
            <Icon.Check className="w-4 h-4" />
            Terminer la tournée
          </button>
        </div>
      )}
    </div>
  );
}
