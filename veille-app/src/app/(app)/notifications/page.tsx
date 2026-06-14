/**
 * Centre de notifications personnel (Sprint 5 C5).
 *
 * Server Component : appel direct `aggregateNotifications` (pas de
 * fetch HTTP), même pattern que `/today` et `/echeances`.
 *
 * Accessible aux 3 rôles (D2). La liste, le marquage et la pagination
 * « Afficher 25 de plus » sont délégués au Client Component
 * `NotificationsList`.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { aggregateNotifications } from "@/lib/notifications-aggregator";
import { NotificationsList } from "./components/NotificationsList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const initial = await aggregateNotifications(user.id, { filter: "all" });
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Personnel
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          Notifications
        </h1>
      </header>
      <NotificationsList initial={initial} />
    </div>
  );
}
