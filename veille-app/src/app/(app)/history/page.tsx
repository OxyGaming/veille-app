import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return (
    // `HistoryClient` lit `useSearchParams()` (filtre Icare synchronisé dans
    // l'URL) — Next.js exige une frontière Suspense autour de tout composant
    // qui l'utilise.
    <Suspense fallback={null}>
      <HistoryClient userRole={u.role} />
    </Suspense>
  );
}
