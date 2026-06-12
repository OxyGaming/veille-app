import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/icons";
import ImportExportToolbar from "./ImportExportToolbar";

export const dynamic = "force-dynamic";

export default async function AdminProceduresPage() {
  const procs = await prisma.procedure.findMany({
    where: { isActive: true },
    orderBy: [{ domain: "asc" }, { sortOrder: "asc" }],
    include: {
      _count: { select: { items: { where: { isActive: true } } } },
    },
  });
  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procédures</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {procs.length} procédure(s) active(s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportToolbar />
          <Link href="/admin/procedures/new" className="btn btn-primary">
            <Icon.Plus className="w-4 h-4" /> Nouvelle procédure
          </Link>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Domaine</th>
              <th className="text-left px-4 py-2.5">Thème</th>
              <th className="text-left px-4 py-2.5">Titre</th>
              <th className="text-center px-4 py-2.5">Gravité</th>
              <th className="text-center px-4 py-2.5">Points</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {procs.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5 text-xs">{p.domain}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{p.theme}</td>
                <td className="px-4 py-2.5 font-medium">{p.title}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`gpill g${p.gravity}`}>
                    {p.gravity === 0 ? "NT" : `G${p.gravity}`}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center font-mono">
                  {p._count.items}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/procedures/${p.id}`}
                    className="text-indigo-600 hover:text-indigo-800 text-xs inline-flex items-center gap-1"
                  >
                    <Icon.FileEdit className="w-3 h-3" /> Modifier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
