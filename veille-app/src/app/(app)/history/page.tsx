import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return <HistoryClient userRole={u.role} />;
}
