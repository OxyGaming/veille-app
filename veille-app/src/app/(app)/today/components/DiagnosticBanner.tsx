import { Icon } from "@/components/icons";

export type DiagnosticState = "green" | "yellow" | "red";

type Props = {
  state: DiagnosticState;
  /** Titre principal affiché en gros. Optionnel : valeur par défaut selon l'état. */
  title?: string;
  /** Lignes de détail à puces (ex. « 3 actions en retard »). */
  lines: string[];
  /** Lien d'action optionnel — affiché en bas si présent. */
  cta?: { label: string; href: string };
};

/**
 * Bannière diagnostic synthétique — réutilisable EDITOR, ADMIN, Hub Échéances.
 * Reste générique : ne connaît rien des métriques, juste l'état et les lignes.
 */
export function DiagnosticBanner({ state, title, lines, cta }: Props) {
  const tone = TONE[state];
  const t = title ?? DEFAULT_TITLE[state];
  return (
    <section className="px-4 lg:px-8 mt-4">
      <div
        className={`rounded-xl border ${tone.border} ${tone.bg} p-4 lg:p-5`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full ${tone.iconBg} ${tone.iconText}`}
          >
            <tone.Icon className="w-5 h-5" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-base lg:text-lg font-semibold ${tone.title}`}>
              {t}
            </h2>
            {lines.length > 0 ? (
              <ul className={`mt-1.5 space-y-1 text-sm ${tone.body}`}>
                {lines.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 inline-block w-1 h-1 rounded-full ${tone.bullet} shrink-0`}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-1 text-sm ${tone.body}`}>
                Rien à signaler dans votre périmètre.
              </p>
            )}
            {cta && (
              <a
                href={cta.href}
                className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${tone.link}`}
              >
                {cta.label}
                <Icon.ChevronRight className="w-4 h-4" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const DEFAULT_TITLE: Record<DiagnosticState, string> = {
  green: "Situation maîtrisée",
  yellow: "Vigilance requise",
  red: "Action nécessaire",
};

const TONE: Record<
  DiagnosticState,
  {
    bg: string;
    border: string;
    title: string;
    body: string;
    bullet: string;
    iconBg: string;
    iconText: string;
    link: string;
    Icon: typeof Icon.Check;
  }
> = {
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    title: "text-emerald-900",
    body: "text-emerald-800",
    bullet: "bg-emerald-500",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    link: "text-emerald-700 hover:text-emerald-900",
    Icon: Icon.Check,
  },
  yellow: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    title: "text-amber-900",
    body: "text-amber-800",
    bullet: "bg-amber-500",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    link: "text-amber-800 hover:text-amber-900",
    Icon: Icon.AlertTriangle,
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    title: "text-red-900",
    body: "text-red-800",
    bullet: "bg-red-500",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    link: "text-red-700 hover:text-red-900",
    Icon: Icon.AlertTriangle,
  },
};
