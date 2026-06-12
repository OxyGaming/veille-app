import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import StatsClient from "./StatsClient";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return <StatsClient />;
}
