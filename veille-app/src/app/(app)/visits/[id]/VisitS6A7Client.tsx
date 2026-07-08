"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import {
  PHONE_STATUSES,
  PHONE_STATUS_LABEL,
  isPhoneOk,
  type PhoneStatus,
} from "@/lib/s6a7";

type Equipment = {
  id: string;
  label: string;
  category: string;
  itemKind: "MATERIEL" | "PHONE";
  expectedQuantity: number | null;
  isPerishable: boolean;
  expirationDate: string | null;
};
type Observation = {
  id: string;
  equipmentId: string | null;
  present: boolean | null;
  quantityObserved: number | null;
  expirationDateObserved: string | null;
  discrepancyType: string | null;
  comment: string | null;
  status: string;
  phoneStatus: string | null;
};
type Visit = {
  id: string;
  status: string;
  visitDate: string;
  generalComment: string | null;
  template: { name: string; kind: string };
  site: { name: string; code: string | null };
  observer: { id: string; name: string };
  observations: Observation[];
};

const DISCREPANCY_LABEL: Record<string, string> = {
  MISSING: "Manquant",
  EXPIRED: "Périmé",
  QUANTITY_LOW: "Quantité insuffisante",
  DAMAGED: "Détérioré",
};
const DISCREPANCY_COLOR: Record<string, string> = {
  MISSING: "bg-rose-100 text-rose-800 border-rose-300",
  EXPIRED: "bg-amber-100 text-amber-800 border-amber-300",
  QUANTITY_LOW: "bg-orange-100 text-orange-800 border-orange-300",
  DAMAGED: "bg-violet-100 text-violet-800 border-violet-300",
};

const PHONE_STATUS_COLOR: Record<PhoneStatus, string> = {
  BON: "bg-emerald-500 border-emerald-500 text-white",
  HS: "bg-rose-500 border-rose-500 text-white",
  DIFF_RECEPTION: "bg-amber-500 border-amber-500 text-white",
  DIFF_EMISSION: "bg-orange-500 border-orange-500 text-white",
};

/**
 * Rendu d'une visite S6A7.
 *
 *  - Deux familles issues du référentiel S6A7 du site.
 *  - Téléphones de voie : statut à 4 états + commentaire, AUCUNE action générée.
 *  - Petit matériel : logique trousse de secours (écarts → actions à la clôture).
 */
