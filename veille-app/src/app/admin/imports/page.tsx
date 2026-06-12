import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { agentScope, getSessionUser } from "@/lib/auth";
import ImportClient from "./ImportClient";
import QuickActionForm from "./QuickActionForm";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const u = await getSessionUser();
  const [recent, agents, teams] = await Promise.all([
    prisma.actionImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { team: true },
    }),
    u
      ? prisma.agent.findMany({
          where: { isActive: true, isVisible: true, ...agentScope(u) },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: { memberships: { select: { teamId: true } } },
        })
      : Promise.resolve([]),
    u?.role === "ADMIN" || u?.viewAllTeams
      ? prisma.team.findMany({ orderBy: { name: "asc" } })
      : u
      ? prisma.team.findMany({
          where: { id: { in: u.teamIds } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const agentsForPicker = agents.map((a) => ({
    id: a.id,
    matricule: a.matricule,
    firstName: a.firstName,
    lastName: a.lastName,
    teamIds: a.memberships.map((m) => m.teamId),
  }));
  const teamsForPicker = teams.map((t) => ({ id: t.id, name: t.name }));
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Imports actions</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Téléversez le fichier Excel hebdomadaire ou créez une action à la
          volée pour toute l&apos;équipe.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <QuickActionForm agents={agentsForPicker} teams={teamsForPicker} />
        <ImportClient />
      </div>

      <h2 className="text-base font-bold mt-8 mb-2">Historique</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Équipe</th>
              <th className="text-right px-4 py-2.5">Lignes</th>
              <th className="text-right px-4 py-2.5">Créées</th>
              <th className="text-right px-4 py-2.5">MAJ</th>
              <th className="text-right px-4 py-2.5">Obsolètes</th>
              <th className="text-right px-4 py-2.5">Agents +</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-xs font-mono">
                  {format(r.createdAt, "Pp", { locale: fr })}
                </td>
                <td className="px-4 py-2.5">{r.team?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono">{r.rowsTotal}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {r.rowsCreated}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {r.rowsUpdated}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {r.rowsObsoleted}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {r.agentsCreated}
                </td>
              </tr>
            ))}
            {!recent.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Aucun import à afficher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
