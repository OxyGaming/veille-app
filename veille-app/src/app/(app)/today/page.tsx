import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";
import { aggregateToday } from "@/lib/today/aggregator";
import { TodayHeader } from "./components/TodayHeader";
import { CurrentWorkCard } from "./components/CurrentWorkCard";
import { TodoSection } from "./components/TodoSection";
import { EditorDashboard } from "./components/EditorDashboard";

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
        <>
          <CurrentWorkCard current={payload.current} />
          <TodoSection items={payload.todoList} total={payload.todoTotal} />
        </>
      )}

      {payload.role === "EDITOR" && <EditorDashboard payload={payload} />}

      {/* Placeholders pour les sections restant à livrer. */}
      <Placeholder role={payload.role} />
    </div>
  );
}

function Placeholder({ role }: { role: "USER" | "EDITOR" | "ADMIN" }) {
  const items: Record<typeof role, string[]> = {
    USER: ["Raccourcis (C9)", "Dernières activités (C9)"],
    EDITOR: ["Agents à veiller & Sites sans visite (C8)"],
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
