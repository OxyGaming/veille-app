"use client";

import { colorForTag, displayTag } from "@/lib/tags";

/**
 * Rendu compact de tags en chips colorées. Couleur déterministe par tag.
 */
export function TagChips({
  tags,
  size = "sm",
}: {
  tags: string[];
  size?: "xs" | "sm";
}) {
  if (!tags.length) return null;
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  const pad = size === "xs" ? "px-1.5 py-0" : "px-1.5 py-0.5";
  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {tags.map((tag, i) => {
        const c = colorForTag(tag);
        return (
          <span
            key={`${tag}-${i}`}
            className={`${text} ${pad} font-mono font-semibold rounded ${c.bg} ${c.text} border ${c.border}`}
          >
            {displayTag(tag)}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Éditeur de tags : input + chips supprimables. Validation Entrée/virgule.
 */
export function TagInput({
  tags,
  onChange,
  placeholder = "Ajouter un tag…",
  disabled,
  imposed = [],
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Tags imposés non supprimables (ex. veille légale, obligatoire). */
  imposed?: string[];
}) {
  function commit(value: string) {
    const v = value.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (tags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    onChange([...tags, v]);
  }
  function remove(t: string) {
    if (imposed.some((i) => i.toLowerCase() === t.toLowerCase())) return;
    onChange(tags.filter((x) => x !== t));
  }
  return (
    <div className="flex flex-wrap gap-1.5 border border-slate-200 rounded-lg p-2 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
      {tags.map((t) => {
        const c = colorForTag(t);
        const locked = imposed.some((i) => i.toLowerCase() === t.toLowerCase());
        return (
          <span
            key={t}
            className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold rounded px-2 py-0.5 border ${c.bg} ${c.text} ${c.border}`}
          >
            {displayTag(t)}
            {!locked && !disabled && (
              <button
                type="button"
                onClick={() => remove(t)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Retirer ${t}`}
              >
                ✕
              </button>
            )}
            {locked && (
              <span className="opacity-60" title="Tag imposé — non supprimable">
                🔒
              </span>
            )}
          </span>
        );
      })}
      {!disabled && (
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 min-w-[120px] text-sm border-none focus:outline-none bg-transparent px-1"
          onKeyDown={(e) => {
            const t = e.currentTarget;
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              commit(t.value);
              t.value = "";
            } else if (e.key === "Backspace" && !t.value && tags.length) {
              const last = tags[tags.length - 1];
              if (!imposed.some((i) => i.toLowerCase() === last.toLowerCase())) {
                remove(last);
              }
            }
          }}
          onBlur={(e) => {
            commit(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
        />
      )}
    </div>
  );
}
