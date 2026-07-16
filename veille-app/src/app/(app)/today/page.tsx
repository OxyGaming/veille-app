import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";
import { aggregateToday } from "@/lib/today/aggregator";
import { formatFrenchDayLabel, parseDateParam } from "@/lib/today/date-nav";
import { TodayHeader } from "./components/TodayHeader";
import { CurrentWorkCard } from "./components/CurrentWorkCard";
import { TodoSection } from "./components/TodoSection";
import { EditorDashboard } from "./components/EditorDashboard";
import { UserShortcuts } from "./components/UserShortcuts";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { AdminDashboard } from "./components/AdminDashboard";
import { TodayAutoRefresh } from "./components/TodayAutoRefresh";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!isTodayEnabled()) redirect("/procedures");
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { date } = await searchParams;
  const viewedDateStr = parseDateParam(date);
  const payload = await aggregateToday(user, new Date(), viewedDateStr);

  return (
    <div className="pb-8 max-w-5xl mx-auto">
      <TodayHeader payload={payload} />

      {payload.role === "USER" && (
        <>
          <CurrentWorkCard current={payload.current} />
          <TodoSection items={payload.todoList} total={payload.todoTotal} />
          <UserShortcuts />
          <RecentActivitySection
            items={payload.recent}
            title={
              payload.isToday
                ? "Dernières activités"
                : `Activité du ${formatFrenchDayLabel(payload.viewedDate)}`
            }
            emptyMessage={
              payload.isToday ? undefined : "Aucune activité ce jour-là."
            }
          />
        </>
      )}

      {payload.role === "EDITOR" && (
        <EditorDashboard
          payload={payload}
          canImportPlanning={user.role === "ADMIN"}
        />
      )}

      {payload.role === "ADMIN" && <AdminDashboard payload={payload} />}

      {/* Refresh intelligent — 60 s + visibilitychange + online (C11). */}
      <TodayAutoRefresh />
    </div>
  );
}
