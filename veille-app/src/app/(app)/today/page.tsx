import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";
import { aggregateToday } from "@/lib/today/aggregator";
import { TodayHeader } from "./components/TodayHeader";
import { CurrentWorkCard } from "./components/CurrentWorkCard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  if (!isTodayEnabled()) redirect("/procedures");
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const payload = await aggregateToday(user);

  return (
    <div className="pb-8 max-w-5xl mx-auto">
      <TodayHeader payload={payload} />

      {payload.role === "USER" && (
        <CurrentWorkCard current={payload.current} />
      )}

      {/* Placeholders pour les sections livrées en C5-C10. Volontairement
          discrets : un fond gris clair + libellé court. Aucun contenu fictif. */}
      <Placeholder role={payload.role} />
    </div>
  );
}

function Placeholder({ role }: { role: "USER" | "EDITOR" | "ADMIN" }) {
  const items: Record<typeof role, string[]> = {
    USER: [
      "À traiter aujourd'hui (C5)",
      "Raccourcis (C6)",
      "Dernières activités (C6)",
    ],
    EDITOR: [
      "Bannière diagnostic (C7)",
      "Compteurs hebdo (C8)",
      "Agents à veiller & Sites sans visite (C9)",
    ],
    ADMIN: [
      "État système & alertes (C10)",
      "Usage 7j (C10)",
      "Activité récente (C10)",
    ],
  };
  return (
    <div className="px-4 lg:px-8 mt-6 space-y-3">
      {items[role].map((label) => (
        <div
          key={label}
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500"
        >
          {label}
        </div>
      ))}
    </div>
  );
}
