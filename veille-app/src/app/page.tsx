import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isTodayEnabled() ? "/today" : "/procedures");
}