export default function VisitS6A7Client({
  visit: initial,
  equipments,
}: {
  visit: Visit;
  equipments: Equipment[];
}) {
  const router = useRouter();
  const [visit, setVisit] = useState<Visit>(initial);
  const [opening, setOpening] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const completed =
    visit.status === "completed" || visit.status === "archived";

  const obsByEq = useMemo(() => {
    const m = new Map<string, Observation>();
    for (const o of visit.observations) {
      if (o.equipmentId) m.set(o.equipmentId, o);
    }
    return m;
  }, [visit.observations]);

  const phones = useMemo(
    () => equipments.filter((e) => e.itemKind === "PHONE"),
    [equipments],
  );
  const materiels = useMemo(
    () => equipments.filter((e) => e.itemKind === "MATERIEL"),
    [equipments],
  );

  const materielGrouped = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const eq of materiels) {
      const arr = map.get(eq.category) ?? [];
      arr.push(eq);
      map.set(eq.category, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [materiels]);

  const counts = useMemo(() => {
    let phoneOk = 0;
    let phoneKo = 0;
    for (const p of phones) {
      const o = obsByEq.get(p.id);
      if (isPhoneOk(o?.phoneStatus)) phoneOk++;
      else phoneKo++;
    }
    let matConform = 0;
    let matEcart = 0;
    for (const eq of materiels) {
      const o = obsByEq.get(eq.id);
      if (o?.discrepancyType) matEcart++;
      else matConform++;
    }
    return { phoneOk, phoneKo, matConform, matEcart };
  }, [phones, materiels, obsByEq]);

  function patchObs(obsId: string, patch: Partial<Observation>) {
    setVisit((v) => ({
      ...v,
      observations: v.observations.map((o) =>
        o.id === obsId ? { ...o, ...patch } : o,
      ),
    }));
  }

  async function saveObs(obsId: string, payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/visits/${visit.id}/observations/${obsId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        patchObs(obsId, {
          present: updated.present,
          quantityObserved: updated.quantityObserved,
          expirationDateObserved: updated.expirationDateObserved,
          discrepancyType: updated.discrepancyType,
          comment: updated.comment,
          status: updated.status,
          phoneStatus: updated.phoneStatus,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function setPhoneStatus(eq: Equipment, status: PhoneStatus) {
    if (completed) return;
    const o = obsByEq.get(eq.id);
    if (!o) return;
    await saveObs(o.id, { phoneStatus: status });
  }

  async function saveComment(eq: Equipment, comment: string) {
    if (completed) return;
    const o = obsByEq.get(eq.id);
    if (!o || comment === (o.comment ?? "")) return;
    await saveObs(o.id, { comment });
  }

  async function setDiscrepancy(
    eq: Equipment,
    type: string | null,
    extras?: {
      comment?: string;
      quantityObserved?: number | null;
      expirationDateObserved?: string | null;
    },
  ) {
    if (completed) return;
    const o = obsByEq.get(eq.id);
    if (!o) return;
    const payload: Record<string, unknown> = {
      discrepancyType: type ?? "NONE",
    };
    if (extras?.comment !== undefined) payload.comment = extras.comment;
    if (extras?.quantityObserved !== undefined)
      payload.quantityObserved = extras.quantityObserved;
    if (extras?.expirationDateObserved !== undefined) {
      payload.expirationDateObserved = extras.expirationDateObserved
        ? new Date(extras.expirationDateObserved + "T00:00:00").toISOString()
        : null;
    }
    if (type === "MISSING") payload.present = false;
    else if (type !== null) payload.present = true;
    await saveObs(o.id, payload);
  }

  async function finishVisit() {
    if (
      !confirm(
        "Clôturer la visite ? Les écarts sur le petit matériel seront convertis en actions correctives. Les téléphones ne génèrent aucune action.",
      )
    )
      return;
    const res = await fetch(`/api/visits/${visit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      router.push(`/visits/${visit.id}/report`);
      router.refresh();
    }
  }

  return (
    <div className="pb-32">
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
                  completed
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-indigo-50 text-indigo-700"
                }`}
              >
                {visit.status.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono font-semibold uppercase bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                S6A7
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {format(new Date(visit.visitDate), "P", { locale: fr })}
              </span>
            </div>
            <div className="text-sm font-bold mt-0.5 truncate">
              {visit.site.name}
              {visit.site.code && (
                <span className="text-slate-400 font-mono ml-2 text-xs">
                  {visit.site.code}
                </span>
              )}
            </div>
          </div>
          {!completed && (
            <button
              onClick={finishVisit}
              className="hidden md:inline-flex btn btn-primary"
            >
              <Icon.Check className="w-4 h-4" /> Clôturer
            </button>
          )}
        </div>
        <div className="px-4 lg:px-8 pb-3 flex items-center gap-2 text-xs flex-wrap">
          <span className="font-mono text-slate-500">
            {phones.length} téléphone(s)
          </span>
          {counts.phoneKo > 0 && (
            <span className="font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              ⚠ {counts.phoneKo} à signaler
            </span>
          )}
          <span className="font-mono text-slate-300">·</span>
          <span className="font-mono text-slate-500">
            {materiels.length} matériel(s)
          </span>
          {counts.matEcart > 0 && (
            <span className="font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              ⚠ {counts.matEcart} écart(s)
            </span>
          )}
          {saving && (
            <span className="font-mono text-slate-400 ml-auto">
              Enregistrement…
            </span>
          )}
        </div>
      </header>

      <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-3xl mx-auto">
        {/* ── Téléphones de voie ─────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-2 px-1 flex items-center gap-2">
            <Icon.Phone className="w-3.5 h-3.5 text-sky-600" />
            Téléphones de voie
            <span className="text-slate-400 font-normal">· {phones.length}</span>
          </h2>
          {phones.length === 0 ? (
            <div className="card p-4 text-center text-xs text-slate-500">
              Aucun téléphone défini pour ce site. Configure le référentiel dans
              le back-office S6A7.
            </div>
          ) : (
            <ul className="card divide-y divide-slate-100">
              {phones.map((eq) => (
                <PhoneRow
                  key={eq.id}
                  eq={eq}
                  obs={obsByEq.get(eq.id)}
                  disabled={completed}
                  open={opening === eq.id}
                  onToggle={() =>
                    setOpening(opening === eq.id ? null : eq.id)
                  }
                  onStatus={(s) => setPhoneStatus(eq, s)}
                  onComment={(c) => saveComment(eq, c)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── Petit matériel ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-2 px-1 flex items-center gap-2">
            <Icon.ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
            Petit matériel
            <span className="text-slate-400 font-normal">
              · {materiels.length}
            </span>
          </h2>
          {materiels.length === 0 ? (
            <div className="card p-4 text-center text-xs text-slate-500">
              Aucun matériel défini pour ce site.
            </div>
          ) : (
            materielGrouped.map(([cat, eqs]) => (
              <div key={cat} className="mb-4">
                <h3 className="text-[11px] font-mono font-semibold text-slate-500 mb-1.5 px-1">
                  {cat}
                  <span className="ml-2 text-slate-400">· {eqs.length}</span>
                </h3>
                <ul className="card divide-y divide-slate-100">
                  {eqs.map((eq) => (
                    <EquipmentRow
                      key={eq.id}
                      eq={eq}
                      obs={obsByEq.get(eq.id)}
                      disabled={completed}
                      open={opening === eq.id}
                      onToggle={() =>
                        setOpening(opening === eq.id ? null : eq.id)
                      }
                      onSet={(type, extras) => setDiscrepancy(eq, type, extras)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Commentaire général */}
        <section className="card mt-6 p-4">
          <h2 className="text-sm font-bold mb-2">Commentaire général</h2>
          <textarea
            disabled={completed}
            defaultValue={visit.generalComment ?? ""}
            placeholder="Synthèse, points marquants, contexte…"
            onBlur={async (e) => {
              if (e.target.value === (visit.generalComment ?? "")) return;
              await fetch(`/api/visits/${visit.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generalComment: e.target.value }),
              });
              setVisit((v) => ({ ...v, generalComment: e.target.value }));
            }}
            className="w-full px-3 py-2 text-sm resize-y min-h-[80px] border border-slate-200 rounded-lg"
          />
        </section>
      </div>

      {!completed && (
        <div className="lg:hidden fixed bottom-[76px] left-4 right-4 z-30 no-print">
          <button
            onClick={finishVisit}
            className="btn btn-primary w-full justify-center"
          >
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

/* ============================================================================
 *  Ligne téléphone : statut à 4 états + commentaire
 * ========================================================================== */

function PhoneRow({
  eq,
  obs,
  disabled,
  open,
  onToggle,
  onStatus,
  onComment,
}: {
  eq: Equipment;
  obs: Observation | undefined;
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onStatus: (s: PhoneStatus) => void;
  onComment: (c: string) => void;
}) {
  const status = (obs?.phoneStatus as PhoneStatus | null) ?? null;
  const ok = isPhoneOk(status);
  const [comment, setComment] = useState(obs?.comment ?? "");

  return (
    <li className={`px-3 py-2.5 ${!ok ? "bg-rose-50/30" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-full grid place-items-center border-2 ${
            status ? PHONE_STATUS_COLOR[status] : "bg-slate-200 border-slate-200 text-slate-500"
          }`}
          title={status ? PHONE_STATUS_LABEL[status] : "Non renseigné"}
        >
          {ok ? (
            <Icon.Check className="w-3.5 h-3.5" />
          ) : (
            <Icon.AlertTriangle className="w-3.5 h-3.5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">{eq.label}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PHONE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onStatus(s)}
                className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                  status === s
                    ? PHONE_STATUS_COLOR[s] + " border-current"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {PHONE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {obs?.comment && !open && (
            <div className="text-[11px] italic text-slate-600 mt-1 line-clamp-2">
              « {obs.comment} »
            </div>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={onToggle}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 mt-1"
            >
              {open ? "Masquer le commentaire" : "Ajouter un commentaire"}
            </button>
          )}
          {open && !disabled && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => onComment(comment)}
              placeholder="Ex. bonne qualité audio mais l'appel depuis le poste n'aboutit pas"
              className="w-full mt-2 px-3 py-2 text-sm border border-slate-200 rounded-lg min-h-[56px] resize-y"
            />
          )}
        </div>
      </div>
    </li>
  );
}

/* ============================================================================
 *  Ligne matériel + détail écart (identique à la visite INVENTORY)
 * ========================================================================== */

function EquipmentRow({
  eq,
  obs,
  disabled,
  open,
  onToggle,
  onSet,
}: {
  eq: Equipment;
  obs: Observation | undefined;
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onSet: (
    type: string | null,
    extras?: {
      comment?: string;
      quantityObserved?: number | null;
      expirationDateObserved?: string | null;
    },
  ) => void;
}) {
  const dType = obs?.discrepancyType ?? null;
  const isEcart = dType !== null;
  const expDate = obs?.expirationDateObserved
    ? new Date(obs.expirationDateObserved)
    : eq.expirationDate
      ? new Date(eq.expirationDate)
      : null;
  const daysUntil = expDate ? differenceInDays(expDate, new Date()) : null;

  return (
    <li className={`px-3 py-2.5 ${isEcart ? "bg-rose-50/30" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`shrink-0 w-7 h-7 rounded-full grid place-items-center border-2 ${
            isEcart
              ? "bg-rose-500 border-rose-500 text-white"
              : "bg-emerald-500 border-emerald-500 text-white"
          } disabled:opacity-50`}
          title={isEcart ? "Écart" : "Conforme"}
        >
          {isEcart ? (
            <Icon.AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <Icon.Check className="w-3.5 h-3.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="text-left w-full"
          >
            <div className="text-sm font-semibold text-slate-900">
              {eq.label}
            </div>
            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
              {eq.expectedQuantity != null && (
                <span className="font-mono">
                  Qté attendue : {eq.expectedQuantity}
                </span>
              )}
              {eq.isPerishable && expDate && (
                <span
                  className={`font-mono ${
                    daysUntil != null && daysUntil < 0
                      ? "text-rose-700 font-semibold"
                      : daysUntil != null && daysUntil < 30
                        ? "text-amber-700 font-semibold"
                        : "text-slate-500"
                  }`}
                >
                  Péremption {format(expDate, "P", { locale: fr })}
                </span>
              )}
            </div>
          </button>
          {isEcart && (
            <div
              className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                DISCREPANCY_COLOR[dType] ?? "bg-slate-100"
              }`}
            >
              <Icon.AlertTriangle className="w-3 h-3" />
              {DISCREPANCY_LABEL[dType] ?? dType}
            </div>
          )}
          {obs?.comment && (
            <div className="text-[11px] italic text-slate-600 mt-1 line-clamp-2">
              « {obs.comment} »
            </div>
          )}
        </div>
      </div>

      {open && !disabled && (
        <EquipmentDetail eq={eq} obs={obs} onSet={onSet} onClose={onToggle} />
      )}
    </li>
  );
}

function EquipmentDetail({
  eq,
  obs,
  onSet,
  onClose,
}: {
  eq: Equipment;
  obs: Observation | undefined;
  onSet: (
    type: string | null,
    extras?: {
      comment?: string;
      quantityObserved?: number | null;
      expirationDateObserved?: string | null;
    },
  ) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(obs?.comment ?? "");
  const [qty, setQty] = useState<string>(
    obs?.quantityObserved != null ? String(obs.quantityObserved) : "",
  );
  const [exp, setExp] = useState<string>(
    obs?.expirationDateObserved
      ? obs.expirationDateObserved.slice(0, 10)
      : (eq.expirationDate?.slice(0, 10) ?? ""),
  );

  return (
    <div className="mt-3 ml-10 p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Signaler un écart
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
        <DiscrepancyBtn
          type="MISSING"
          current={obs?.discrepancyType ?? null}
          onClick={() => onSet("MISSING")}
        />
        <DiscrepancyBtn
          type="EXPIRED"
          current={obs?.discrepancyType ?? null}
          onClick={() => onSet("EXPIRED", { expirationDateObserved: exp || null })}
        />
        <DiscrepancyBtn
          type="QUANTITY_LOW"
          current={obs?.discrepancyType ?? null}
          onClick={() =>
            onSet("QUANTITY_LOW", { quantityObserved: qty ? Number(qty) : null })
          }
        />
        <DiscrepancyBtn
          type="DAMAGED"
          current={obs?.discrepancyType ?? null}
          onClick={() => onSet("DAMAGED")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            Quantité constatée
          </span>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input"
            placeholder={String(eq.expectedQuantity ?? "")}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            Péremption constatée
          </span>
          <input
            type="date"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            className="input"
          />
        </label>
      </div>

      <label className="block mb-3">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
          Commentaire
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Précision libre…"
          className="input min-h-[60px] resize-y"
        />
      </label>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onSet(obs?.discrepancyType ?? "DAMAGED", {
              comment,
              quantityObserved: qty ? Number(qty) : null,
              expirationDateObserved: exp || null,
            })
          }
          className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg"
        >
          Enregistrer
        </button>
        {obs?.discrepancyType && (
          <button
            onClick={() => onSet(null, { comment: "" })}
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200"
            title="Repasser ce matériel en conforme"
          >
            ✓ Marquer conforme
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-700 ml-auto px-3 py-1.5"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function DiscrepancyBtn({
  type,
  current,
  onClick,
}: {
  type: string;
  current: string | null;
  onClick: () => void;
}) {
  const selected = current === type;
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-medium px-2 py-1 rounded-md border text-center transition-colors ${
        selected
          ? DISCREPANCY_COLOR[type] + " border-current"
          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
      }`}
    >
      {DISCREPANCY_LABEL[type]}
    </button>
  );
}
