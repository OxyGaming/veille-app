import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Sprint 8 C4 (+ C5) — Diagnostic de structure des équipes.
 *
 * Compte et liste les entités potentiellement orphelines OU
 * sur-affectées. Sécurité : ADMIN uniquement (le layout /admin
 * accepte EDITOR pour les autres sections mais le sprint 8 est
 * strictement ADMIN). EDITOR est redirigé vers /admin.
 *
 * Sections (C4) :
 *  - Utilisateurs sans équipe (0 lien UserTeam, exclut les inactifs).
 *  - Agents sans équipe (0 lien AgentTeam, exclut les archivés).
 *  - Sites sans équipe (0 lien SiteTeam, exclut les archivés).
 *  - Équipes vides (0 membre toutes catégories confondues).
 *
 * Sections (C5) — ajoutées dans la même page car partagent le contexte
 * et les fixtures :
 *  - Utilisateurs présents dans > X équipes (X = 5 par défaut).
 *  - Agents présents dans > X équipes.
 *  - Sites présents dans > X équipes.
 *
 * Aucun blocage — purement informatif. Liens de correction pointent
 * vers les pages d'admin existantes ou vers la fiche détail.
 */

const MULTI_TEAM_THRESHOLD = 5;

export default async function TeamsHealthPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN") redirect("/admin");

  const [
    orphanUsers,
    orphanAgents,
    orphanSites,
    emptyTeams,
    multiUsers,
    multiAgents,
    multiSites,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, memberships: { none: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.agent.findMany({
      where: { isActive: true, memberships: { none: {} } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        matricule: true,
        firstName: true,
        lastName: true,
        isVisible: true,
      },
    }),
    prisma.site.findMany({
      where: { isActive: true, memberships: { none: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, type: true },
    }),
    prisma.team.findMany({
      where: {
        userMemberships: { none: {} },
        agentMemberships: { none: {} },
        siteMemberships: { none: {} },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    }),
    findMultiTeamUsers(MULTI_TEAM_THRESHOLD),
    findMultiTeamAgents(MULTI_TEAM_THRESHOLD),
    findMultiTeamSites(MULTI_TEAM_THRESHOLD),
  ]);

  return (
    <div>
      <Link
        href="/admin/teams"
        className="text-xs text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 mb-2"
      >
        <Icon.ChevronLeft className="w-3.5 h-3.5" />
        Toutes les équipes
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Diagnostic des équipes
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Détecte les entités sans rattachement et les sur-affectations.
          Aucun blocage — signalements uniquement.
        </p>
      </div>

      {/* ── C4 : Manques ─────────────────────────────────────────────── */}
      <section className="mb-6">
        <SectionTitle
          title="Cloisonnement incomplet"
          subtitle="Entités sans aucun rattachement à une équipe."
          tone="warn"
        />
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          <HealthCard
            title="Utilisateurs sans équipe"
            count={orphanUsers.length}
            empty="Tous les utilisateurs actifs ont au moins une équipe."
          >
            <ul className="divide-y divide-slate-100">
              {orphanUsers.map((u) => (
                <ListRow
                  key={u.id}
                  primary={u.name}
                  secondary={`${u.email} · ${u.role}`}
                  fixHref="/admin/users"
                  fixLabel="Gérer"
                />
              ))}
            </ul>
          </HealthCard>
          <HealthCard
            title="Équipes vides"
            count={emptyTeams.length}
            empty="Toutes les équipes ont au moins un membre."
          >
            <ul className="divide-y divide-slate-100">
              {emptyTeams.map((t) => (
                <ListRow
                  key={t.id}
                  primary={t.name}
                  secondary={`${t.code ?? "—"} · ${t.isActive ? "Active" : "Inactive"}`}
                  fixHref={`/admin/teams/${t.id}`}
                  fixLabel="Ajouter des membres"
                />
              ))}
            </ul>
          </HealthCard>
          <HealthCard
            title="Agents sans équipe"
            count={orphanAgents.length}
            empty="Tous les agents actifs sont rattachés à au moins une équipe."
          >
            <ul className="divide-y divide-slate-100">
              {orphanAgents.map((a) => (
                <ListRow
                  key={a.id}
                  primary={`${a.lastName} ${a.firstName}`}
                  secondary={`${a.matricule}${a.isVisible ? "" : " · masqué"}`}
                  fixHref={`/agents/${a.id}`}
                  fixLabel="Fiche"
                />
              ))}
            </ul>
          </HealthCard>
          <HealthCard
            title="Sites sans équipe"
            count={orphanSites.length}
            empty="Tous les sites actifs sont rattachés à au moins une équipe."
          >
            <ul className="divide-y divide-slate-100">
              {orphanSites.map((s) => (
                <ListRow
                  key={s.id}
                  primary={s.name}
                  secondary={`${s.code ?? "—"}${s.type ? " · " + s.type : ""}`}
                  fixHref={`/sites/${s.id}`}
                  fixLabel="Fiche"
                />
              ))}
            </ul>
          </HealthCard>
        </div>
      </section>

      {/* ── C5 : Sur-affectations ────────────────────────────────────── */}
      <section className="mb-6">
        <SectionTitle
          title={`Sur-affectations (> ${MULTI_TEAM_THRESHOLD} équipes)`}
          subtitle="Possible erreur de paramétrage — vérifier le cloisonnement."
          tone="info"
        />
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
          <HealthCard
            title="Utilisateurs"
            count={multiUsers.length}
            empty="Aucun utilisateur n'est dans plus de 5 équipes."
          >
            <ul className="divide-y divide-slate-100">
              {multiUsers.map((u) => (
                <ListRow
                  key={u.id}
                  primary={u.name}
                  secondary={`${u.email} · ${u.teamCount} équipes`}
                  fixHref="/admin/users"
                  fixLabel="Vérifier"
                />
              ))}
            </ul>
          </HealthCard>
          <HealthCard
            title="Agents"
            count={multiAgents.length}
            empty="Aucun agent n'est dans plus de 5 équipes."
          >
            <ul className="divide-y divide-slate-100">
              {multiAgents.map((a) => (
                <ListRow
                  key={a.id}
                  primary={`${a.lastName} ${a.firstName}`}
                  secondary={`${a.matricule} · ${a.teamCount} équipes`}
                  fixHref={`/agents/${a.id}`}
                  fixLabel="Fiche"
                />
              ))}
            </ul>
          </HealthCard>
          <HealthCard
            title="Sites"
            count={multiSites.length}
            empty="Aucun site n'est dans plus de 5 équipes."
          >
            <ul className="divide-y divide-slate-100">
              {multiSites.map((s) => (
                <ListRow
                  key={s.id}
                  primary={s.name}
                  secondary={`${s.code ?? "—"} · ${s.teamCount} équipes`}
                  fixHref={`/sites/${s.id}`}
                  fixLabel="Fiche"
                />
              ))}
            </ul>
          </HealthCard>
        </div>
      </section>
    </div>
  );
}

/**
 * Helpers pour C5 — Prisma ne supporte pas le filtre `_count`
 * directement dans `where`, on filtre côté JS sur la liste agrégée.
 * À volumétrie admin (centaines d'entités max) c'est acceptable ;
 * si volumes ↗ on basculera sur un `$queryRaw` GROUP BY.
 */
async function findMultiTeamUsers(threshold: number) {
  const rows = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { memberships: true } },
    },
  });
  return rows
    .filter((r) => r._count.memberships > threshold)
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      teamCount: r._count.memberships,
    }))
    .sort((a, b) => b.teamCount - a.teamCount);
}

