"use client";

import { useMemo, useState } from "react";
import { matchesQuery, normalize } from "@/components/SearchInput";
import { Icon } from "@/components/icons";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  description: string | null;
};
type Category = {
  id: string;
  name: string;
  color: string | null;
  /** Slug d'icône choisi en back-office (cf. ICON_CATALOG admin). */
  icon: string | null;
  links: LinkItem[];
};

/**
 * Catalogue côté usager — doit refléter le catalogue admin pour résoudre
 * le slug stocké en BDD vers l'icône.
 */
const USER_ICON_BY_SLUG: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  link: Icon.Link,
  wrench: Icon.Wrench,
  sun: Icon.Sun,
  users: Icon.Users,
  clipboard: Icon.ClipboardCheck,
  building: Icon.Building,
  phone: Icon.Phone,
  map: Icon.Map,
  book: Icon.Book,
  shield: Icon.Shield,
  filetext: Icon.FileText,
  alert: Icon.AlertTriangle,
  calendar: Icon.Calendar,
  folder: Icon.Folder,
  train: Icon.Train,
  briefcase: Icon.Briefcase,
};

/**
 * Devine l'icône à utiliser pour une catégorie à partir de son nom. On garde
 * tout dans le code pour éviter une migration de schéma — si une catégorie
 * n'est pas reconnue, on tombe sur l'icône Link générique.
 */
/**
 * Détermine l'icône d'une catégorie : on respecte le slug choisi en
 * back-office, sinon on tombe sur une heuristique par nom pour conserver
 * un visuel correct sur les catégories pré-existantes (sans icône stockée).
 */
function iconForCategory(
  cat: Category
): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  if (cat.icon && USER_ICON_BY_SLUG[cat.icon]) return USER_ICON_BY_SLUG[cat.icon];
  const n = normalize(cat.name);
  if (/cps|rh|habil|volonta|memo|juridique|accident|equipe/.test(n))
    return Icon.Users;
  if (/cil|rci|secur|prevent|safety/.test(n)) return Icon.Shield;
  if (/meteo|astrein|note dto|dto/.test(n)) return Icon.Sun;
  if (/outil|tool/.test(n)) return Icon.Wrench;
  if (/contact|tel|phone|telephon/.test(n)) return Icon.Phone;
  if (/site|poste|local|batiment/.test(n)) return Icon.Building;
  if (/refer|doc|fiche|rapport|procedure|manuel|guide/.test(n))
    return Icon.FileText;
  if (/import|export|portail/.test(n)) return Icon.Briefcase;
  return Icon.Link;
}

/**
 * Convertit la couleur hex/css de la catégorie en triplet { bg, text, ring }
 * de classes Tailwind. Si la couleur est invalide, fallback indigo.
 */
/**
 * Convertit une couleur (hex ou nom Tailwind) en palette de classes en
 * choisissant le bucket Tailwind le plus proche par distance RGB. Couvre
 * sans heuristique fragile les couleurs réelles renseignées en BDD
 * (notamment les nuances SNCF qui ne tombent pas exactement sur les hex
 * Tailwind par défaut).
 */
