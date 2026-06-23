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
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { aggregateNotifications } from "@/lib/notifications-aggregator";
import { EnablePushBanner } from "@/components/push/EnablePushBanner";
import { NotificationsList } from "./components/NotificationsList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const initial = await aggregateNotifications(user.id, { filter: "all" });
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <header className="px-4 lg:px-8 pt-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Personnel
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Notifications
          </h1>
        </div>
        <Link
          href="/account/notifications"
          className="self-end rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Préférences
        </Link>
      </header>
      <div className="px-4 lg:px-8 pt-4">
        <EnablePushBanner />
      </div>
      <NotificationsList initial={initial} />
    </div>
  );
}
