"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type Item = { id: string; label: string };
type Section = {
  id: string;
  title: string;
  icon: string | null;
  evalMode: "PER_ITEM" | "PER_SECTION";
  category: string | null;
  items: Item[];
};
type Observation = {
  id: string;
  sectionId: string;
  itemId: string | null;
  status: string;
  comment: string | null;
};
type NC = {
  id: string;
  sortOrder: number;
  description: string;
  riskIdentified: string | null;
  evrpCotation: string | null;
  proposedMeasures: string | null;
  responsible: string | null;
  plannedDate: string | null;
  redressedDate: string | null;
  closedDate: string | null;
  generatedActionId: string | null;
};
type Visit = {
  id: string;
  status: string;
  visitDate: string;
  generalComment: string | null;
  template: { id: string; name: string; pdfLayout: string; sections: Section[] };
  site: { id: string; name: string; code: string | null; type: string | null };
  observer: { id: string; name: string };
  observations: Observation[];
  nonConformities: NC[];
};

const STATUS_ITEM = [
  { v: "OUI", short: "Oui", color: "bg-emerald-600 text-white border-emerald-600" },
  { v: "NON", short: "Non", color: "bg-rose-600 text-white border-rose-600" },
  { v: "SANS_OBJET", short: "Sans objet", color: "bg-slate-400 text-white border-slate-400" },
];
const STATUS_SECTION = [
  { v: "CONFORME", short: "Conforme", color: "bg-emerald-600 text-white border-emerald-600" },
  { v: "NON_CONFORME", short: "Non conforme", color: "bg-rose-600 text-white border-rose-600" },
  { v: "SANS_OBJET", short: "Sans objet", color: "bg-slate-400 text-white border-slate-400" },
];

