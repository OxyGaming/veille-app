"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";

type LinkItem = {
  id: string;
  categoryId: string;
  label: string;
  url: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
};
type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  links: LinkItem[];
};

/** Catalogue d'icônes proposées dans le sélecteur de thématique. */
const ICON_CATALOG: { slug: string; label: string; Icon: typeof Icon.Link }[] = [
  { slug: "link", label: "Lien", Icon: Icon.Link },
  { slug: "wrench", label: "Outil", Icon: Icon.Wrench },
  { slug: "sun", label: "Météo", Icon: Icon.Sun },
  { slug: "users", label: "RH / Équipe", Icon: Icon.Users },
  { slug: "clipboard", label: "Tâches", Icon: Icon.ClipboardCheck },
  { slug: "building", label: "Bâtiment", Icon: Icon.Building },
  { slug: "phone", label: "Téléphone", Icon: Icon.Phone },
  { slug: "map", label: "Carte", Icon: Icon.Map },
  { slug: "book", label: "Manuel", Icon: Icon.Book },
  { slug: "shield", label: "Sécurité", Icon: Icon.Shield },
  { slug: "filetext", label: "Document", Icon: Icon.FileText },
  { slug: "alert", label: "Alerte", Icon: Icon.AlertTriangle },
  { slug: "calendar", label: "Calendrier", Icon: Icon.Calendar },
  { slug: "folder", label: "Dossier", Icon: Icon.Folder },
  { slug: "train", label: "Train", Icon: Icon.Train },
  { slug: "briefcase", label: "Pro", Icon: Icon.Briefcase },
];

function iconBySlug(slug: string | null) {
  return (
    ICON_CATALOG.find((i) => i.slug === slug)?.Icon ?? ICON_CATALOG[0].Icon
  );
}

/** Palette de couleurs d'accent — hex stable côté BDD. */
const COLOR_CATALOG = [
  { hex: "#4F46E5", name: "Indigo", tw: { iconBg: "bg-indigo-100", iconText: "text-indigo-700" } },
  { hex: "#F59E0B", name: "Amber", tw: { iconBg: "bg-amber-100", iconText: "text-amber-700" } },
  { hex: "#8B5CF6", name: "Violet", tw: { iconBg: "bg-violet-100", iconText: "text-violet-700" } },
  { hex: "#10B981", name: "Emerald", tw: { iconBg: "bg-emerald-100", iconText: "text-emerald-700" } },
  { hex: "#F59E0B", name: "Gold", tw: { iconBg: "bg-yellow-100", iconText: "text-yellow-700" } },
  { hex: "#F43F5E", name: "Rose", tw: { iconBg: "bg-rose-100", iconText: "text-rose-700" } },
  { hex: "#475569", name: "Slate", tw: { iconBg: "bg-slate-200", iconText: "text-slate-700" } },
];

