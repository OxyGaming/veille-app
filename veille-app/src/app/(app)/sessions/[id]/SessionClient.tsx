"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import AgentAutocomplete from "@/components/AgentAutocomplete";

type ChecklistItem = {
  id: string;
  label: string;
  gravity: number | null;
  requireCommentIfKO: boolean;
  requirePhotoIfKO: boolean;
};
type ObservationItem = {
  id: string;
  status: string;
  comment: string | null;
  checklistItem: ChecklistItem;
  photos: { id: string; storagePath: string; legend: string | null }[];
};
type ProcedureObservation = {
  id: string;
  generalComment: string | null;
  procedure: {
    id: string;
    title: string;
    domain: string;
    theme: string | null;
    gravity: number;
    risk: string | null;
    documents: string;
  };
  items: ObservationItem[];
};
type Session = {
  id: string;
  status: string;
  generalComment: string | null;
  startedAt: string;
  agent: {
    id: string;
    lastName: string;
    firstName: string;
    matricule: string;
  } | null;
  observer: { id: string; name: string };
  procedures: ProcedureObservation[];
};

const STATUS = [
  { v: "CONFORME", label: "Conforme", short: "C", color: "bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  { v: "NON_CONFORME", label: "Non conforme", short: "NC", color: "bg-rose-600 text-white border-rose-600", dot: "bg-rose-500" },
  { v: "A_REVOIR", label: "À revoir", short: "AR", color: "bg-amber-500 text-white border-amber-500", dot: "bg-amber-400" },
  { v: "NON_APPLICABLE", label: "Non applicable", short: "NA", color: "bg-slate-500 text-white border-slate-500", dot: "bg-slate-400" },
  { v: "NON_OBSERVE", label: "Non observé", short: "?", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-300" },
];

export default function SessionClient({
  session: initial,
  agents,
}: {
  session: Session;
  agents: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [generalOpen, setGeneralOpen] = useState(false);

  const { done, total, ko } = useMemo(() => {
    let done = 0,
      total = 0,
      ko = 0;
    for (const po of session.procedures) {
      for (const obs of po.items) {
        total++;
        if (obs.status !== "NON_OBSERVE") done++;
        if (obs.status === "NON_CONFORME" || obs.status === "A_REVOIR") ko++;
      }
    }
    return { done, total, ko };
  }, [session]);

  const completed =
    session.status === "completed" || session.status === "archived";
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function setStatus(obs: ObservationItem, status: string) {
    if (completed) return;
    setSaving(obs.id);
    try {
      const res = await fetch(`/api/observations/${obs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Erreur lors de l'enregistrement.");
        return;
      }
      const updated = await res.json();
      patchObservation(obs.id, updated);
    } finally {
      setSaving(null);
    }
  }

  async function setComment(obs: ObservationItem, comment: string) {
    if (completed) return;
    const res = await fetch(`/api/observations/${obs.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    if (res.ok) {
      const updated = await res.json();
      patchObservation(obs.id, updated);
    }
  }

  function patchObservation(id: string, updated: Partial<ObservationItem>) {
    setSession((s) => ({
      ...s,
      procedures: s.procedures.map((po) => ({
        ...po,
        items: po.items.map((it) =>
          it.id === id
            ? {
                ...it,
                status: updated.status ?? it.status,
                comment:
                  updated.comment === undefined ? it.comment : updated.comment,
              }
            : it
        ),
      })),
    }));
  }

  async function setAgent(agentId: string | null) {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    if (!res.ok) return;
    // Refetch pour récupérer l'agent peuplé (firstName/lastName/matricule)
    // et synchroniser le useState local. router.refresh() seul ne remplace
    // pas le state d'un Client Component qui a déjà été monté.
    const updated = await fetch(`/api/sessions/${session.id}`).then((r) =>
      r.json()
    );
    if (updated?.id) setSession(updated);
    router.refresh();
  }

  async function setGeneralComment(value: string) {
    setSession((s) => ({ ...s, generalComment: value }));
    await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalComment: value }),
    });
  }

  async function finishSession() {
    if (!confirm("Clôturer la session ? Les saisies seront verrouillées.")) return;
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) router.push(`/sessions/${session.id}/report`);
  }

  return (
    <div className="pb-32">
      {/* Header session */}
      <header className="sticky top-0 lg:top-0 z-20 bg-white border-b border-slate-200 no-print">
        <div className="px-4 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900 p-1.5 -ml-1.5 rounded-md hover:bg-slate-100"
            aria-label="Retour"
          >
            <Icon.ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  session.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : session.status === "active"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {session.status.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500">
                {ko > 0 && (
                  <span className="text-rose-700 font-semibold">
                    {ko} point(s) à corriger
                  </span>
                )}
              </span>
            </div>
            <div className="text-sm font-bold mt-0.5 truncate">
              {session.agent
                ? `${session.agent.firstName} ${session.agent.lastName} · ${session.agent.matricule}`
                : "Aucun agent sélectionné"}
            </div>
          </div>
          {!completed && session.agent && (
            <button
              onClick={finishSession}
              className="hidden md:inline-flex btn btn-primary"
            >
              <Icon.Check className="w-4 h-4" /> Clôturer
            </button>
          )}
        </div>
        {/* Progress bar */}
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
        {/* Sélection agent obligatoire : tant qu'aucun agent n'est choisi,
            on bloque la saisie et on n'affiche que l'autocomplete. */}
        {!session.agent && !completed ? (
          <div className="max-w-xl mx-auto py-6">
            <div className="card p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-amber-100 grid place-items-center shrink-0">
                  <Icon.User className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-base font-bold">
                    Sélectionner l&apos;agent veillé
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    Cette session porte sur un agent précis. Choisissez-le
                    pour démarrer la saisie des observations.
                  </div>
                </div>
              </div>
              <AgentAutocomplete
                agents={agents}
                value={session.agent ? (session.agent as { id: string }).id : null}
                onChange={(id) => setAgent(id)}
                autoFocus
              />
              <div className="mt-3 text-[11px] text-slate-400">
                {agents.length} agent(s) disponible(s) dans votre équipe.
              </div>
            </div>
          </div>
        ) : null}

        {/* Procédures — visibles uniquement après sélection de l'agent
            (ou si session déjà clôturée pour la consultation). */}
        {(session.agent || completed) && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
              {session.procedures.map((po) => (
                <ProcedureCard
                  key={po.id}
                  po={po}
                  disabled={completed}
                  onSetStatus={setStatus}
                  onSetComment={setComment}
                  saving={saving}
                />
              ))}
            </div>

            {/* Commentaire général */}
            <section className="card mt-4 overflow-hidden">
          <button
            onClick={() => setGeneralOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200"
          >
            <Icon.MessageSquare className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-sm flex-1 text-left">
              Commentaire général
            </span>
            <span className="text-slate-400 text-xs">
              {generalOpen ? "▴" : "▾"}
            </span>
          </button>
          {generalOpen && (
            <textarea
              disabled={completed}
              placeholder="Synthèse, points marquants, contexte de la veille…"
              value={session.generalComment ?? ""}
              onChange={(e) =>
                setSession((s) => ({ ...s, generalComment: e.target.value }))
              }
              onBlur={(e) => setGeneralComment(e.target.value)}
              className="w-full px-4 py-3 text-sm resize-y min-h-[120px] focus:outline-none"
            />
          )}
        </section>
          </>
        )}
      </div>

      {/* CTA flottant mobile — masqué tant que pas d'agent */}
      {!completed && session.agent && (
        <div className="lg:hidden fixed bottom-[76px] left-4 right-4 z-30 no-print">
          <button
            onClick={finishSession}
            className="btn btn-primary w-full justify-center"
          >
            <Icon.Check className="w-4 h-4" /> Clôturer la session
          </button>
        </div>
      )}

      {completed && (
        <div className="fixed bottom-[76px] lg:bottom-6 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-30 no-print">
          <button
            onClick={() => router.push(`/sessions/${session.id}/report`)}
            className="btn btn-primary w-full lg:w-auto justify-center"
          >
            <Icon.FileText className="w-4 h-4" /> Voir le compte rendu
          </button>
        </div>
      )}
    </div>
  );
}

function ProcedureCard({
  po,
  disabled,
  onSetStatus,
  onSetComment,
  saving,
}: {
  po: ProcedureObservation;
  disabled: boolean;
  onSetStatus: (obs: ObservationItem, s: string) => void;
  onSetComment: (obs: ObservationItem, c: string) => void;
  saving: string | null;
}) {
  const done = po.items.filter((i) => i.status !== "NON_OBSERVE").length;
  const ncCount = po.items.filter(
    (i) => i.status === "NON_CONFORME" || i.status === "A_REVOIR"
  ).length;
  return (
    <article className="card overflow-hidden break-inside-avoid">
      <div
        className="h-1"
        style={{
          background:
            po.procedure.gravity === 4
              ? "var(--g4)"
              : po.procedure.gravity === 3
              ? "var(--g3)"
              : po.procedure.gravity === 2
              ? "var(--g2)"
              : "var(--g0)",
        }}
      />
      <header className="px-4 pt-3 pb-2.5">
        <div className="text-[10px] font-mono tracking-wider uppercase text-slate-500 font-semibold">
          {po.procedure.domain}
          {po.procedure.theme && ` · ${po.procedure.theme}`}
        </div>
        <h3 className="text-sm font-bold leading-tight mt-0.5 flex items-start gap-2">
          <span className="flex-1">{po.procedure.title}</span>
          <span className={`gpill g${po.procedure.gravity}`}>
            {po.procedure.gravity === 0 ? "NT" : `G${po.procedure.gravity}`}
          </span>
        </h3>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono">
          <span>{done}/{po.items.length}</span>
          {ncCount > 0 && (
            <span className="text-rose-700 font-semibold">
              · {ncCount} à corriger
            </span>
          )}
        </div>
        {po.procedure.risk && (
          <div className="text-[11px] mt-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
            <Icon.AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <div>
              <b>Risque :</b> {po.procedure.risk}
            </div>
          </div>
        )}
      </header>
      <ul>
        {po.items.map((obs) => (
          <ItemRow
            key={obs.id}
            obs={obs}
            disabled={disabled}
            onSetStatus={onSetStatus}
            onSetComment={onSetComment}
            saving={saving === obs.id}
          />
        ))}
      </ul>
    </article>
  );
}

function ItemRow({
  obs,
  disabled,
  onSetStatus,
  onSetComment,
  saving,
}: {
  obs: ObservationItem;
  disabled: boolean;
  onSetStatus: (obs: ObservationItem, s: string) => void;
  onSetComment: (obs: ObservationItem, c: string) => void;
  saving: boolean;
}) {
  const isKO = obs.status === "NON_CONFORME" || obs.status === "A_REVOIR";
  const [commentOpen, setCommentOpen] = useState(!!obs.comment || isKO);
  const [local, setLocal] = useState(obs.comment ?? "");
  const cur = STATUS.find((s) => s.v === obs.status) ?? STATUS[4];

  function handleStatusClick(status: string) {
    // NC ou À revoir → ouvre directement le volet commentaire.
    if (status === "NON_CONFORME" || status === "A_REVOIR") {
      setCommentOpen(true);
    }
    onSetStatus(obs, status);
  }

  return (
    <li
      className={`border-t border-slate-100 px-4 py-2.5 ${
        isKO ? "bg-rose-50/30" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          disabled={disabled}
          onClick={() => setCommentOpen((v) => !v)}
          className="text-slate-400 hover:text-slate-700 mt-0.5"
          title="Commentaire"
        >
          <Icon.MessageSquare className="w-4 h-4" />
        </button>
        <div className="flex-1 text-sm leading-snug">
          {obs.checklistItem.label}
          {obs.checklistItem.gravity != null && (
            <span className={`gpill g${obs.checklistItem.gravity} ml-2`}>
              G{obs.checklistItem.gravity}
            </span>
          )}
        </div>
        <div
          className={`shrink-0 w-9 h-7 rounded-md flex items-center justify-center text-xs font-bold border ${cur.color}`}
          title={cur.label}
        >
          {saving ? "…" : cur.short}
        </div>
      </div>
      {!disabled && (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {STATUS.filter((s) => s.v !== "NON_OBSERVE").map((s) => (
            <button
              key={s.v}
              onClick={() => handleStatusClick(s.v)}
              title={s.label}
              className={`text-[11px] font-medium px-2 py-1 rounded-md border text-center transition-colors ${
                obs.status === s.v
                  ? s.color
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {commentOpen && (
        <div className="mt-2 animate-in">
          <textarea
            disabled={disabled}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              if (local !== (obs.comment ?? "")) onSetComment(obs, local);
            }}
            placeholder="Commentaire (optionnel)…"
            className="input min-h-[72px] resize-y"
          />
          <PhotoControls
            observationId={obs.id}
            photos={obs.photos}
            disabled={disabled}
          />
        </div>
      )}
    </li>
  );
}

function PhotoControls({
  observationId,
  photos: initial,
  disabled,
}: {
  observationId: string;
  photos: { id: string; storagePath: string; legend: string | null }[];
  disabled: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { default: imageCompression } = await import(
        "browser-image-compression"
      );
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const fd = new FormData();
      fd.append("file", compressed, file.name);
      fd.append("observationId", observationId);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (res.ok) {
        const p = await res.json();
        setPhotos((ps) => [...ps, p]);
      } else {
        alert("Échec de l'upload");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {photos.map((p) => (
          <div
            key={p.id}
            className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.storagePath}
              alt={p.legend ?? ""}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {!disabled && (
          <>
            <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 flex flex-col items-center justify-center text-slate-500 text-[10px] cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
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
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Icon.ImagePlus className="w-5 h-5 mb-1" />
              Galerie
            </label>
          </>
        )}
      </div>
      {uploading && (
        <div className="text-[11px] text-slate-500 mt-1">
          Compression et envoi…
        </div>
      )}
    </div>
  );
}