export default function VisitClient({ visit: initial }: { visit: Visit }) {
  const router = useRouter();
  const { dialog, ask } = useConfirmDialog();
  const [visit, setVisit] = useState<Visit>(initial);
  const completed = visit.status === "completed" || visit.status === "archived";

  const obsKey = (sectionId: string, itemId: string | null) =>
    `${sectionId}|${itemId ?? "_"}`;
  const obsMap = useMemo(() => {
    const m = new Map<string, Observation>();
    for (const o of visit.observations) m.set(obsKey(o.sectionId, o.itemId), o);
    return m;
  }, [visit.observations]);

  const { done, total, ko } = useMemo(() => {
    let d = 0,
      t = 0,
      k = 0;
    for (const s of visit.template.sections) {
      if (s.evalMode === "PER_ITEM") {
        for (const it of s.items) {
          t++;
          const o = obsMap.get(obsKey(s.id, it.id));
          if (o && o.status !== "PENDING") d++;
          if (o?.status === "NON") k++;
        }
      } else {
        t++;
        const o = obsMap.get(obsKey(s.id, null));
        if (o && o.status !== "PENDING") d++;
        if (o?.status === "NON_CONFORME") k++;
      }
    }
    return { done: d, total: t, ko: k };
  }, [visit.template.sections, obsMap]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function setStatus(
    sectionId: string,
    itemId: string | null,
    status: string
  ) {
    if (completed) return;
    const res = await fetch(`/api/visits/${visit.id}/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, itemId, status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Erreur");
      return;
    }
    const updated: Observation = await res.json();
    setVisit((v) => ({
      ...v,
      observations: [
        ...v.observations.filter(
          (o) => !(o.sectionId === sectionId && (o.itemId ?? null) === (itemId ?? null))
        ),
        updated,
      ],
    }));
  }
  async function setComment(
    sectionId: string,
    itemId: string | null,
    comment: string
  ) {
    if (completed) return;
    const current = obsMap.get(obsKey(sectionId, itemId));
    const res = await fetch(`/api/visits/${visit.id}/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId,
        itemId,
        status: current?.status ?? "PENDING",
        comment,
      }),
    });
    if (res.ok) {
      const updated: Observation = await res.json();
      setVisit((v) => ({
        ...v,
        observations: [
          ...v.observations.filter(
            (o) =>
              !(o.sectionId === sectionId && (o.itemId ?? null) === (itemId ?? null))
          ),
          updated,
        ],
      }));
    }
  }

  async function addNC(description: string, observation?: Observation) {
    if (completed || !description.trim()) return;
    const res = await fetch(`/api/visits/${visit.id}/non-conformities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        proposedMeasures: observation?.comment ?? null,
        generateAction: true,
      }),
    });
    if (res.ok) {
      const nc: NC = await res.json();
      setVisit((v) => ({ ...v, nonConformities: [...v.nonConformities, nc] }));
    }
  }
  async function patchNC(ncId: string, patch: Partial<NC>) {
    const res = await fetch(
      `/api/visits/${visit.id}/non-conformities/${ncId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (res.ok) {
      setVisit((v) => ({
        ...v,
        nonConformities: v.nonConformities.map((n) =>
          n.id === ncId ? { ...n, ...patch } : n
        ),
      }));
    }
  }
  async function removeNC(ncId: string) {
    const ok = await ask({
      title: "Supprimer cette non-conformité ?",
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(
      `/api/visits/${visit.id}/non-conformities/${ncId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setVisit((v) => ({
        ...v,
        nonConformities: v.nonConformities.filter((n) => n.id !== ncId),
      }));
      toast.success("Non-conformité supprimée");
    } else {
      toast.error("Impossible de supprimer la non-conformité");
    }
  }

  async function finish() {
    const ok = await ask({
      title: "Clôturer la visite ?",
      description:
        "Les saisies seront verrouillées après clôture.\nVous pourrez toujours consulter le rapport généré.",
      confirmLabel: "Clôturer",
    });
    if (!ok) return;
    const res = await fetch(`/api/visits/${visit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      router.push(`/visits/${visit.id}/report`);
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Impossible de clôturer la visite");
    }
  }

  return (
    <div className="pb-32">
      {dialog}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 no-print">
        <div className="px-4 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900 p-1.5 -ml-1.5 rounded-md hover:bg-slate-100"
            aria-label="Retour"
          >
            <Icon.ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  visit.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : visit.status === "active"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {visit.status.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500">
                {visit.template.name}
              </span>
              {ko > 0 && (
                <span className="text-xs text-rose-700 font-semibold">
                  · {ko} non conforme(s)
                </span>
              )}
            </div>
            <div className="text-sm font-bold mt-0.5 truncate">
              {visit.site.name}{" "}
              <span className="text-xs font-mono text-slate-500">
                · {format(new Date(visit.visitDate), "P", { locale: fr })}
              </span>
            </div>
          </div>
          {!completed && (
            <button
              onClick={finish}
              className="hidden md:inline-flex btn btn-primary"
            >
              <Icon.Check className="w-4 h-4" /> Clôturer
            </button>
          )}
        </div>
        <div className="px-4 lg:px-8 pb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct === 100
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-indigo-400 to-indigo-600"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-500">
            {done}/{total} · {pct}%
          </span>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-6xl mx-auto">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
          {visit.template.sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              obsMap={obsMap}
              completed={completed}
              setStatus={setStatus}
              setComment={setComment}
              addNC={addNC}
            />
          ))}
        </div>

        {/* Tableau récap NC */}
        <section className="card mt-6 overflow-hidden">
          <header className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Icon.AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-bold flex-1">
              Récapitulatif des non-conformités
            </span>
            <span className="text-xs font-mono text-slate-500">
              {visit.nonConformities.length} NC
            </span>
          </header>
          <ul>
            {visit.nonConformities.map((nc) => (
              <NCRow
                key={nc.id}
                nc={nc}
                disabled={completed}
                onPatch={(p) => patchNC(nc.id, p)}
                onRemove={() => removeNC(nc.id)}
              />
            ))}
            {!visit.nonConformities.length && (
              <li className="px-4 py-6 text-center text-xs text-slate-500">
                Aucune non-conformité — sera alimentée automatiquement
                lorsqu&apos;une observation passe en Non / Non conforme.
              </li>
            )}
          </ul>
        </section>
      </div>

      {!completed && (
        <div className="lg:hidden fixed bottom-[76px] left-4 right-4 z-30 no-print">
          <button onClick={finish} className="btn btn-primary w-full justify-center">
            <Icon.Check className="w-4 h-4" /> Clôturer la visite
          </button>
        </div>
      )}
      {completed && (
        <div className="fixed bottom-[76px] lg:bottom-6 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-30 no-print">
          <button
            onClick={() => router.push(`/visits/${visit.id}/report`)}
            className="btn btn-primary w-full lg:w-auto justify-center"
          >
            <Icon.FileText className="w-4 h-4" /> Voir le compte rendu
          </button>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section,
  obsMap,
  completed,
  setStatus,
  setComment,
  addNC,
}: {
  section: Section;
  obsMap: Map<string, Observation>;
  completed: boolean;
  setStatus: (sectionId: string, itemId: string | null, s: string) => void;
  setComment: (sectionId: string, itemId: string | null, c: string) => void;
  addNC: (description: string, obs?: Observation) => void;
}) {
  const isItemMode = section.evalMode === "PER_ITEM";
  return (
    <article className="card overflow-hidden break-inside-avoid">
      <header className="px-4 pt-3 pb-2 flex items-start gap-2">
        {section.icon && <span className="text-lg leading-none">{section.icon}</span>}
        <div className="flex-1 min-w-0">
          {section.category && (
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              {section.category}
            </div>
          )}
          <h3 className="text-sm font-bold leading-tight">{section.title}</h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {section.evalMode === "PER_ITEM" ? "par item" : "par section"}
        </span>
      </header>

      {isItemMode ? (
        <ul>
          {section.items.map((it) => {
            const o = obsMap.get(`${section.id}|${it.id}`);
            return (
              <ItemRow
                key={it.id}
                sectionId={section.id}
                item={it}
                obs={o}
                completed={completed}
                statuses={STATUS_ITEM}
                setStatus={setStatus}
                setComment={setComment}
                addNC={addNC}
                koValue="NON"
              />
            );
          })}
        </ul>
      ) : (
        <SectionGlobal
          section={section}
          sectionObs={obsMap.get(`${section.id}|_`)}
          itemObsMap={
            new Map(
              section.items
                .map(
                  (it) => [it.id, obsMap.get(`${section.id}|${it.id}`)] as const
                )
                .filter((p): p is [string, Observation] => !!p[1])
            )
          }
          completed={completed}
          setStatus={setStatus}
          setComment={setComment}
          addNC={addNC}
        />
      )}
    </article>
  );
}

function ItemRow({
  sectionId,
  item,
  obs,
  completed,
  statuses,
  setStatus,
  setComment,
  addNC,
  koValue,
}: {
  sectionId: string;
  item: Item;
  obs?: Observation;
  completed: boolean;
  statuses: { v: string; short: string; color: string }[];
  setStatus: (sectionId: string, itemId: string | null, s: string) => void;
  setComment: (sectionId: string, itemId: string | null, c: string) => void;
  addNC: (description: string, obs?: Observation) => void;
  koValue: string;
}) {
  const isKO = obs?.status === koValue;
  // Champ observation toujours rendu (pas seulement si KO). Il reste accessible
  // même en cas de conformité, conformément à la spec.
  const [local, setLocal] = useState(obs?.comment ?? "");
  const [commentExpanded, setCommentExpanded] = useState(!!obs?.comment || isKO);

  function handleStatus(s: string) {
    if (s === koValue) setCommentExpanded(true);
    setStatus(sectionId, item.id, s);
  }

  return (
    <li
      className={`border-t border-slate-100 px-3 py-2 ${isKO ? "bg-rose-50/30" : ""}`}
    >
      <div className="text-sm">{item.label}</div>
      {!completed && (
        <div className="flex gap-1.5 mt-1.5 items-center flex-wrap">
          {statuses.map((s) => (
            <button
              key={s.v}
              onClick={() => handleStatus(s.v)}
              className={`text-[11px] font-medium px-2 py-1 rounded-md border ${
                obs?.status === s.v
                  ? s.color
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s.short}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCommentExpanded((v) => !v)}
            className="ml-auto text-[10px] font-mono text-indigo-600 inline-flex items-center gap-1"
            title="Observations"
          >
            <Icon.MessageSquare className="w-3.5 h-3.5" />
            {commentExpanded ? "Masquer" : "Observations"}
            {obs?.comment && !commentExpanded && (
              <span className="bg-indigo-100 text-indigo-700 rounded-full w-1.5 h-1.5" />
            )}
          </button>
        </div>
      )}
      {commentExpanded && (
        <div className="mt-2">
          <textarea
            disabled={completed}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              if (local !== (obs?.comment ?? ""))
                setComment(sectionId, item.id, local);
            }}
            placeholder="Observations (toujours disponible)…"
            className="input min-h-[56px] resize-y text-[13px]"
          />
          {isKO && !completed && (
            <button
              type="button"
              onClick={() => addNC(item.label, obs)}
              className="text-[11px] text-indigo-600 underline mt-1.5 inline-flex items-center gap-1"
            >
              <Icon.Plus className="w-3 h-3" /> Ajouter au récap des
              non-conformités
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function SectionGlobal({
  section,
  sectionObs,
  itemObsMap,
  completed,
  setStatus,
  setComment,
  addNC,
}: {
  section: Section;
  sectionObs?: Observation;
  itemObsMap: Map<string, Observation>;
  completed: boolean;
  setStatus: (sectionId: string, itemId: string | null, s: string) => void;
  setComment: (sectionId: string, itemId: string | null, c: string) => void;
  addNC: (description: string, obs?: Observation) => void;
}) {
  const isKO = sectionObs?.status === "NON_CONFORME";
  const [local, setLocal] = useState(sectionObs?.comment ?? "");
  // Statut item par défaut affiché en bullet ; cliquer cycle ✓ → ✗ → ⊘ → vide.
  function cycleItem(itemId: string, current: string | undefined) {
    if (completed) return;
    const next =
      current === "OUI"
        ? "NON"
        : current === "NON"
        ? "SANS_OBJET"
        : current === "SANS_OBJET"
        ? "PENDING"
        : "OUI";
    setStatus(section.id, itemId, next);
  }

  const checkedCount = section.items.filter((it) => {
    const o = itemObsMap.get(it.id);
    return o && o.status !== "PENDING";
  }).length;

  return (
    <div className="px-3 pb-3 space-y-3">
      {/* Liste des items cochables — chaque ligne a un statut individuel. */}
      {section.items.length > 0 && (
        <ul className="space-y-1">
          {section.items.map((it) => {
            const o = itemObsMap.get(it.id);
            const status = o?.status;
            const tone =
              status === "OUI"
                ? "bg-emerald-500 border-emerald-500 text-white"
                : status === "NON"
                ? "bg-rose-500 border-rose-500 text-white"
                : status === "SANS_OBJET"
                ? "bg-slate-400 border-slate-400 text-white"
                : "bg-white border-slate-300 text-slate-400";
            const mark =
              status === "OUI"
                ? "✓"
                : status === "NON"
                ? "✗"
                : status === "SANS_OBJET"
                ? "—"
                : "";
            return (
              <li
                key={it.id}
                className="text-[12.5px] flex items-start gap-2"
              >
                <button
                  type="button"
                  disabled={completed}
                  onClick={() => cycleItem(it.id, status)}
                  className={`w-4 h-4 rounded border-2 grid place-items-center text-[10px] font-bold shrink-0 mt-0.5 transition-colors ${tone}`}
                  title="Cliquer pour cycler : ✓ → ✗ → — → vide"
                >
                  {mark}
                </button>
                <span
                  className={`flex-1 leading-snug ${
                    status === "NON" ? "text-rose-700 font-medium" : "text-slate-700"
                  }`}
                >
                  {it.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {section.items.length > 0 && (
        <div className="text-[10px] font-mono text-slate-400">
          {checkedCount}/{section.items.length} checkpoints renseignés
        </div>
      )}

      {/* Statut bloc */}
      {!completed && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            Statut global du bloc
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_SECTION.map((s) => (
              <button
                key={s.v}
                onClick={() => setStatus(section.id, null, s.v)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                  sectionObs?.status === s.v
                    ? s.color
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Observations bloc — toujours visible, même si conforme. */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
          Observations
        </div>
        <textarea
          disabled={completed}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (local !== (sectionObs?.comment ?? ""))
              setComment(section.id, null, local);
          }}
          placeholder="Commentaire libre, observations terrain…"
          className="input min-h-[60px] resize-y text-[13px]"
        />
        {isKO && !completed && (
          <button
            type="button"
            onClick={() =>
              addNC(
                local.trim() ||
                  `${section.title} — à préciser`,
                sectionObs
              )
            }
            className="text-[11px] text-indigo-600 underline mt-1.5 inline-flex items-center gap-1"
          >
            <Icon.Plus className="w-3 h-3" /> Ajouter au récap des
            non-conformités
          </button>
        )}
      </div>
    </div>
  );
}

function NCRow({
  nc,
  disabled,
  onPatch,
  onRemove,
}: {
  nc: NC;
  disabled: boolean;
  onPatch: (p: Partial<NC>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="border-t border-slate-100 first:border-t-0 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="text-xs font-mono text-slate-400 mt-0.5 w-5 text-center">
          #{nc.sortOrder}
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            disabled={disabled}
            value={nc.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Description"
            className="input md:col-span-2 text-sm font-semibold"
          />
          <input
            disabled={disabled}
            value={nc.riskIdentified ?? ""}
            onChange={(e) => onPatch({ riskIdentified: e.target.value })}
            placeholder="Risque identifié"
            className="input text-xs"
          />
          <input
            disabled={disabled}
            value={nc.evrpCotation ?? ""}
            onChange={(e) => onPatch({ evrpCotation: e.target.value })}
            placeholder="Cotation EVRp"
            className="input text-xs"
          />
          <input
            disabled={disabled}
            value={nc.proposedMeasures ?? ""}
            onChange={(e) => onPatch({ proposedMeasures: e.target.value })}
            placeholder="Mesures proposées"
            className="input text-xs md:col-span-2"
          />
          <input
            disabled={disabled}
            value={nc.responsible ?? ""}
            onChange={(e) => onPatch({ responsible: e.target.value })}
            placeholder="Responsable"
            className="input text-xs"
          />
          <div className="flex gap-1.5">
            <input
              disabled={disabled}
              type="date"
              value={nc.plannedDate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onPatch({
                  plannedDate: e.target.value
                    ? new Date(e.target.value + "T00:00:00").toISOString()
                    : null,
                })
              }
              className="input text-xs"
              title="Date prévue"
            />
            <input
              disabled={disabled}
              type="date"
              value={nc.redressedDate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onPatch({
                  redressedDate: e.target.value
                    ? new Date(e.target.value + "T00:00:00").toISOString()
                    : null,
                })
              }
              className="input text-xs"
              title="Date de redressement"
            />
          </div>
        </div>
        {!disabled && (
          <button
            onClick={onRemove}
            className="text-rose-600 hover:text-rose-800 p-1"
            title="Supprimer"
          >
            <Icon.X className="w-4 h-4" />
          </button>
        )}
      </div>
      {nc.generatedActionId && (
        <div className="text-[10px] font-mono text-slate-400 mt-1.5">
          → action générée pour le site (visible sur la fiche site)
        </div>
      )}
    </li>
  );
}
