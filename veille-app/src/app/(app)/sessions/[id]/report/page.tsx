import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return <ReportClient sessionId={id} />;
}
