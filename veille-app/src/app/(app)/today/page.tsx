import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";
import { aggregateToday } from "@/lib/today/aggregator";
import { TodayHeader } from "./components/TodayHeader";
import { CurrentWorkCard } from "./components/CurrentWorkCard";
import { TodoSection } from "./components/TodoSection";
import { EditorDashboard } from "./components/EditorDashboard";
import { UserShortcuts } from "./components/UserShortcuts";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { AdminDashboard } from "./components/AdminDashboard";
import { TodayAutoRefresh } from "./components/TodayAutoRefresh";

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
          <UserShortcuts />
          <RecentActivitySection items={payload.recent} />
        </>
      )}

      {payload.role === "EDITOR" && <EditorDashboard payload={payload} />}

      {payload.role === "ADMIN" && <AdminDashboard payload={payload} />}

      {/* Refresh intelligent — 60 s + visibilitychange + online (C11). */}
      <TodayAutoRefresh />
    </div>
  );
}
