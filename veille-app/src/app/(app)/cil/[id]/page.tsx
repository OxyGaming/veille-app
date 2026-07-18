import { notFound, redirect } from "next/navigation";
import { getSessionUser, assertTeamAccess } from "@/lib/auth";
import { loadIncidentFull, serializeIncident } from "@/lib/cil/repo";
import CilDashboard from "./CilDashboard";

export const dynamic = "force-dynamic";

export default async function CilDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const { id } = await params;
  const row = await loadIncidentFull(id);
  if (!row || !assertTeamAccess(u, row.teamId)) notFound();
  return <CilDashboard initial={serializeIncident(row)} role={u.role} />;
}