function paletteFor(hex: string | null) {
  if (!hex) return COLOR_CATALOG[0].tw;
  // Distance RGB la plus courte.
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return COLOR_CATALOG[0].tw;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  let best = COLOR_CATALOG[0];
  let bestD = Infinity;
  for (const c of COLOR_CATALOG) {
    const cm = c.hex.match(/^#([0-9a-f]{6})$/i);
    if (!cm) continue;
    const rr = parseInt(cm[1].slice(0, 2), 16);
    const gg = parseInt(cm[1].slice(2, 4), 16);
    const bb = parseInt(cm[1].slice(4, 6), 16);
    const d = (rr - r) ** 2 + (gg - g) ** 2 + (bb - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.tw;
}

export default function LinksAdminClient({
  initial,
}: {
  initial: Category[];
}) {
  const [cats, setCats] = useState(initial);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [linkPrefillCatId, setLinkPrefillCatId] = useState<string | null>(null);

  const totalLinks = useMemo(
    () => cats.reduce((n, c) => n + c.links.length, 0),
    [cats]
  );

  function openNewCategory() {
    setEditingCat(null);
    setShowCatModal(true);
  }
  function openEditCategory(c: Category) {
    setEditingCat(c);
    setShowCatModal(true);
  }
  function openNewLink(catId?: string) {
    setEditingLink(null);
    setLinkPrefillCatId(catId ?? null);
    setShowLinkModal(true);
  }
  function openEditLink(l: LinkItem) {
    setEditingLink(l);
    setLinkPrefillCatId(l.categoryId);
    setShowLinkModal(true);
  }

  async function saveCategory(data: {
    id?: string;
    name: string;
    icon: string;
    color: string;
  }) {
    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "category",
        id: data.id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        sortOrder:
          editingCat?.sortOrder ?? cats.length,
      }),
    });
    if (!res.ok) return;
    const saved = await res.json();
    setCats((arr) => {
      const exists = arr.some((c) => c.id === saved.id);
      if (exists) {
        return arr.map((c) =>
          c.id === saved.id ? { ...c, ...saved, links: c.links } : c
        );
      }
      return [...arr, { ...saved, links: [] }];
    });
    setShowCatModal(false);
  }

  async function saveLink(data: {
    id?: string;
    categoryId: string;
    label: string;
    url: string;
  }) {
    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "link",
        id: data.id,
        categoryId: data.categoryId,
        label: data.label,
        url: data.url,
        sortOrder: 0,
      }),
    });
    if (!res.ok) return;
    const saved = await res.json();
    setCats((arr) =>
      arr.map((c) => {
        if (data.id) {
          // Édition : peut avoir changé de catégorie.
          let links = c.links.filter((l) => l.id !== saved.id);
          if (c.id === saved.categoryId) links = [...links, saved];
          return { ...c, links };
        }
        if (c.id === saved.categoryId) {
          return { ...c, links: [...c.links, saved] };
        }
        return c;
      })
    );
    setShowLinkModal(false);
  }

  async function deleteCategory(c: Category) {
    if (
      !confirm(
        `Supprimer la thématique « ${c.name} » et ses ${c.links.length} lien(s) ?`
      )
    )
      return;
    const res = await fetch(`/api/admin/links/${c.id}?kind=category`, {
      method: "DELETE",
    });
    if (res.ok) {
      setCats((arr) => arr.filter((x) => x.id !== c.id));
    }
  }
  async function deleteLink(l: LinkItem) {
    if (!confirm(`Supprimer le lien « ${l.label} » ?`)) return;
    const res = await fetch(`/api/admin/links/${l.id}?kind=link`, {
      method: "DELETE",
    });
    if (res.ok) {
      setCats((arr) =>
        arr.map((c) =>
          c.id === l.categoryId
            ? { ...c, links: c.links.filter((x) => x.id !== l.id) }
            : c
        )
      );
    }
  }

  /** Bascule deux thématiques adjacentes pour réordonner via flèches. */
  async function moveCategory(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= cats.length) return;
    const next = [...cats];
    [next[idx], next[target]] = [next[target], next[idx]];
    setCats(next);
    // Persiste les deux nouveaux sortOrder.
    await Promise.all(
      [next[idx], next[target]].map((c, i) =>
        fetch("/api/admin/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "category",
            id: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            sortOrder: idx + dir === idx + i ? idx + dir : idx,
          }),
        })
      )
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Liens utiles</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Thématiques et collection de liens de la page hub
          {" "}« Liens utiles ».
        </p>
      </div>

      {/* === Section Thématiques === */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div>
            <h2 className="font-bold">Thématiques</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {cats.length} thématique{cats.length > 1 ? "s" : ""} — sections de
              la page Liens utiles
            </p>
          </div>
          <button
            onClick={openNewCategory}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg"
          >
            <Icon.Plus className="w-4 h-4" /> Ajouter
          </button>
        </header>

        <ul className="divide-y divide-slate-100">
          {cats.map((c, i) => {
            const Icn = iconBySlug(c.icon);
            const tw = paletteFor(c.color);
            return (
              <li
                key={c.id}
                className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50/60"
              >
                <div className="flex flex-col -gap-1">
                  <button
                    type="button"
                    onClick={() => moveCategory(i, -1)}
                    disabled={i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Monter"
                  >
                    <Icon.ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(i, 1)}
                    disabled={i === cats.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Descendre"
                  >
                    <Icon.ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tw.iconBg} ${tw.iconText}`}
                >
                  <Icn className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {c.links.length} lien{c.links.length > 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={() => openEditCategory(c)}
                  className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                >
                  Modifier
                </button>
                <button
                  onClick={() => deleteCategory(c)}
                  className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
                  title="Supprimer"
                >
                  <Icon.Trash className="w-4 h-4" />
                </button>
              </li>
            );
          })}
          {!cats.length && (
            <li className="px-5 py-10 text-center text-sm text-slate-500">
              Aucune thématique — cliquez « Ajouter » pour créer la première.
            </li>
          )}
        </ul>
      </section>

      {/* === Section Liens === */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div>
            <h2 className="font-bold">Liens</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalLinks} lien{totalLinks > 1 ? "s" : ""} dans la collection
            </p>
          </div>
          <button
            onClick={() => openNewLink()}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg"
          >
            <Icon.Plus className="w-4 h-4" /> Ajouter un lien
          </button>
        </header>

        <div>
          {cats.map((c) => {
            const Icn = iconBySlug(c.icon);
            const tw = paletteFor(c.color);
            return (
              <div key={c.id}>
                <div className="px-5 py-2.5 bg-slate-50 border-y border-slate-100 flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${tw.iconBg} ${tw.iconText}`}
                  >
                    <Icn className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                    {c.name}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    · {c.links.length}
                  </span>
                  <button
                    onClick={() => openNewLink(c.id)}
                    className="ml-auto text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    + Ajouter ici
                  </button>
                </div>
                <ul className="divide-y divide-slate-100">
                  {c.links.map((l) => (
                    <li
                      key={l.id}
                      className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50/60"
                    >
                      <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center shrink-0">
                        <Icon.Link className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {l.label}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {l.url}
                        </div>
                      </div>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        <Icon.ExternalLink className="w-3.5 h-3.5" /> Ouvrir
                      </a>
                      <button
                        onClick={() => openEditLink(l)}
                        className="text-xs text-slate-500 hover:text-slate-900 px-2"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => deleteLink(l)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        title="Supprimer"
                      >
                        <Icon.Trash className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {!c.links.length && (
                    <li className="px-5 py-3 text-xs text-slate-400 italic">
                      Aucun lien dans cette thématique.
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
          {!cats.length && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Créez d&apos;abord une thématique.
            </div>
          )}
        </div>
      </section>

      {showCatModal && (
        <CategoryModal
          initial={editingCat}
          onCancel={() => setShowCatModal(false)}
          onSave={saveCategory}
        />
      )}
      {showLinkModal && (
        <LinkModal
          initial={editingLink}
          prefillCategoryId={linkPrefillCatId}
          categories={cats}
          onCancel={() => setShowLinkModal(false)}
          onSave={saveLink}
        />
      )}
    </div>
  );
}

/* ============================================================================
 *  Modale thématique : nom, sélecteur d'icône, sélecteur de couleur, aperçu
 * ========================================================================== */

function CategoryModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: Category | null;
  onCancel: () => void;
  onSave: (d: {
    id?: string;
    name: string;
    icon: string;
    color: string;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "link");
  const [color, setColor] = useState(
    initial?.color ?? COLOR_CATALOG[0].hex
  );
  const PreviewIcon = iconBySlug(icon);
  const previewTw = paletteFor(color);

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-40"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">
            {initial ? "Modifier la thématique" : "Nouvelle thématique"}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 space-y-4">
          {/* Aperçu */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <div
              className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${previewTw.iconBg} ${previewTw.iconText}`}
            >
              <PreviewIcon className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-slate-700 truncate">
              {name || "Aperçu de la thématique"}
            </div>
          </div>

          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nom <span className="text-rose-600">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Boîte à outils technique"
              className="w-full border-2 border-indigo-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>

          {/* Icône */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Icône
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_CATALOG.map((opt) => (
                <button
                  type="button"
                  key={opt.slug}
                  onClick={() => setIcon(opt.slug)}
                  title={opt.label}
                  className={`aspect-square rounded-lg grid place-items-center border-2 transition-colors ${
                    icon === opt.slug
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <opt.Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Couleur d'accent */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Couleur d&apos;accent
            </label>
            <div className="flex gap-2.5">
              {COLOR_CATALOG.map((c) => (
                <button
                  type="button"
                  key={c.hex + c.name}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  style={{ background: c.hex }}
                  className={`w-8 h-8 rounded-full ring-offset-2 transition-shadow ${
                    color === c.hex
                      ? "ring-2 ring-slate-900"
                      : "ring-1 ring-slate-200 hover:ring-slate-400"
                  }`}
                />
              ))}
            </div>
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
            onClick={() => {
              if (!name.trim()) return;
              onSave({
                id: initial?.id,
                name: name.trim(),
                icon,
                color,
              });
            }}
            disabled={!name.trim()}
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
 *  Modale lien
 * ========================================================================== */

function LinkModal({
  initial,
  prefillCategoryId,
  categories,
  onCancel,
  onSave,
}: {
  initial: LinkItem | null;
  prefillCategoryId: string | null;
  categories: Category[];
  onCancel: () => void;
  onSave: (d: {
    id?: string;
    categoryId: string;
    label: string;
    url: string;
  }) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? prefillCategoryId ?? ""
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-40"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">
            {initial ? "Modifier le lien" : "Ajouter un lien"}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Libellé <span className="text-rose-600">*</span>
            </label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex : SharePoint Astreinte"
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL <span className="text-rose-600">*</span>
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thématique
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="">— Sans thématique —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            onClick={() => {
              if (!label.trim() || !url.trim() || !categoryId) return;
              onSave({
                id: initial?.id,
                categoryId,
                label: label.trim(),
                url: url.trim(),
              });
            }}
            disabled={!label.trim() || !url.trim() || !categoryId}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {initial ? "Enregistrer" : "Ajouter"}
          </button>
        </footer>
      </div>
    </>
  );
}
