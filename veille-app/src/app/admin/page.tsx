import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [users, teams, procs, sessions, actions, imports] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.procedure.count({ where: { isActive: true } }),
    prisma.veilleSession.count(),
    prisma.importedAction.count({ where: { localStatus: "ACTIVE" } }),
    prisma.actionImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { team: true },
    }),
  ]);
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Vue d&apos;ensemble de la plateforme.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Tile label="Utilisateurs" value={users} icon={Icon.Users} href="/admin/users" />
        <Tile label="Équipes" value={teams} icon={Icon.Building} href="/admin/teams" />
        <Tile label="Procédures" value={procs} icon={Icon.ClipboardCheck} href="/admin/procedures" />
        <Tile label="Sessions" value={sessions} icon={Icon.FileText} href="/sessions" />
        <Tile label="Actions actives" value={actions} icon={Icon.AlertTriangle} href="/admin/imports" />
      </div>

      <section className="mt-7">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold">Derniers imports</h2>
          <Link
            href="/admin/imports"
            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Voir l&apos;historique
          </Link>
        </div>
        <ul className="grid gap-2">
          {imports.map((i) => (
            <li key={i.id} className="card px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-mono text-slate-500">
                  {format(i.createdAt, "PPp", { locale: fr })} · {i.team?.name}
                </div>
                <div className="text-xs flex flex-wrap gap-2">
                  <Pill tone="ok">{i.rowsCreated} créées</Pill>
                  <Pill tone="info">{i.rowsUpdated} maj</Pill>
                  <Pill tone="warn">{i.rowsObsoleted} obsolètes</Pill>
                  <Pill tone="ok">{i.agentsCreated} agents</Pill>
                </div>
              </div>
              <div className="text-sm mt-1.5">{i.rowsTotal} lignes traitées</div>
            </li>
          ))}
          {!imports.length && (
            <li className="text-sm text-slate-500 px-4 py-6 text-center bg-slate-100 rounded-xl">
              Aucun import.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  icon: I,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card p-4 hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="text-2xl font-mono font-bold leading-none">{value}</div>
        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center">
          <I className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-2 font-medium">{label}</div>
    </Link>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "info" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "info"
      ? "bg-indigo-50 text-indigo-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {children}
    </span>
  );
}
