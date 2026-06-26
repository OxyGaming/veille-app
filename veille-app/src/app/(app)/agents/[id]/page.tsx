import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  agentScope,
  effectiveTeamIds,
  getSessionUser,
  teamScope,
} from "@/lib/auth";
import AgentActionsClient from "./AgentActionsClient";
import RecentValidations, {
  type ValidationEntry,
} from "./RecentValidations";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const agent = await prisma.agent.findFirst({
    where: { id, ...agentScope(u) },
    include: {
      team: true,
      poste: true,
      secteur: true,
      memberships: { include: { team: true } },
    },
  });
  if (!agent) notFound();

  // Équipes dans lesquelles l'utilisateur courant peut créer une action pour
  // cet agent = intersection équipes(agent) ∩ équipes-agissables(user).
  // Sert au sélecteur d'équipe de la modale « Ajouter une action » (affiché
  // seulement si >1 choix). Un global (ADMIN/viewAllTeams) voit toutes les
  // équipes de l'agent.
  const agentTeams = [
    ...new Map(
      [
        ...(agent.team ? [agent.team] : []),
        ...agent.memberships.map((m) => m.team),
      ].map((t) => [t.id, { id: t.id, name: t.name }])
    ).values(),
  ];
  const effIds = effectiveTeamIds(u);
  const creatableTeams = (
    effIds === null
      ? agentTeams
      : agentTeams.filter((t) => effIds.includes(t.id))
  ).sort((a, b) =>
    // L'équipe principale de l'utilisateur d'abord, pour un défaut naturel.
    a.id === u.teamId ? -1 : b.id === u.teamId ? 1 : 0
  );

  // Actions CLOISONNÉES par équipe : sur un agent multi-équipes, chaque
  // utilisateur ne voit que les actions de SES équipes. Un même libellé peut
  // exister en double (une obligation distincte par équipe) — elles ne doivent
  // ni fusionner ni se valider en cascade entre équipes. teamScope filtre sur
  // ImportedAction.teamId (vide = ADMIN / viewAllTeams → toutes les équipes).
  const activeActionsRaw = await prisma.importedAction.findMany({
    where: { agentId: id, localStatus: "ACTIVE", ...teamScope(u) },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: { team: { select: { name: true } } },
  });
  // Parse tags JSON pour passer un tableau au client.
  const parseTagsField = (s: string | null | undefined): string[] => {
    if (!s) return [];
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  // Regroupe les doublons logiques par dedupHash : on garde la première
  // occurrence (la plus prioritaire — échéance la plus proche) et on
  // remonte le détail des autres pour permettre un dépliage côté UI.
  type Action = (typeof activeActionsRaw)[number];
  const byHash = new Map<string, Action[]>();
  const noHash: Action[] = [];
  for (const a of activeActionsRaw) {
    if (a.dedupHash) {
      // Clé de regroupement préfixée par l'équipe : deux actions au contenu
      // identique mais rattachées à deux équipes différentes restent DEUX
      // cartes distinctes (et donc deux cascades de validation séparées).
      const key = `${a.teamId}:${a.dedupHash}`;
      const arr = byHash.get(key) ?? [];
      arr.push(a);
      byHash.set(key, arr);
    } else {
      noHash.push(a);
    }
  }
  // Tri interne : action avec échéance la plus proche d'abord, puis les autres.
  const sortByDue = (arr: Action[]) =>
    [...arr].sort(
      (a, b) =>
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)
    );
  const activeActions = [
    ...[...byHash.values()].map((arr) => {
      const sorted = sortByDue(arr);
      return {
        ...sorted[0],
        duplicateCount: sorted.length,
        // Détail de TOUTES les occurrences (y compris la principale).
        // Sert au dépliage UI et à la cascade de validation.
        duplicates: sorted.map((x) => ({
          id: x.id,
          externalId: x.externalId,
          dueAt: x.dueAt?.toISOString() ?? null,
          originalStatus: x.originalStatus,
          createdAt: x.createdAt.toISOString(),
        })),
      };
    }),
    ...noHash.map((a) => ({
      ...a,
      duplicateCount: 1,
      duplicates: [
        {
          id: a.id,
          externalId: a.externalId,
          dueAt: a.dueAt?.toISOString() ?? null,
          originalStatus: a.originalStatus,
          createdAt: a.createdAt.toISOString(),
        },
      ],
    })),
  ].sort((a, b) => {
    const da = a.dueAt?.getTime() ?? Infinity;
    const db = b.dueAt?.getTime() ?? Infinity;
    return da - db;
  });

  // Validations CLOISONNÉES comme les actions : une validation est la clôture
  // d'une action d'une équipe donnée ; la montrer hors de l'équipe rouvrirait
  // la confusion « l'autre équipe a validé l'action A ».
  const validated = await prisma.actionValidation.findMany({
    where: { agentId: id, ...teamScope(u) },
    orderBy: { realizedAt: "desc" },
    take: 30,
    include: {
      action: true,
      validatedBy: { select: { name: true } },
      team: { select: { name: true } },
    },
  });

  // « Vu » / commentaires : TRANSVERSAUX (partagés entre équipes). On charge le
  // nom de l'équipe uniquement pour afficher un badge d'origine.
  const sightings = await prisma.agentSighting.findMany({
    where: { agentId: id },
    orderBy: { sightedAt: "desc" },
    take: 30,
    include: {
      observer: { select: { name: true } },
      photos: { select: { id: true, storagePath: true, legend: true } },
      team: { select: { name: true } },
    },
  });

  // Sessions de veille : TRANSVERSALES (partagées). Badge d'équipe informatif.
  const sessions = await prisma.veilleSession.findMany({
    where: { agentId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      procedures: { include: { procedure: { select: { title: true } } } },
      team: { select: { name: true } },
    },
  });

  const today = new Date();
  const sevenDays = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
  const lateCount = activeActions.filter(
    (a) => a.dueAt && a.dueAt < today
  ).length;
  const soonCount = activeActions.filter(
    (a) => a.dueAt && a.dueAt >= today && a.dueAt <= sevenDays
  ).length;
  const duplicateGroups = activeActions.filter((a) => a.duplicateCount > 1).length;
  const hiddenDuplicates = activeActions.reduce(
    (n, a) => n + (a.duplicateCount - 1),
    0
  );

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto">
      <header className="card p-5 lg:p-6">
        <Link
          href="/agents"
          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
        >
          <Icon.ChevronLeft className="w-3 h-3" /> Agents
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-2xl font-bold grid place-items-center shadow-sm shrink-0">
            {(agent.firstName[0] ?? "?").toUpperCase()}
            {(agent.lastName[0] ?? "").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
              {agent.lastName} {agent.firstName}
            </h1>
            <div className="text-xs font-mono text-slate-500 mt-1 flex flex-wrap gap-2">
              <span>{agent.matricule}</span>
              {agent.team && <span>· {agent.team.name}</span>}
              {agent.poste && <span>· {agent.poste.name}</span>}
              {agent.secteur && <span>· {agent.secteur.name}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Actions à traiter" value={activeActions.length} tone="default" />
          <Stat label="En retard" value={lateCount} tone="warn" />
          <Stat label="< 7 jours" value={soonCount} tone="info" />
        </div>
        {(u.role === "ADMIN" || u.role === "EDITOR") && (
          <div className="mt-4 flex justify-end">
            <Link
              href={`/agents/${id}/development`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-1.5"
              title="Support de dialogue managérial — 12 mois glissants par défaut"
            >
              <Icon.FileText className="w-3.5 h-3.5" />
              Fiche de développement individuel
            </Link>
          </div>
        )}
      </header>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Icon.AlertTriangle className="w-4 h-4 text-amber-600" /> Actions à
            traiter
          </h2>
          {duplicateGroups > 0 && (
            <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5">
              {duplicateGroups} groupe(s) de doublons · {hiddenDuplicates}{" "}
              action(s) masquée(s)
            </span>
          )}
        </div>
        <AgentActionsClient
          agentId={id}
          agentName={`${agent.firstName} ${agent.lastName}`}
          userRole={u.role}
          teams={creatableTeams}
          actions={activeActions.map((a) => ({
            id: a.id,
            externalId: a.externalId,
            comment: a.comment,
            keyPoint: a.keyPoint,
            domain: a.domain,
            theme: a.theme,
            type: a.type,
            actionPlan: a.actionPlan,
            dueAt: a.dueAt?.toISOString() ?? null,
            procedureId: a.procedureId,
            duplicateCount: a.duplicateCount,
            duplicates: a.duplicates,
            tags: parseTagsField(a.tags),
            teamName: a.team?.name ?? null,
          }))}
        />
      </section>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
            <Icon.FileText className="w-4 h-4 text-indigo-600" /> Sessions de
            veille
          </h2>
          <ul className="grid gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="card px-3.5 py-2.5">
                <Link href={`/sessions/${s.id}`} className="block">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-500">
                      {format(s.startedAt, "PPp", { locale: fr })}
                    </span>
                    <TeamBadge name={s.team?.name} />
                  </div>
                  <div className="text-sm font-semibold mt-0.5">
                    {s.procedures.map((p) => p.procedure.title).join(", ")}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Statut : {s.status}
                  </div>
                </Link>
              </li>
            ))}
            {!sessions.length && (
              <li className="text-xs text-slate-500">Aucune session.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
            <Icon.Check className="w-4 h-4 text-emerald-600" /> Historique des
            validations
          </h2>
          <RecentValidations
            initial={validated.map<ValidationEntry>((v) => ({
              id: v.id,
              realizedAt: v.realizedAt.toISOString(),
              createdAt: v.createdAt.toISOString(),
              validatedById: v.validatedById,
              validatedByName: v.validatedBy.name,
              comment: v.comment,
              actionLabel: v.action.keyPoint ?? v.action.externalId,
              teamName: v.team?.name ?? null,
            }))}
            currentUserId={u.id}
            currentUserRole={u.role}
          />
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
            <Icon.MessageSquare className="w-4 h-4 text-indigo-600" /> Historique
            « Vu » / commentaires
            <span className="text-[11px] font-mono text-slate-400">
              {sightings.length}
            </span>
          </h2>
          <ul className="grid gap-2">
            {sightings.map((s) => (
              <li key={s.id} className="card px-3.5 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      s.kind === "NOTE"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {s.kind === "NOTE" ? "COMMENTAIRE" : "VU"}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {format(s.sightedAt, "PPp", { locale: fr })} ·{" "}
                    {s.observer.name}
                  </span>
                  <TeamBadge name={s.team?.name} />
                </div>
                {s.comment && (
                  <div className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap">
                    {s.comment}
                  </div>
                )}
                {s.photos.length > 0 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                    {s.photos.map((p) => (
                      <a
                        key={p.id}
                        href={`/api/photos/${p.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 w-16 h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/photos/${p.id}/file`}
                          alt={p.legend ?? ""}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {!sightings.length && (
              <li className="text-xs text-slate-500">
                Aucun « Vu » ni commentaire enregistré.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * Petit badge d'équipe — affiché sur chaque élément de la fiche agent pour
 * lever l'ambiguïté d'origine quand l'agent est rattaché à plusieurs équipes.
 */
function TeamBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return (
    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
      {name}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "warn" | "info";
}) {
  const cls =
    tone === "warn"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : tone === "info"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-indigo-50 text-indigo-700 border-indigo-200";
  return (
    <div className={`border rounded-xl px-3 py-3 ${cls}`}>
      <div className="text-2xl font-mono font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1.5 font-semibold">
        {label}
      </div>
    </div>
  );
}
