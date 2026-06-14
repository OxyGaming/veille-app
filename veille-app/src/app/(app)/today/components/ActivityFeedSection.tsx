import Link from "next/link";
import { Icon } from "@/components/icons";
import type { TeamActivityEvent } from "@/lib/today/types";

type Props = {
  items: TeamActivityEvent[];
  /** ISO de `now` pour calculer la date relative. */
  now: string;
};

const TYPE_LABEL: Record<TeamActivityEvent["type"], string> = {
  SESSION_FINISHED: "Veille",
  VISIT_FINISHED: "Visite",
  AGENT_NOTE: "Commentaire",
  AGENT_SIGHTED: "Vu",
  ACTION_CREATED: "Action créée",
  ACTION_VALIDATED: "Action validée",
  EQUIPMENT_NON_COMPLIANT: "Non-conformité",
  EQUIPMENT_REPLACED: "Équipement remplacé",
  EQUIPMENT_ADDED: "Équipement ajouté",
};

const TYPE_DOT: Record<TeamActivityEvent["type"], string> = {
  SESSION_FINISHED: "bg-emerald-500",
  VISIT_FINISHED: "bg-indigo-500",
  AGENT_NOTE: "bg-violet-500",
  AGENT_SIGHTED: "bg-violet-400",
  ACTION_CREATED: "bg-amber-500",
  ACTION_VALIDATED: "bg-emerald-500",
  EQUIPMENT_NON_COMPLIANT: "bg-red-500",
  EQUIPMENT_REPLACED: "bg-indigo-400",
  EQUIPMENT_ADDED: "bg-slate-500",
};

/**
 * Flux d'activité équipe — chronologique décroissant, cliquable.
 * Affichage compact : pastille couleur par type, message principal,
 * petite ligne (acteur + type + date relative).
 */
export function ActivityFeedSection({ items, now }: Props) {
  const nowDate = new Date(now);
  return (
    <section className="px-4 lg:px-8 mt-6">
      <header className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Activité récente de l&apos;équipe
        </h2>
        {items.length > 0 && (
          <span className="text-[11px] font-mono text-slate-500">
            {items.length} dernier{items.length > 1 ? "s" : ""}
          </span>
        )}
      </header>
      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Aucune activité enregistrée pour le moment.
        </div>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} nowDate={nowDate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({
  item,
  nowDate,
}: {
  item: TeamActivityEvent;
  nowDate: Date;
}) {
  const at = new Date(item.createdAt);
  const dot = TYPE_DOT[item.type];
  const typeLabel = TYPE_LABEL[item.type];
  const relative = formatRelative(at, nowDate);
  const meta = [item.actorName, typeLabel, relative].filter(Boolean).join(" · ");

  const content = (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span
        className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${dot}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 leading-snug">{item.message}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{meta}</p>
      </div>
      {item.targetUrl && (
        <Icon.ChevronRight
          className="shrink-0 w-4 h-4 text-slate-400 mt-1"
          aria-hidden
        />
      )}
    </div>
  );

  if (item.targetUrl) {
    return (
      <li>
        <Link
          href={item.targetUrl}
          className="block hover:bg-slate-50 transition-colors"
        >
          {content}
        </Link>
      </li>
    );
  }
  return <li>{content}</li>;
}

function formatRelative(at: Date, now: Date): string {
  const diffMs = now.getTime() - at.getTime();
  const diffM = Math.round(diffMs / 60000);
  if (diffM < 1) return "à l'instant";
  if (diffM < 60) return `il y a ${diffM} min`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(at);
}
