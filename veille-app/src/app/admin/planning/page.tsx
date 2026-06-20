import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlanningImportClient from "./PlanningImportClient";

export const dynamic = "force-dynamic";

export default async function AdminPlanningPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // Cohérent avec le layout admin + la route API : ADMIN strict (le layout
  // laisse passer EDITOR mais on ferme cette page sous ADMIN uniquement).
  if (u.role !== "ADMIN") redirect("/admin");

  // Un seul PlanningImport est en base à un instant T (overwrite), mais on
  // utilise findFirst pour rester robuste si une partie d'une transaction
  // échoue un jour.
  const current = await prisma.planningImport.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      importedBy: { select: { name: true, email: true } },
      _count: { select: { shifts: true } },
    },
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Planning agents</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Téléversez le tour de service ferroviaire (ODS / XLSX). Seules les
          lignes en SERVICE sont enregistrées ; les NPO sont comptées mais
          jamais persistées. Un nouvel import remplace intégralement le
          précédent.
        </p>
      </div>

      <PlanningImportClient />

      <h2 className="text-base font-bold mt-8 mb-2">Import actuel</h2>
      {current ? (
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field
              label="Fichier"
              value={current.fileName ?? "—"}
              mono
            />
            <Field
              label="Importé le"
              value={format(current.createdAt, "Pp", { locale: fr })}
            />
            <Field
              label="Importé par"
              value={
                current.importedBy?.name ??
                current.importedBy?.email ??
                "—"
              }
            />
            <Field label="Shifts en base" value={String(current._count.shifts)} mono />
            <Field
              label="Période début"
              value={
                current.periodStart
                  ? format(current.periodStart, "PPP", { locale: fr })
                  : "—"
              }
            />
            <Field
              label="Période fin"
              value={
                current.periodEnd
                  ? format(current.periodEnd, "PPP", { locale: fr })
                  : "—"
              }
            />
            <Field label="Lignes SERVICE" value={String(current.rowsService)} mono />
            <Field label="Lignes NPO (non stockées)" value={String(current.rowsNonService)} mono />
            <Field label="Importées (matricule connu)" value={String(current.rowsImported)} mono />
            <Field label="Ignorées (matricule inconnu)" value={String(current.rowsIgnored)} mono />
            <Field label="Erreurs de parsing" value={String(current.rowsErrored)} mono />
            <Field label="Total lignes lues" value={String(current.rowsTotal)} mono />
          </div>
        </div>
      ) : (
        <div className="card p-6 text-sm text-slate-500 text-center">
          Aucun planning importé pour l&apos;instant.
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
      <div className={mono ? "text-sm font-mono" : "text-sm"}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
}
