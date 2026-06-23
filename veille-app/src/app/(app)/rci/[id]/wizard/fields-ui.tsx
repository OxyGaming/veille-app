"use client";

import type { ReactNode } from "react";
import type { Ternary } from "@/lib/rci/fields";

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
