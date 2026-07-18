import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import NewCilClient from "./NewCilClient";

export const dynamic = "force-dynamic";

export default async function NewCilPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return <NewCilClient defaultCilName={u.name} />;
}
