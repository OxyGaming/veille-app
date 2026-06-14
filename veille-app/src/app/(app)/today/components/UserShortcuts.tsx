import Link from "next/link";
import { Icon } from "@/components/icons";

type Shortcut = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const SHORTCUTS: Shortcut[] = [
  {
    href: "/procedures",
    label: "Démarrer une veille",
    icon: Icon.ClipboardCheck,
  },
  { href: "/visits/new", label: "Démarrer une visite", icon: Icon.FileText },
  { href: "/agents", label: "Mes agents", icon: Icon.Users },
];

/**
 * 3 raccourcis USER — gestes les plus fréquents au quotidien.
 * Pleine largeur sur mobile, grille 3-cols à partir du tablet pour rester
 * lisible sans gaspiller l'espace. Cibles tactiles ≥ 56 px.
 */
export function UserShortcuts() {
  return (
    <section className="px-4 lg:px-8 mt-6">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Raccourcis
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 min-h-[88px] text-center hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98] transition"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
              <s.icon className="w-5 h-5" aria-hidden />
            </span>
            <span className="text-xs font-medium text-slate-800 leading-tight">
              {s.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
