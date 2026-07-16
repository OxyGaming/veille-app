import Link from "next/link";
import { Icon } from "@/components/icons";
import { Sparkline } from "@/components/charts";
import type { AgentOnDutyItem, DutyStatus } from "@/lib/today/planning";
import { AgentQuickActions } from "./AgentQuickActions";

type Props = {
  items: AgentOnDutyItem[];
  hasPlanningImport: boolean;
  /** Vrai si l'utilisateur peut importer un planning (ADMIN uniquement). */
  canImportPlanning: boolean;
  /** Titre de section — par défaut "Agents en service aujourd'hui". */
  title?: string;
  /** Titre de l'état vide (scope OK, aucun agent ce jour-là). */
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * Section "Agents en service aujourd'hui" — vue manager.
 *
 * Source : `AgentOnDutyItem[]` calculé côté serveur via `agentScope(user)`.
 * Le cloisonnement repose 100 % sur ce helper — la section n'ajoute aucun
 * agent au-delà du scope Veille existant.
 *
 * États :
 *  - planning absent en base → invite ADMIN à importer
 *  - planning présent, scope vide → "Aucun agent en service aujourd'hui"
 *  - sinon → liste triée (en service / plus tard / terminés)
 */
export function AgentsOnDutySection({
  items,
  hasPlanningImport,
  canImportPlanning,
  title = "Agents en service aujourd'hui",
  emptyTitle = "Aucun agent en service aujourd'hui",
  emptyDescription = "Aucun agent de votre périmètre n'a de journée de service prévue aujourd'hui.",
}: Props) {
  return (
    <section className="px-4 lg:px-8 mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          {title}
          {items.length > 0 && (
            <span className="ml-1.5 normal-case font-sans text-slate-700 font-semibold">
              ({items.length})
            </span>
          )}
        </h2>
      </div>

      {!hasPlanningImport ? (
        <EmptyState
          icon={<Icon.Calendar className="w-5 h-5 text-slate-400" aria-hidden />}
          title="Aucun planning importé"
          description="Le tour de service ferroviaire n'a pas encore été chargé."
          action={
            canImportPlanning ? (
              <Link
                href="/admin/planning"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Icon.Upload className="w-3.5 h-3.5" aria-hidden />
                Importer un planning
              </Link>
            ) : null
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon.User className="w-5 h-5 text-slate-400" aria-hidden />}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <AgentOnDutyCard key={item.shiftId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Carte unitaire — un agent + son créneau du jour. */
function AgentOnDutyCard({ item }: { item: AgentOnDutyItem }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 lg:p-4 flex flex-col md:flex-row md:items-center md:gap-4 gap-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {item.agentName}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <div className="mt-0.5 text-[11px] font-mono text-slate-500">
          {item.agentMatricule}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          <span className="font-mono">
            {formatTime(item.startsAt)} → {formatTime(item.endsAt)}
            {item.isOvernight ? (
              <span
                className="ml-1 font-semibold text-slate-500"
                title="Service de nuit (fin le jour suivant)"
              >
                (+1)
              </span>
            ) : null}
          </span>
          {item.jsCode ? (
            <span className="font-mono text-slate-500">{item.jsCode}</span>
          ) : null}
        </div>
        <div className="mt-1.5">
          <FreshnessChip days={item.daysSinceLastSession} />
        </div>
      </div>
      {/* Bloc résumé activité — pattern identique à AgentsListClient (fiche agent). */}
      <div className="text-right shrink-0">
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
            item.openActionsCount > 5
              ? "bg-rose-50 text-rose-700"
              : item.openActionsCount > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {item.openActionsCount} act.
        </span>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {item.sessionCount} session(s)
        </div>
        {item.activity.some((v) => v > 0) && (
          <div className="mt-0.5 -mr-0.5">
            <Sparkline values={item.activity} width={72} height={18} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Link
          href={`/agents/${item.agentId}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[36px]"
        >
          Fiche agent
        </Link>
        {/* C11 — Vu + Commentaire rapides depuis la liste Aujourd'hui. */}
        <AgentQuickActions agentId={item.agentId} agentName={item.agentName} />
        <Link
          href={`/sessions/new?agentId=${item.agentId}`}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 min-h-[36px]"
        >
          Démarrer une veille
          <Icon.ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  );
}

/** Chip "il y a X jours" — orange si > 30 j, gris sinon ; rouge si jamais. */
function FreshnessChip({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
        Jamais veillé
      </span>
    );
  }
  const tone = days > 30 ? "warn" : "info";
  const cls =
    tone === "warn"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";
  const dot =
    tone === "warn" ? "bg-amber-500" : "bg-emerald-500";
  const label =
    days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} jours`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}


function StatusBadge({ status }: { status: DutyStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

const STATUS_META: Record<DutyStatus, { label: string; cls: string }> = {
  IN_SERVICE: {
    label: "En service",
    cls: "bg-emerald-100 text-emerald-800",
  },
  LATER: {
    label: "Plus tard",
    cls: "bg-indigo-100 text-indigo-800",
  },
  FINISHED: {
    label: "Terminé",
    cls: "bg-slate-100 text-slate-600",
  },
};

/**
 * Heure locale `HH:MM` depuis un ISO 8601.
 * Le serveur tourne en Europe/Paris, donc l'heure locale du Date construit
 * côté client après parse est la bonne (pour utilisateurs FR métropolitains).
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 mb-2">
        {icon}
      </div>
      <div className="text-sm font-medium text-slate-800">{title}</div>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
