/**
 * Helpers pour les tags d'actions — stockés comme JSON array de strings
 * dans `ImportedAction.tags` (SQLite n'a pas de type Array natif).
 *
 * Règles :
 *  - texte libre, pas de liste fermée ;
 *  - normalisation : trim, lowercase, suppression espaces multiples ;
 *  - dédup (un tag ne peut figurer qu'une fois sur une action) ;
 *  - longueur max 40 caractères par tag, 12 tags max par action.
 */

const MAX_TAGS = 12;
const MAX_LEN = 40;

/** Couleur stable d'un tag pour son chip — palette curated, déterministe via hash. */
const TAG_PALETTE = [
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
] as const;

export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents pour la comparaison
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LEN);
}

/** Pour l'affichage : trim + collapse spaces, mais on garde la casse/accents d'origine. */
export function displayTag(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
}

export function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

export function encodeTags(tags: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const norm = normalizeTag(raw);
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(displayTag(raw));
    if (out.length >= MAX_TAGS) break;
  }
  return JSON.stringify(out);
}

/** Couleur déterministe pour un tag (chip). */
export function colorForTag(tag: string) {
  const n = normalizeTag(tag);
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

/** Vérifie l'unicité normalisée. */
export function hasTag(tags: string[], target: string): boolean {
  const t = normalizeTag(target);
  return tags.some((x) => normalizeTag(x) === t);
}

/** Constants imposées dans le code applicatif. */
export const TAG_VEILLE_LEGALE = "veille légale";
export const TAG_OBLIGATOIRE = "obligatoire";
