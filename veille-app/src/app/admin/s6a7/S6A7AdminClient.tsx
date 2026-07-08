"use client";

import { useEffect, useMemo, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import {
  PHONE_CATEGORY,
  S6A7_MATERIEL_CATEGORIES,
  type ItemKind,
} from "@/lib/s6a7";

type Site = { id: string; name: string; code: string | null };
type Equipment = {
  id: string;
  label: string;
  category: string;
  itemKind: ItemKind;
  domain: string;
  expectedQuantity: number | null;
  isPerishable: boolean;
  expirationDate: string | null;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Paramétrage back-office d'une visite S6A7 : sélection d'un site puis
 * gestion de ses téléphones de voie et de son petit matériel. Toutes les
 * écritures passent par l'API `/api/sites/{id}/equipment` avec `domain=S6A7`.
 */
export default function S6A7AdminClient({ sites }: { sites: Site[] }) {
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? "");
  const [list, setList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<ItemKind | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const site = sites.find((s) => s.id === siteId) ?? null;

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sites/${siteId}/equipment?domain=S6A7`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Chargement impossible"))))
      .then((data: Equipment[]) => {
        if (!cancelled) setList(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const phones = useMemo(
    () => list.filter((e) => e.itemKind === "PHONE"),
    [list],
  );
  const materielByCat = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const e of list) {
      if (e.itemKind !== "MATERIEL") continue;
      const arr = map.get(e.category) ?? [];
      arr.push(e);
      map.set(e.category, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [list]);

  async function saveCreate(payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, domain: "S6A7" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur à la création");
      return;
    }
    const created = await res.json();
    setList((arr) => [...arr, created]);
    setCreating(null);
  }

  async function saveEdit(eqId: string, payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/equipment/${eqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur à l'enregistrement");
      return;
    }
    const updated = await res.json();
    setList((arr) => arr.map((x) => (x.id === eqId ? updated : x)));
    setEditing(null);
  }

  async function remove(e: Equipment) {
    if (
      !confirm(
        `Supprimer « ${e.label} » du référentiel S6A7 de ce site ?\n\n` +
          `Les observations historiques perdront leur lien (mais restent ` +
          `visibles dans les rapports de visite déjà clôturés).`,
      )
    )
      return;
    const res = await fetch(
      `/api/sites/${siteId}/equipment/${e.id}?mode=hard`,
      { method: "DELETE" },
    );
    if (res.ok) setList((arr) => arr.filter((x) => x.id !== e.id));
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Suppression refusée");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 grid place-items-center">
          <Icon.Phone className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Visites S6A7</h1>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Référentiel par site : téléphones de voie à contrôler et petit matériel
        (dispositifs d&apos;attention, matériel divers). Ce paramétrage alimente
        la saisie terrain de la visite S6A7.
      </p>

      {/* Sélecteur de site */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-slate-600">Site :</label>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none min-w-[240px]"
        >
          {sites.length === 0 && <option value="">Aucun site accessible</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.code ? ` (${s.code})` : ""}
            </option>
          ))}
        </select>
        {loading && (
          <span className="text-xs text-slate-400 font-mono">Chargement…</span>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {site && (
        <div className="space-y-6">
          {/* ── Téléphones de voie ─────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Icon.Phone className="w-4 h-4 text-sky-600" />
                Téléphones de voie
                <span className="text-[11px] font-mono text-slate-400">
                  {phones.length}
                </span>
              </h2>
              <button
                onClick={() => setCreating("PHONE")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg"
              >
                <Icon.Plus className="w-3.5 h-3.5" /> Ajouter un téléphone
              </button>
            </div>
            {phones.length === 0 ? (
              <div className="card px-4 py-5 text-center text-xs text-slate-500">
                Aucun téléphone défini pour ce site.
              </div>
            ) : (
              <ul className="card divide-y divide-slate-100">
                {phones.map((e) => (
                  <li
                    key={e.id}
                    className="px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50/60"
                  >
                    <Icon.Phone className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {e.label}
                      </div>
                      {e.notes && (
                        <div className="text-[11px] italic text-slate-500 truncate">
                          « {e.notes} »
                        </div>
                      )}
                    </div>
                    <RowActions
                      onEdit={() => setEditing(e)}
                      onDelete={() => remove(e)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Petit matériel ─────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Icon.ClipboardCheck className="w-4 h-4 text-emerald-600" />
                Petit matériel
                <span className="text-[11px] font-mono text-slate-400">
                  {list.filter((e) => e.itemKind === "MATERIEL").length}
                </span>
              </h2>
              <button
                onClick={() => setCreating("MATERIEL")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg"
              >
                <Icon.Plus className="w-3.5 h-3.5" /> Ajouter du matériel
              </button>
            </div>
            {materielByCat.length === 0 ? (
              <div className="card px-4 py-5 text-center text-xs text-slate-500">
                Aucun matériel défini pour ce site.
              </div>
            ) : (
              <div className="grid gap-3">
                {materielByCat.map(([cat, items]) => (
                  <div key={cat} className="card overflow-hidden">
                    <header className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                        {cat}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">
                        {items.length}
                      </span>
                    </header>
                    <ul className="divide-y divide-slate-100">
                      {items.map((e) => (
                        <MaterielRow
                          key={e.id}
                          eq={e}
                          onEdit={() => setEditing(e)}
                          onDelete={() => remove(e)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {creating && (
        <EquipmentModal
          kind={creating}
          initial={null}
          onCancel={() => setCreating(null)}
          onSave={saveCreate}
        />
      )}
      {editing && (
        <EquipmentModal
          kind={editing.itemKind}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => saveEdit(editing.id, p)}
        />
      )}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="shrink-0 flex items-center gap-1">
      <button
        onClick={onEdit}
        className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
      >
        Modifier
      </button>
      <button
        onClick={onDelete}
        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
        title="Supprimer"
      >
        <Icon.Trash className="w-4 h-4" />
      </button>
    </div>
  );
}

function MaterielRow({
  eq,
  onEdit,
  onDelete,
}: {
  eq: Equipment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const exp = eq.expirationDate ? new Date(eq.expirationDate) : null;
  const daysUntil = exp ? differenceInDays(exp, new Date()) : null;
  return (
    <li className="px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50/60">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {eq.label}
        </div>
        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {eq.expectedQuantity != null && (
            <span className="font-mono">Qté : {eq.expectedQuantity}</span>
          )}
          {eq.isPerishable && (
            <span
              className={`font-mono inline-flex items-center gap-1 ${
                daysUntil != null && daysUntil < 0
                  ? "text-rose-700 font-semibold"
                  : daysUntil != null && daysUntil < 30
                    ? "text-amber-700 font-semibold"
                    : "text-slate-500"
              }`}
            >
              <Icon.AlertTriangle className="w-3 h-3" />
              {exp
                ? `Péremption ${format(exp, "P", { locale: fr })}`
                : "Périssable (date à compléter)"}
            </span>
          )}
          {eq.notes && (
            <span className="italic text-slate-600 truncate max-w-[240px]">
              « {eq.notes} »
            </span>
          )}
        </div>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

/* ============================================================================
 *  Modale add/édit — variante selon la famille (téléphone vs matériel)
 * ========================================================================== */

function EquipmentModal({
  kind,
  initial,
  onCancel,
  onSave,
}: {
  kind: ItemKind;
  initial: Equipment | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const isPhone = kind === "PHONE";
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? (isPhone ? PHONE_CATEGORY : S6A7_MATERIEL_CATEGORIES[0]),
  );
  const [expectedQuantity, setExpectedQuantity] = useState<string>(
    initial?.expectedQuantity != null ? String(initial.expectedQuantity) : "",
  );
  const [isPerishable, setIsPerishable] = useState(
    initial?.isPerishable ?? false,
  );
  const [expirationDate, setExpirationDate] = useState(
    initial?.expirationDate?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const valid = label.trim().length > 0;

  function submit() {
    if (!valid) return;
    const base: Record<string, unknown> = {
      label: label.trim(),
      itemKind: kind,
      notes: notes.trim() || null,
    };
    if (isPhone) {
      onSave({
        ...base,
        category: PHONE_CATEGORY,
        expectedQuantity: null,
        isPerishable: false,
        expirationDate: null,
      });
    } else {
      onSave({
        ...base,
        category,
        expectedQuantity: expectedQuantity ? Number(expectedQuantity) : null,
        isPerishable,
        expirationDate:
          isPerishable && expirationDate
            ? new Date(expirationDate + "T00:00:00").toISOString()
            : null,
      });
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">
            {initial ? "Modifier" : "Ajouter"} —{" "}
            {isPhone ? "Téléphone de voie" : "Petit matériel"}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Libellé <span className="text-rose-600">*</span>
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                isPhone
                  ? "Ex. C9, Cv54, Transmetteur X7, Poste B"
                  : "Ex. Jalons d'arrêt lumineux, Cadenas T2"
              }
              className="w-full border-2 border-indigo-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
              autoFocus
            />
          </div>

          {!isPhone && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type de matériel
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {S6A7_MATERIEL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantité attendue
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={expectedQuantity}
                    onChange={(e) => setExpectedQuantity(e.target.value)}
                    placeholder="(vide = non quantifiable)"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1 mt-2">
                    <input
                      type="checkbox"
                      checked={isPerishable}
                      onChange={(e) => setIsPerishable(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    Date de péremption
                  </label>
                  {isPerishable && (
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none mt-1"
                    />
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Emplacement, particularité…"
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none min-h-[56px] resize-y"
            />
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {initial ? "Enregistrer" : "Créer"}
          </button>
        </footer>
      </div>
    </>
  );
}