const PALETTES = {
  indigo: {
    rgb: [79, 70, 229],
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
    ring: "ring-indigo-200",
  },
  emerald: {
    rgb: [16, 185, 129],
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  amber: {
    rgb: [245, 158, 11],
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    ring: "ring-amber-200",
  },
  violet: {
    rgb: [139, 92, 246],
    iconBg: "bg-violet-100",
    iconText: "text-violet-700",
    ring: "ring-violet-200",
  },
  sky: {
    rgb: [14, 165, 233],
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
    ring: "ring-sky-200",
  },
  rose: {
    rgb: [244, 63, 94],
    iconBg: "bg-rose-100",
    iconText: "text-rose-700",
    ring: "ring-rose-200",
  },
  cyan: {
    rgb: [6, 182, 212],
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-700",
    ring: "ring-cyan-200",
  },
  slate: {
    rgb: [71, 85, 105],
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    ring: "ring-slate-200",
  },
} as const;

function paletteFromColor(color: string | null) {
  const fallback = PALETTES.indigo;
  if (!color) return fallback;
  const m = color.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) {
    // Tente une correspondance par mot-clé (ex. "indigo", "emerald").
    const k = color.trim().toLowerCase();
    for (const name of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
      if (k.includes(name)) return PALETTES[name];
    }
    return fallback;
  }
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  let best: keyof typeof PALETTES = "indigo";
  let bestD = Infinity;
  for (const k of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
    const [rr, gg, bb] = PALETTES[k].rgb;
    const d =
      (rr - r) * (rr - r) + (gg - g) * (gg - g) + (bb - b) * (bb - b);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return PALETTES[best];
}

export default function LinksListClient({
  categories,
}: {
  categories: Category[];
}) {
  const [q, setQ] = useState("");
  const totalLinks = useMemo(
    () => categories.reduce((n, c) => n + c.links.length, 0),
    [categories]
  );
  const filtered = useMemo(() => {
    if (!q.trim()) return { cats: categories, matchCount: totalLinks };
    let matchCount = 0;
    const cats = categories
      .map((c) => {
        if (matchesQuery(q, c.name)) {
          matchCount += c.links.length;
          return c;
        }
        const links = c.links.filter((l) =>
          matchesQuery(q, `${l.label} ${l.url} ${l.description ?? ""}`)
        );
        if (!links.length) return null;
        matchCount += links.length;
        return { ...c, links };
      })
      .filter((c): c is Category => !!c);
    return { cats, matchCount };
  }, [categories, q, totalLinks]);

  return (
    <div className="pb-12">
      {/* Bannière hero — fond bleu marine + recherche large */}
      <header className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white px-4 lg:px-8 py-6 lg:py-8 rounded-xl mx-4 lg:mx-8 mt-4 lg:mt-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            Liens utiles
          </h1>
          <p className="text-sm text-indigo-200 mt-1">
            Portails et outils, classés par thématique.
          </p>
          <div className="mt-4 relative">
            <Icon.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un lien…"
              className="w-full bg-white text-slate-900 placeholder-slate-400 rounded-lg pl-11 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            {q.trim() && (
              <div className="text-[11px] font-mono text-indigo-200 mt-2">
                {filtered.matchCount} / {totalLinks} liens
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sections par catégorie */}
      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
        {filtered.cats.map((c) => {
          const Icn = iconForCategory(c);
          const palette = paletteFromColor(c.color);
          return (
            <section key={c.id} className="mb-7">
              {/* Header de section : icône colorée + titre + compteur */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${palette.iconBg} ${palette.iconText}`}
                >
                  <Icn className="w-5 h-5" />
                </div>
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                  {c.name}
                </h2>
                <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {c.links.length}
                </span>
              </div>

              {/* Grid de cartes-liens */}
              <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {c.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`group block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all relative ring-1 ring-transparent hover:${palette.ring}`}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${palette.iconBg} ${palette.iconText}`}
                        >
                          <Icn className="w-5 h-5" />
                        </div>
                        <Icon.ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-4 leading-tight">
                        {l.label}
                      </div>
                      {l.description && (
                        <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {l.description}
                        </div>
                      )}
                    </a>
                  </li>
                ))}
                {!c.links.length && (
                  <li className="col-span-full text-xs text-slate-400 italic px-1">
                    Aucun lien dans cette catégorie.
                  </li>
                )}
              </ul>
            </section>
          );
        })}
        {filtered.cats.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">
            {totalLinks === 0
              ? "Aucune catégorie. Configurez-les depuis le back-office."
              : "Aucun lien ne correspond à votre recherche."}
          </div>
        )}
      </div>
    </div>
  );
}
