import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser, siteScope } from "@/lib/auth";
import AgentActionsClient from "@/app/(app)/agents/[id]/AgentActionsClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

function parseTagsField(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const site = await prisma.site.findFirst({
    where: { id, ...siteScope(u) },
    include: { memberships: { include: { team: true } } },
  });
  if (!site) notFound();

  const activeRaw = await prisma.importedAction.findMany({
    where: { siteId: id, localStatus: "ACTIVE" },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const visits = await prisma.siteVisit.findMany({
    where: { siteId: id },
    orderBy: { visitDate: "desc" },
    take: 20,
    include: {
      template: { select: { name: true } },
      _count: { select: { nonConformities: true } },
    },
  });
  const validated = await prisma.actionValidation.findMany({
    where: { siteId: id },
    orderBy: { realizedAt: "desc" },
    take: 30,
    include: { action: true, validatedBy: { select: { name: true } } },
  });

  const sightings = await prisma.siteSighting.findMany({
    where: { siteId: id },
    orderBy: { sightedAt: "desc" },
    take: 30,
    include: {
      observer: { select: { name: true } },
      photos: { select: { id: true, storagePath: true, legend: true } },
    },
  });

  const today = new Date();
  const sevenDays = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
  const lateCount = activeRaw.filter(
    (a) => a.dueAt && a.dueAt < today
  ).length;
  const soonCount = activeRaw.filter(
    (a) => a.dueAt && a.dueAt >= today && a.dueAt <= sevenDays
  ).length;

  // Réutilise AgentActionsClient (rendu identique, basé sur tags) :
  // on adapte la liste en passant les infos nécessaires.
  const actionsForClient = activeRaw.map((a) => ({
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
    tags: parseTagsField(a.tags),
  }));

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto">
      <header className="card p-5 lg:p-6">
        <Link
          href="/sites"
          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
        >
          <Icon.ChevronLeft className="w-3 h-3" /> Sites
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white text-2xl font-bold grid place-items-center shadow-sm shrink-0">
            🏛️
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
              {site.name}
            </h1>
            <div className="text-xs font-mono text-slate-500 mt-1 flex flex-wrap gap-2">
              {site.code && <span>{site.code}</span>}
              {site.type && <span>· {site.type}</span>}
              {site.memberships.map((m) => (
                <span
                  key={m.id}
                  className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded"
                >
                  {m.team.name}
                </span>
              ))}
            </div>
            {site.address && (
              <div className="text-xs text-slate-500 mt-1">{site.address}</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat
            label="Actions à traiter"
            value={activeRaw.length}
            tone="default"
          />
          <Stat label="En retard" value={lateCount} tone="warn" />
          <Stat label="< 7 jours" value={soonCount} tone="info" />
        </div>
        <div className="mt-4 flex gap-2">
          <Link href={`/visits/new`} className="btn btn-primary">
            <Icon.Plus className="w-4 h-4" /> Nouvelle visite
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
          <Icon.AlertTriangle className="w-4 h-4 text-amber-600" /> Actions à
          traiter
        </h2>
        <AgentActionsClient
          agentId={site.id}
          agentName={site.name}
          targetKind="site"
          actions={actionsForClient}
        />
      </section>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
            <Icon.ClipboardCheck className="w-4 h-4 text-indigo-600" /> Visites
          </h2>
          <ul className="grid gap-2">
            {visits.map((v) => (
              <li key={v.id} className="card px-3.5 py-2.5">
                <Link href={`/visits/${v.id}`} className="block">
                  <div className="text-[11px] font-mono text-slate-500">
                    {format(v.visitDate, "PPp", { locale: fr })}
                  </div>
                  <div className="text-sm font-semibold mt-0.5">
                    {v.template.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex gap-2">
                    <span>Statut : {v.status}</span>
                    {v._count.nonConformities > 0 && (
                      <span className="text-rose-700 font-semibold">
                        · {v._count.nonConformities} NC
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            {!visits.length && (
              <li className="text-xs text-slate-500">Aucune visite réalisée.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
            <Icon.Check className="w-4 h-4 text-emerald-600" /> Historique des
            validations
          </h2>
          <ul className="grid gap-2">
            {validated.map((v) => (
              <li key={v.id} className="card px-3.5 py-2.5">
                <div className="text-[11px] font-mono text-slate-500">
                  {format(v.realizedAt, "PPp", { locale: fr })} ·{" "}
                  {v.validatedBy.name}
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {v.action.keyPoint ?? v.action.externalId}
                </div>
                {v.comment && (
                  <div className="text-xs text-slate-600 mt-1">
                    « {v.comment} »
                  </div>
                )}
              </li>
            ))}
            {!validated.length && (
              <li className="text-xs text-slate-500">Aucune validation.</li>
            )}
          </ul>
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
                        href={p.storagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 w-16 h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.storagePath}
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
