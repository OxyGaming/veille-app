"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { CilActionModal, EditEventModal } from "./CilModals";
import { CilProtectionLane } from "./CilProtectionLane";
import {
  activeProtections,
  derivePhase,
  pendingReminders,
  protectionLane,
  type CilActionId,
  type MachineContext,
  type PendingReminder,
} from "@/lib/cil/machine";
import { availabilityGrid } from "@/lib/cil/numbering";
import { computeChecklists } from "@/lib/cil/checklist";
import { fmtDateTimeFr, fmtDayLongFr, fmtTimeFr, localInputToIso } from "@/lib/cil/format";
import {
  DEPECHE_SUBTYPE_LABELS,
  INCIDENT_TYPE_LABELS,
  INTERVENANT_TYPE_LABELS,
  type CilDepecheDTO,
  type CilEventDTO,
  type CilIncidentFull,
  type DepecheSubtype,
  type IncidentType,
  type IntervenantType,
} from "@/lib/cil/types";

type Role = "USER" | "EDITOR" | "ADMIN";

export default function CilDashboard({
  initial,
  role,
}: {
  initial: CilIncidentFull;
  role: Role;
}) {
  const router = useRouter();
  const [full, setFull] = useState(initial);
  const [modalAction, setModalAction] = useState<CilActionId | null>(null);
  const [editEvent, setEditEvent] = useState<CilEventDTO | null>(null);
  const [generating, setGenerating] = useState(false);
  /** Texte repris d'une dépêche passée quand on la transmet à un autre interlocuteur. */
  const [prefillTexte, setPrefillTexte] = useState<string | undefined>();
  /** Rappel dont on saisit une heure d'avis différente de « maintenant ». */
  const [customTimeFor, setCustomTimeFor] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState("");

  const inc = full.incident;
  const closed = inc.status === "CLOSED";

  const reload = useCallback(async () => {
    const res = await fetch(`/api/cil/${inc.id}`);
    if (res.ok) setFull(await res.json());
  }, [inc.id]);

  const ctx: MachineContext = useMemo(
    () => ({
      status: inc.status,
      arrivedOnSiteAt: inc.arrivedOnSiteAt,
      depecheSubtypes: full.depeches.map((d) => d.subtype),
      role,
    }),
    [inc.status, inc.arrivedOnSiteAt, full.depeches, role],
  );

  const prot = useMemo(() => activeProtections(ctx), [ctx]);
  const phase = derivePhase(ctx);
  const canReopen = role === "EDITOR" || role === "ADMIN";
  const closeWarning =
    prot.circulation || prot.electrique
      ? "Une ou plusieurs protections sont encore actives."
      : undefined;
  const grid = useMemo(
    () => availabilityGrid(full.depeches.map((d) => d.numeroDonne)),
    [full.depeches],
  );
  const checklists = useMemo(
    () => computeChecklists(full.depeches, full.intervenants, full.signatures),
    [full.depeches, full.intervenants, full.signatures],
  );

  const nature =
    inc.type === "AUTRE" && inc.typeLibre
      ? inc.typeLibre
      : INCIDENT_TYPE_LABELS[inc.type as IncidentType];

  async function reopen() {
    const res = await fetch(`/api/cil/${inc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (res.ok) {
      toast.success("Incident rouvert");
      reload();
    } else toast.error("Réouverture impossible");
  }

  async function generatePdf() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cil/${inc.id}/docx`, { method: "POST" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const ref = inc.reference || inc.id;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Livret-CIL-${ref}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Livret généré");
    } catch {
      toast.error("Échec de la génération du livret");
    } finally {
      setGenerating(false);
    }
  }

  async function recordDepartureNow(intId: string) {
    const res = await fetch(`/api/cil/${inc.id}/intervenants/${intId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departedAt: new Date().toISOString() }),
    });
    if (res.ok) {
      toast.success("Départ enregistré");
      reload();
    } else toast.error("Enregistrement impossible");
  }

  const presentIntervenants = full.intervenants.filter((i) => !i.departedAt);

  // Avis obligatoires encore à recueillir (dérivés, jamais stockés).
  const reminders = useMemo(
    () =>
      closed
        ? []
        : pendingReminders({
            depeches: full.depeches,
            intervenants: full.intervenants,
            events: full.events,
          }),
    [closed, full.depeches, full.intervenants, full.events],
  );

  /**
   * Horodate un avis. `iso` vaut l'heure courante pour le geste rapide
   * (« Avisé maintenant ») ou une heure saisie pour rattraper après coup.
   */
  async function recordAvis(r: PendingReminder, iso: string) {
    const url =
      r.target === "EVENT"
        ? `/api/cil/${inc.id}/events/${r.targetId}`
        : `/api/cil/${inc.id}/depeches/${r.targetId}`;
    const body =
      r.target === "EVENT"
        ? { metadata: { [r.field]: iso } }
        : { [r.field]: iso };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Heure d'avis enregistrée");
      setCustomTimeFor(null);
      reload();
    } else toast.error("Enregistrement impossible");
  }

  /** Transmet une dépêche déjà passée → dépêche libre pré-remplie (carnet). */
  function transmit(d: CilDepecheDTO) {
    setPrefillTexte(d.texte);
    setModalAction("ADD_DEPECHE_LIBRE");
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto pb-16">
      <button
        onClick={() => router.push("/cil")}
        className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-3"
      >
        <Icon.ChevronLeft className="w-4 h-4" /> Livret CIL
      </button>

      {/* En-tête incident */}
      <header className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg lg:text-xl font-bold">
                {nature} · {inc.lieu}
              </h1>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  closed ? "bg-slate-200 text-slate-600" : "bg-rose-100 text-rose-700"
                }`}
              >
                {closed ? "CLÔTURÉ" : "EN COURS"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {inc.reference} · {fmtDateTimeFr(inc.occurredAt)}
              {inc.poste ? ` · Poste ${inc.poste}` : ""}
              {inc.voie ? ` · Voie ${inc.voie}` : ""}
            </p>
            <p className="mt-1 text-xs">
              Protections :{" "}
              {inc.arrivedOnSiteAt ? (
                <span className="text-rose-700 font-semibold">
                  responsabilité CIL (depuis {fmtTimeFr(inc.arrivedOnSiteAt)})
                </span>
              ) : (
                <span className="text-slate-600 font-semibold">responsabilité CRC</span>
              )}
            </p>
          </div>
          <button
            onClick={generatePdf}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg shrink-0"
          >
            <Icon.Download className="w-4 h-4" />
            {generating ? "Génération…" : "Générer le livret"}
          </button>
        </div>
      </header>

      {/* Progression du déroulé (bandeau) */}
      <ProgressBanner phase={phase} closed={closed} />

      {/* Avis obligatoires à recueillir */}
      {reminders.length > 0 && (
        <section className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3">
          <h2 className="text-xs font-bold text-amber-900 mb-2 inline-flex items-center gap-1.5">
            <Icon.AlertTriangle className="w-4 h-4" />
            Avis à recueillir ({reminders.length})
          </h2>
          <ul className="space-y-1.5">
            {reminders.map((r) => (
              <li key={r.id} className="text-xs text-amber-900">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex-1 min-w-[12rem]">{r.message}</span>
                  <button
                    onClick={() => recordAvis(r, new Date().toISOString())}
                    className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded shrink-0"
                  >
                    Avisé maintenant
                  </button>
                  <button
                    onClick={() =>
                      setCustomTimeFor(customTimeFor === r.id ? null : r.id)
                    }
                    className="text-[11px] px-2 py-1 rounded border border-amber-400 text-amber-800 hover:bg-amber-100 shrink-0"
                  >
                    Autre heure
                  </button>
                </div>
                {customTimeFor === r.id && (
                  <div className="mt-1.5 flex gap-2 items-center">
                    <input
                      type="datetime-local"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="input text-xs"
                    />
                    <button
                      onClick={() => {
                        const iso = localInputToIso(customTime);
                        if (iso) recordAvis(r, iso);
                      }}
                      disabled={!customTime}
                      className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-2 py-1 rounded"
                    >
                      Enregistrer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Étape gating : arrivée sur site */}
      {!closed && !inc.arrivedOnSiteAt && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-3 flex-wrap">
          <p className="text-sm text-rose-800">
            À votre arrivée, déclarez-la pour reprendre la responsabilité des protections.
          </p>
          <button
            onClick={() => setModalAction("DECLARE_ARRIVAL")}
            className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg shrink-0"
          >
            Je suis arrivé sur place
          </button>
        </div>
      )}

      {/* Deux fils de protection (rouge / bleue) */}
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <CilProtectionLane
          kind="CIRCULATION"
          lane={protectionLane("CIRCULATION", ctx)}
          depeches={full.depeches}
          arrivedOnSite={!!inc.arrivedOnSiteAt}
          closed={closed}
          onAction={setModalAction}
        />
        <CilProtectionLane
          kind="ELECTRIQUE"
          lane={protectionLane("ELECTRIQUE", ctx)}
          depeches={full.depeches}
          arrivedOnSite={!!inc.arrivedOnSiteAt}
          closed={closed}
          onAction={setModalAction}
        />
      </div>

      {/* Autres actions (toujours accessibles) */}
      <section className="mb-4 flex flex-wrap gap-2">
        {closed ? (
          canReopen && (
            <button onClick={reopen} className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">
              Rouvrir l&apos;incident
            </button>
          )
        ) : (
          <>
            {(
              [
                ["ADD_INTERVENANT", "Intervenant"],
                ["ADD_DEPECHE_LIBRE", "Dépêche libre"],
                ["CHANGE_CIL", "Changement de CIL"],
                ["ADD_NOTE", "Note"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setModalAction(id)}
                className="text-sm px-3 py-2 rounded-lg border bg-white text-slate-700 border-slate-200 hover:border-rose-300"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setModalAction("CLOSE")}
              title={closeWarning}
              className="text-sm px-3 py-2 rounded-lg border bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 inline-flex items-center gap-1.5 ml-auto"
            >
              Clôturer l&apos;incident
              {closeWarning && <Icon.AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </button>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Situation intervenants */}
        <section className="card p-4">
          <h2 className="text-sm font-bold mb-2">Situation</h2>
          <div className="flex gap-2 mb-3">
            <ProtBadge active={prot.circulation} label="Circulation" color="rose" />
            <ProtBadge active={prot.electrique} label="Électrique" color="sky" />
          </div>
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            Intervenants présents ({presentIntervenants.length})
          </h3>
          {full.intervenants.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun intervenant enregistré.</p>
          ) : (
            <ul className="space-y-1">
              {full.intervenants.map((i) => (
                <li key={i.id} className="text-xs flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{INTERVENANT_TYPE_LABELS[i.type as IntervenantType]}</span>
                  {i.nom && <span className="text-slate-600">{i.nom}</span>}
                  {i.tel && (
                    <a
                      href={`tel:${i.tel.replace(/\s/g, "")}`}
                      className="text-rose-600 hover:text-rose-800 font-mono inline-flex items-center gap-1"
                      title={`Appeler ${i.nom ?? "l'intervenant"}`}
                    >
                      <Icon.Phone className="w-3 h-3" />
                      {i.tel}
                    </a>
                  )}
                  <span className="text-slate-400 font-mono">
                    {i.arrivedAt ? `↓ ${fmtTimeFr(i.arrivedAt)}` : ""}
                    {i.departedAt ? ` · ↑ ${fmtTimeFr(i.departedAt)}` : ""}
                  </span>
                  {!closed && !i.departedAt && (
                    <button
                      onClick={() => recordDepartureNow(i.id)}
                      className="text-[10px] text-rose-600 hover:text-rose-800 border border-rose-200 rounded px-1.5 py-0.5"
                    >
                      Départ maintenant
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Checklist */}
        <section className="card p-4">
          <h2 className="text-sm font-bold mb-2">Checklist</h2>
          {checklists.depeches.length === 0 && checklists.intervenants.length === 0 ? (
            <p className="text-xs text-slate-400">Rien à suivre pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {checklists.depeches.map((cl) => (
                <ChecklistBlock key={cl.depecheId} title={cl.title} items={cl.items} complete={cl.complete} />
              ))}
              {checklists.intervenants.map((cl) => (
                <ChecklistBlock key={cl.intervenantId} title={cl.title} items={cl.items} complete={cl.complete} />
              ))}
            </div>
          )}
        </section>

        {/* Dépêches déjà passées — relecture et transmission */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-bold mb-2">Dépêches passées ({full.depeches.length})</h2>
          {full.depeches.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune dépêche enregistrée.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...full.depeches]
                .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
                .map((d) => (
                  // Sur mobile le bouton passe sous le texte : en ligne, il ne
                  // laissait qu'une colonne de ~140 px pour la dépêche.
                  <li
                    key={d.id}
                    className="py-2 flex flex-col sm:flex-row gap-2 sm:gap-3 items-start"
                  >
                    <span className="text-[11px] font-mono font-bold text-rose-700 shrink-0 sm:w-10">
                      n°{d.numeroDonne}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        {DEPECHE_SUBTYPE_LABELS[d.subtype as DepecheSubtype]}
                        {d.interlocutor ? ` · ${d.interlocutor}` : ""}
                        <span className="ml-1.5 font-normal text-slate-400 font-mono">
                          {fmtTimeFr(d.occurredAt)}
                          {d.numeroRecu ? ` · reçu n°${d.numeroRecu}` : ""}
                        </span>
                      </p>
                      {d.texte && (
                        <p className="text-[11px] text-slate-500 whitespace-pre-wrap">{d.texte}</p>
                      )}
                    </div>
                    {!closed && (
                      <button
                        onClick={() => transmit(d)}
                        className="text-[10px] text-rose-600 hover:text-rose-800 border border-rose-200 rounded px-1.5 py-0.5 shrink-0"
                        title="Retransmettre ce texte à un autre interlocuteur (dépêche libre au carnet)"
                      >
                        Transmettre
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Numéros */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-bold mb-2">Numéros de dépêche</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberStripView title="Protections (10–29)" cells={grid.PROTECTION} />
            <NumberStripView title="Reprises / rétablissements (30–49)" cells={grid.RETABLISSEMENT} />
            <NumberStripView title="Dépêches libres (50–69)" cells={grid.LIBRE} />
          </div>
        </section>

        {/* Chronologie */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-bold mb-2">Chronologie</h2>
          {full.events.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun événement.</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-2 space-y-2">
              {full.events.map((e) => (
                <li key={e.id} className="ml-4 relative">
                  <span className="absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white" />
                  <div className="flex items-baseline gap-2 flex-wrap group">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {fmtTimeFr(e.occurredAt)}
                    </span>
                    <span className="text-sm text-slate-800">{e.label}</span>
                    {!closed && (
                      <button
                        onClick={() => setEditEvent(e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
                        aria-label="Corriger l'heure"
                      >
                        <Icon.FileEdit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {e.note && <p className="text-[11px] text-slate-500 italic">{e.note}</p>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[10px] text-slate-400">{fmtDayLongFr(inc.occurredAt)}</p>
        </section>
      </div>

      {modalAction && (
        <CilActionModal
          action={modalAction}
          incident={full}
          prefillTexte={prefillTexte}
          onClose={() => {
            setModalAction(null);
            setPrefillTexte(undefined);
          }}
          onDone={reload}
        />
      )}
      {editEvent && (
        <EditEventModal
          incidentId={inc.id}
          event={editEvent}
          onClose={() => setEditEvent(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}

const PHASE_ORDER = ["CREATED", "MISSION", "ON_SITE", "INTERVENTION", "REPRISE", "CLOSED"] as const;

function ProgressBanner({ phase, closed }: { phase: string; closed: boolean }) {
  const currentIdx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  const steps: { key: string; label: string }[] = [
    { key: "CREATED", label: "Incident" },
    { key: "MISSION", label: "Mission" },
    { key: "ON_SITE", label: "Arrivée" },
    { key: "INTERVENTION", label: "Protections" },
    { key: "REPRISE", label: "Reprises" },
    { key: "CLOSED", label: "Clôture" },
  ];
  return (
    <nav className="mb-4 flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]" aria-label="Progression">
      {steps.map((s, i) => {
        const idx = PHASE_ORDER.indexOf(s.key as (typeof PHASE_ORDER)[number]);
        const done = idx < currentIdx || (closed && s.key === "CLOSED");
        const active = idx === currentIdx && !closed;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <span
              className={`px-2 py-1 rounded-full font-medium ${
                active
                  ? "bg-rose-600 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-slate-300">›</span>}
          </div>
        );
      })}
    </nav>
  );
}

function ProtBadge({ active, label, color }: { active: boolean; label: string; color: "rose" | "sky" }) {
  const cls = active
    ? color === "rose"
      ? "bg-rose-100 text-rose-800 border-rose-300"
      : "bg-sky-100 text-sky-800 border-sky-300"
    : "bg-slate-50 text-slate-400 border-slate-200";
  return (
    <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${cls}`}>
      {label} : {active ? "active" : "—"}
    </span>
  );
}

function ChecklistBlock({
  title,
  items,
  complete,
}: {
  title: string;
  items: { label: string; done: boolean }[];
  complete: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
        {complete ? (
          <Icon.Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
        )}
        {title}
      </div>
      <ul className="ml-5 space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[11px] flex items-center gap-1.5">
            <span className={it.done ? "text-emerald-600" : "text-slate-300"}>
              {it.done ? "✓" : "○"}
            </span>
            <span className={it.done ? "text-slate-600" : "text-slate-400"}>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberStripView({ title, cells }: { title: string; cells: { n: number; used: boolean }[] }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <div className="grid grid-cols-10 gap-1">
        {cells.map((c) => (
          <span
            key={c.n}
            className={`text-[10px] font-mono text-center py-0.5 rounded ${
              c.used
                ? "bg-rose-600 text-white font-bold"
                : "bg-slate-100 text-slate-400"
            }`}
            title={c.used ? `n° ${c.n} utilisé` : `n° ${c.n} disponible`}
          >
            {c.n}
          </span>
        ))}
      </div>
    </div>
  );
}
