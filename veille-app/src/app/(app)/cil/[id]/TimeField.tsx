"use client";

import { nowLocalInput } from "@/lib/cil/format";

/**
 * Saisie d'un horodatage sur le terrain : un clic sur « Maintenant » suffit dans
 * le cas courant (on note l'heure au moment où l'action a lieu), la saisie libre
 * reste disponible pour rattraper une heure passée.
 *
 * Utilisé pour TOUS les champs d'heure du Livret CIL afin que le geste soit le
 * même partout.
 */
export default function TimeField({
  value,
  onChange,
  label,
  required,
}: {
  /** Valeur au format `datetime-local` ("" = non renseigné). */
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
          {required && " *"}
        </label>
      )}
      {/* `flex-wrap` + largeur minimale : en colonne étroite (grille 2 colonnes
          sur mobile), le champ date reste lisible et le bouton passe dessous
          au lieu d'écraser la saisie. */}
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1 min-w-[8.5rem]"
        />
        <button
          type="button"
          onClick={() => onChange(nowLocalInput())}
          className="text-xs font-semibold px-2.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 shrink-0"
        >
          Maintenant
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs px-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
            aria-label="Effacer l'heure"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
