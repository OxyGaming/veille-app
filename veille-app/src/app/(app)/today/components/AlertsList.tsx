import Link from "next/link";
import type { AdminAlert } from "@/lib/today/types";

type Props = {
  alerts: AdminAlert[];
  title?: string;
};

/**
 * Liste compacte d'alertes système — dot couleur + label + lien optionnel.
 * Réutilisable pour ADMIN, plus tard pour notifications utilisateur.
 */
export function AlertsList({ alerts, title = "Alertes système" }: Props) {
  if (alerts.length === 0) return null;
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h2>
      <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {alerts.map((a) => {
          const dot = DOT[a.level];
          const row = (
            <span className="flex items-start gap-2.5 px-3 py-2.5 text-sm text-slate-800">
              <span
                className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${dot}`}
                aria-hidden
              />
              <span className="flex-1 min-w-0">{a.label}</span>
            </span>
          );
          return (
            <li key={a.id}>
              {a.href ? (
                <Link
                  href={a.href}
                  className="block hover:bg-slate-50 transition-colors"
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const DOT: Record<AdminAlert["level"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};
