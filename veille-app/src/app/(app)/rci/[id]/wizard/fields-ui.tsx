"use client";

import type { ReactNode } from "react";
import type { Ternary } from "@/lib/rci/fields";

// ─── Helpers de conversion entre formats UI et formats payload Word ──────────

/** "DD/MM/YYYY" → "YYYY-MM-DD" pour `<input type="date">`. */
export function dateFrToIso(fr: string): string {
  const m = fr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** "YYYY-MM-DD" → "DD/MM/YYYY" (format Word). */
export function dateIsoToFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
/**
 * Format heure stocké dans le payload (= format Word) : `HhMM` sans zéro
 * de tête sur les heures, ex. "7h30". Compatible avec les anciennes saisies
 * "07h30" (le DossierNumber les pad-startait déjà à 2 chiffres).
 */
export function timeFrToIso(fr: string): string {
  const m = fr.match(/^(\d{1,2})h(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
/** "HH:MM" (input time HTML) → "HhMM" sans zéro de tête (format Word). */
export function timeIsoToFr(iso: string): string {
  const m = iso.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${parseInt(m[1], 10)}h${m[2]}` : "";
}

/** Champ texte avec label. */
export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
  multiline,
  rows,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      {hint && (
        <span className="ml-1 text-[10px] font-mono text-slate-400">
          {hint}
        </span>
      )}
      <div className="mt-1">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows ?? 4}
            className="input min-h-[100px]"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="input"
          />
        )}
      </div>
    </label>
  );
}

/** Case à cocher booléenne (true/false). */
export function CheckField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4"
      />
      <span>{label}</span>
    </label>
  );
}

/** Toggle ternaire (oui / non / non renseigné). */
export function TernaryField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Ternary;
  onChange: (v: Ternary) => void;
  disabled?: boolean;
}) {
  function Btn({
    state,
    children,
  }: {
    state: Ternary;
    children: ReactNode;
  }) {
    const active = value === state;
    const cls = active
      ? state === true
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : state === false
          ? "bg-rose-100 text-rose-800 border-rose-300"
          : "bg-slate-100 text-slate-700 border-slate-300"
      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300";
    return (
      <button
        type="button"
        onClick={() => onChange(state)}
        disabled={disabled}
        className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${cls}`}
      >
        {children}
      </button>
    );
  }
  return (
    <div className="text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      <div className="mt-1 inline-flex gap-1">
        <Btn state={true}>OUI</Btn>
        <Btn state={false}>NON</Btn>
        <Btn state={null}>—</Btn>
      </div>
    </div>
  );
}

/**
 * Champ date — UI = `<input type="date">` (YYYY-MM-DD), stockage payload
 * `JJ/MM/AAAA` (= format imprimé dans le Word, inchangé). Permet aussi une
 * saisie manuelle texte au format payload pour préserver la compatibilité
 * avec les anciens RCI / les saisies hors picker (clavier).
 */
export function DateField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isoValue = dateFrToIso(value);
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      {hint && (
        <span className="ml-1 text-[10px] font-mono text-slate-400">{hint}</span>
      )}
      <div className="mt-1 flex gap-1">
        <input
          type="date"
          value={isoValue}
          onChange={(e) => onChange(dateIsoToFr(e.target.value))}
          disabled={disabled}
          className="input"
        />
      </div>
    </label>
  );
}

/**
 * Champ heure — UI = `<input type="time">` (HH:MM), stockage payload
 * `HhMM` sans zéro de tête sur l'heure (ex. "7h30"). Le rendu Word
 * affiche tel quel.
 */
export function TimeField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isoValue = timeFrToIso(value);
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      {hint && (
        <span className="ml-1 text-[10px] font-mono text-slate-400">{hint}</span>
      )}
      <div className="mt-1">
        <input
          type="time"
          value={isoValue}
          onChange={(e) => onChange(timeIsoToFr(e.target.value))}
          disabled={disabled}
          className="input"
        />
      </div>
    </label>
  );
}

/** Bloc visuel pour grouper des champs. */
export function FieldSet({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
      <legend className="text-xs font-semibold text-slate-700 px-2">
        {title}
        {hint && (
          <span className="ml-2 text-[10px] font-normal font-mono text-slate-400">
            {hint}
          </span>
        )}
      </legend>
      {children}
    </fieldset>
  );
}