async function findMultiTeamAgents(threshold: number) {
  const rows = await prisma.agent.findMany({
    where: { isActive: true },
    select: {
      id: true,
      matricule: true,
      firstName: true,
      lastName: true,
      _count: { select: { memberships: true } },
    },
  });
  return rows
    .filter((r) => r._count.memberships > threshold)
    .map((r) => ({
      id: r.id,
      matricule: r.matricule,
      firstName: r.firstName,
      lastName: r.lastName,
      teamCount: r._count.memberships,
    }))
    .sort((a, b) => b.teamCount - a.teamCount);
}

async function findMultiTeamSites(threshold: number) {
  const rows = await prisma.site.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      _count: { select: { memberships: true } },
    },
  });
  return rows
    .filter((r) => r._count.memberships > threshold)
    .map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      teamCount: r._count.memberships,
    }))
    .sort((a, b) => b.teamCount - a.teamCount);
}

function SectionTitle({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: "warn" | "info";
}) {
  const cls =
    tone === "warn"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-indigo-700 bg-indigo-50 border-indigo-200";
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded border ${cls}`}
      >
        <Icon.AlertTriangle className="w-3.5 h-3.5" />
      </span>
      <div>
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function HealthCard({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="text-sm font-semibold flex-1 min-w-0 truncate">
          {title}
        </div>
        <span
          className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            count === 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {count}
        </span>
      </header>
      {count === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-emerald-700 bg-emerald-50/30 flex-1">
          <Icon.Check className="w-4 h-4 inline-block mr-1 text-emerald-600" />
          {empty}
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}

function ListRow({
  primary,
  secondary,
  fixHref,
  fixLabel,
}: {
  primary: string;
  secondary: string;
  fixHref: string;
  fixLabel: string;
}) {
  return (
    <li className="px-4 py-2 flex items-center gap-3 min-w-0 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{primary}</div>
        <div className="text-[11px] font-mono text-slate-500 truncate">
          {secondary}
        </div>
      </div>
      <Link
        href={fixHref}
        className="shrink-0 text-[11px] text-indigo-600 hover:text-indigo-800 underline"
      >
        {fixLabel}
      </Link>
    </li>
  );
}
