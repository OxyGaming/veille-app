import { Icon } from "@/components/icons";

type Props = {
  title: string;
  hint?: string;
};

/**
 * État vide gratifiant pour la section "À traiter".
 * Évite l'anxiété artificielle quand il n'y a rien à faire.
 */
export function EmptyState({ title, hint }: Props) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon.Check className="w-5 h-5" aria-hidden />
      </div>
      <p className="mt-2 text-sm font-semibold text-emerald-900">{title}</p>
      {hint && <p className="mt-1 text-xs text-emerald-800">{hint}</p>}
    </div>
  );
}
