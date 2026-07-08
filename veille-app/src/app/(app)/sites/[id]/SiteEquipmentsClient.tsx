"use client";

import { useMemo, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import {
  PHONE_CATEGORY,
  S6A7_MATERIEL_CATEGORIES,
  type ItemKind,
} from "@/lib/s6a7";

type Domain = "VEILLE_SITE" | "S6A7";

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

const DOMAIN_TABS: { value: Domain; label: string }[] = [
  { value: "VEILLE_SITE", label: "Veille de site" },
  { value: "S6A7", label: "S6A7" },
];

/**
 * Onglet « Équipements » sur la fiche site — point d'entrée unique pour les
 * deux référentiels (même table SiteEquipment, distingués par `domain`) :
 *  - Veille de site : catalogue classique (trousses, extincteurs, affichages…).
 *  - S6A7 : téléphones de voie + petit matériel.
 *
 * USER : lecture seule. ADMIN/EDITOR : ajout/édition/suppression, import CSV
 * (veille de site uniquement).
 */
export default function SiteEquipmentsClient({
  siteId,
  siteName,
  initial,
  canEdit,
}: {
  siteId: string;
  siteName: string;
  initial: Equipment[];
  canEdit: boolean;
}) {
  const [domain, setDomain] = useState<Domain>("VEILLE_SITE");
  // Cache par domaine : VEILLE_SITE pré-chargé (SSR), S6A7 chargé à la demande.
  const [cache, setCache] = useState<Record<Domain, Equipment[] | null>>({
    VEILLE_SITE: initial,
    S6A7: null,
  });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = cache[domain] ?? [];

  async function switchDomain(next: Domain) {
    setDomain(next);
    setError(null);
    if (cache[next] !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/equipment?domain=${next}`);
      if (!res.ok) throw new Error("Chargement impossible");
      const data: Equipment[] = await res.json();
      setCache((c) => ({ ...c, [next]: data }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function setDomainList(updater: (arr: Equipment[]) => Equipment[]) {
    setCache((c) => ({ ...c, [domain]: updater(c[domain] ?? []) }));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const e of list) {
      const arr = map.get(e.category) ?? [];
      arr.push(e);
      map.set(e.category, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [list]);

  // Catégories existantes — alimente l'autocomplete des modales (veille de site).
  const categories = useMemo(
    () => [...new Set(list.map((e) => e.category))].sort(),
    [list],
  );

  async function saveCreate(payload: Partial<Equipment>) {
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, domain }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
      return;
    }
    const created = await res.json();
    setDomainList((arr) => [...arr, created]);
    setCreating(false);
  }

  async function saveEdit(eqId: string, payload: Partial<Equipment>) {
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/equipment/${eqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erreur");
      return;
    }
    const updated = await res.json();
    setDomainList((arr) => arr.map((x) => (x.id === eqId ? updated : x)));
    setEditing(null);
  }

  async function hardDelete(e: Equipment) {
    const ok = confirm(
      `Supprimer « ${e.label} » du catalogue ?\n\n` +
        `Les observations historiques perdront leur lien (mais resteront ` +
        `visibles dans le rapport de visite). Préfère la désactivation si ` +
        `tu n'es pas sûr.`,
    );
    if (!ok) return;
    const res = await fetch(
      `/api/sites/${siteId}/equipment/${e.id}?mode=hard`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setDomainList((arr) => arr.filter((x) => x.id !== e.id));
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Suppression refusée");
    }
  }

  const addLabel = domain === "S6A7" ? "Ajouter un élément S6A7" : "Ajouter";

  return (
    <section className="lg:col-span-2">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Icon.ClipboardCheck className="w-4 h-4 text-emerald-600" />
          Équipements attendus
          <span className="text-[11px] font-mono text-slate-400">
            {list.length}
          </span>
        </h2>
        {canEdit && (
          <div className="flex gap-2">
            {domain === "VEILLE_SITE" && (
              <button
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-lg"
              >
                <Icon.Upload className="w-3.5 h-3.5" /> Importer CSV
              </button>
            )}
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg"
            >
              <Icon.Plus className="w-3.5 h-3.5" /> {addLabel}
            </button>
          </div>
        )}
      </div>

      {/* Sélecteur de domaine — un seul endroit pour les deux référentiels. */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 mb-3">
        {DOMAIN_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => switchDomain(t.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              domain === t.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card px-4 py-6 text-center text-xs text-slate-500">
          Chargement…
        </div>
      ) : grouped.length === 0 ? (
        <div className="card px-4 py-6 text-center text-xs text-slate-500">
          {domain === "S6A7"
            ? "Aucun élément S6A7 défini."
            : "Aucun équipement défini."}
          {canEdit && ` Clique « ${addLabel} ».`}
        </div>
      ) : (
        <div className="grid gap-3">
          {grouped.map(([cat, items]) => (
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
                  <EquipmentRow
                    key={e.id}
                    eq={e}
                    canEdit={canEdit}
                    onEdit={() => setEditing(e)}
                    onDelete={() => hardDelete(e)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <EquipmentModal
          domain={domain}
          initial={null}
          categories={categories}
          onCancel={() => setCreating(false)}
          onSave={(p) => saveCreate(p)}
        />
      )}
      {editing && (
        <EquipmentModal
          domain={domain}
          initial={editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSave={(p) => saveEdit(editing.id, p)}
        />
      )}
      {importing && (
        <ImportModal
          siteId={siteId}
          siteName={siteName}
          onCancel={() => setImporting(false)}
          onDone={(newList) => {
            setCache((c) => ({ ...c, VEILLE_SITE: newList }));
            setImporting(false);
          }}
        />
      )}
    </section>
  );
}

/* ============================================================================
 *  Ligne d'équipement
 * ========================================================================== */

function EquipmentRow({
  eq,
  canEdit,
  onEdit,
  onDelete,
}: {
  eq: Equipment;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Badge péremption : 🔴 si déjà périmé, 🟡 si <30 jours, sinon discret.
  const exp = eq.expirationDate ? new Date(eq.expirationDate) : null;
  const daysUntil = exp ? differenceInDays(exp, new Date()) : null;
  const isPhone = eq.itemKind === "PHONE";
  return (
    <li className="px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50/60">
      {isPhone && (
        <Icon.Phone className="w-4 h-4 text-slate-300 shrink-0" />
      )}
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
              {exp ? (
                <>
                  Péremption {format(exp, "P", { locale: fr })}
                  {daysUntil != null && daysUntil < 0 && " (périmé)"}
                  {daysUntil != null &&
                    daysUntil >= 0 &&
                    daysUntil < 30 &&
                    ` (j-${daysUntil})`}
                </>
              ) : (
                "Périssable (date à compléter)"
              )}
            </span>
          )}
          {eq.notes && (
            <span className="italic text-slate-600 truncate max-w-[280px]">
              « {eq.notes} »
            </span>
          )}
        </div>
      </div>
      {canEdit && (
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
      )}
    </li>
  );
}

/* ============================================================================
 *  Modale add/édit équipement — adaptée au domaine actif.
 *   - Veille de site : libellé + catégorie libre + qté + péremption + notes.
 *   - S6A7 : choix téléphone / petit matériel.
 *       · Téléphone      → libellé + notes (catégorie figée, sans action).
 *       · Petit matériel → libellé + type (2 catégories) + qté + péremption.
 * ========================================================================== */

function EquipmentModal({
  domain,
  initial,
  categories,
  onCancel,
  onSave,
}: {
  domain: Domain;
  initial: Equipment | null;
  categories: string[];
  onCancel: () => void;
  onSave: (payload: Partial<Equipment>) => void;
}) {
  const isS6A7 = domain === "S6A7";
  const [itemKind, setItemKind] = useState<ItemKind>(
    initial?.itemKind ?? "MATERIEL",
  );
  const isPhone = isS6A7 && itemKind === "PHONE";

  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(
    initial?.category ??
      (isS6A7 ? S6A7_MATERIEL_CATEGORIES[0] : ""),
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

  // Veille de site : catégorie obligatoire. S6A7 : gérée par le type.
  const valid =
    label.trim().length > 0 && (isS6A7 || category.trim().length > 0);

  const matchedCategories = useMemo(() => {
    const q = category.trim().toLowerCase();
    if (!q) return categories.slice(0, 8);
    return categories.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [category, categories]);

  function submit() {
    if (!valid) return;
    if (isPhone) {
      onSave({
        label: label.trim(),
        category: PHONE_CATEGORY,
        itemKind: "PHONE",
        expectedQuantity: null,
        isPerishable: false,
        expirationDate: null,
        notes: notes.trim() || null,
      });
      return;
    }
    onSave({
      label: label.trim(),
      category: category.trim(),
      itemKind: "MATERIEL",
      expectedQuantity: expectedQuantity ? Number(expectedQuantity) : null,
      isPerishable,
      expirationDate:
        isPerishable && expirationDate
          ? new Date(expirationDate + "T00:00:00").toISOString()
          : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">
            {initial ? "Modifier" : "Ajouter"}
            {isS6A7 ? " — S6A7" : ""}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 space-y-3">
          {/* S6A7 : choix de la famille (verrouillé en édition). */}
          {isS6A7 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Famille
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["PHONE", "MATERIEL"] as ItemKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={!!initial}
                    onClick={() => setItemKind(k)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
                      itemKind === k
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {k === "PHONE" ? "Téléphone de voie" : "Petit matériel"}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  : "Ex. Extincteur N°1, Pansement compressif 10×12"
              }
              className="w-full border-2 border-indigo-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
              autoFocus
            />
          </div>

          {/* Catégorie : masquée pour un téléphone (figée). */}
          {!isPhone && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isS6A7 ? "Type de matériel" : "Catégorie"}{" "}
                {!isS6A7 && <span className="text-rose-600">*</span>}
              </label>
              {isS6A7 ? (
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
              ) : (
                <>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Trousse de secours, Extincteurs, Affichage…"
                    list="equipment-categories"
                    className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <datalist id="equipment-categories">
                    {matchedCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          )}

          {/* Qté + péremption : pas pour un téléphone. */}
          {!isPhone && (
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
                  {isS6A7 ? "Date de péremption" : "Périssable (a une date)"}
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
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Emplacement précis, référence fournisseur, particularité…"
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none min-h-[60px] resize-y"
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

/* ============================================================================
 *  Modale import CSV (veille de site uniquement)
 * ========================================================================== */

function ImportModal({
  siteId,
  siteName,
  onCancel,
  onDone,
}: {
  siteId: string;
  siteName: string;
  onCancel: () => void;
  onDone: (newList: Equipment[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    received: number;
    matchedSite: number;
    created: number;
    updated: number;
    skippedOtherSite: number;
    errors: string[];
  } | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState(siteName);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    setFilename(f.name);
    try {
      const csv = await f.text();
      const res = await fetch(`/api/sites/${siteId}/equipment/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, siteFilter }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Échec de l'import");
        return;
      }
      setReport(j);
      // Recharge la liste veille de site à jour.
      const fresh = await fetch(
        `/api/sites/${siteId}/equipment?domain=VEILLE_SITE`,
      ).then((r) => r.json());
      onDone(fresh);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-40"
        onClick={() => !busy && onCancel()}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">Import CSV — Équipements</h3>
          <button
            onClick={onCancel}
            disabled={busy}
            className="ml-auto text-slate-400 hover:text-slate-700 disabled:opacity-30"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Filtre Localisation (CSV)
            </label>
            <input
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Seules les lignes dont la colonne « Localisation » correspond
              seront importées. Vide = toutes les lignes.
            </div>
          </div>
          <label className="block border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
            <Icon.Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
            <div className="text-sm font-semibold">
              {filename ?? "Cliquez pour sélectionner le CSV"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Colonnes attendues : Titre, Localisation, TypeEquipement,
              Perissable, DateFin, Quantite, Commentaire
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {busy && (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
              Import en cours…
            </div>
          )}
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Lignes" value={report.received} />
              <Stat
                label="Pour ce site"
                value={report.matchedSite}
                color="text-indigo-700"
              />
              <Stat
                label="Créés"
                value={report.created}
                color="text-emerald-700"
              />
              <Stat label="MAJ" value={report.updated} color="text-amber-700" />
            </div>
          )}
          {report && report.skippedOtherSite > 0 && (
            <div className="text-[11px] text-slate-500">
              {report.skippedOtherSite} ligne(s) ignorée(s) (autre site).
            </div>
          )}
          {report && report.errors.length > 0 && (
            <details className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <summary className="text-xs font-semibold text-rose-800 cursor-pointer">
                Erreurs ({report.errors.length})
              </summary>
              <ul className="text-[11px] mt-2 space-y-0.5 max-h-48 overflow-auto font-mono text-rose-800">
                {report.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
          >
            Fermer
          </button>
        </footer>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  color = "text-slate-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </div>
    </div>
  );
}
