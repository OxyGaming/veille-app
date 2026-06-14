import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { isTodayEnabled } from "@/lib/featureFlags";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      }}
      todayEnabled={isTodayEnabled()}
    >
      {children}
    </AppShell>
  );
}
