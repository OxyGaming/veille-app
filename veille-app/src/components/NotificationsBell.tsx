"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const POLL_INTERVAL_MS = 60_000;

/**
 * Badge Bell pour le header (Sprint 5 C5).
 *
 * Polling 60 s du compteur non-lues via `/api/notifications?limit=1`
 * (réutilise le `unreadCount` du payload de C4). Le `limit=1` minimise
 * le payload — on n'a besoin que du count, pas des items.
 *
 * Re-fetch également au changement de route (post navigation vers
 * `/notifications` notamment). Pas d'entrée bottom-nav (consigne PO).
 *
 * Si `pathname === "/notifications"`, on affiche un état actif (couleur
 * indigo) cohérent avec le reste de la nav.
 */
export function NotificationsBell({
  appearance = "header",
}: {
  appearance?: "header" | "sidebar";
}) {
  const [unread, setUnread] = useState<number>(0);
  const pathname = usePathname();
  const active = pathname?.startsWith("/notifications");

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const r = await fetch("/api/notifications?limit=1", {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as { unreadCount?: number };
        if (!cancelled && typeof d.unreadCount === "number") {
          setUnread(d.unreadCount);
        }
      } catch {
        /* silencieux : pas critique */
      }
    }
    fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pathname]);

  const label = `Notifications${unread > 0 ? ` — ${unread} non lue${unread > 1 ? "s" : ""}` : ""}`;
  const badge =
    unread > 0 ? (
      <span
        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none"
        aria-hidden
      >
        {unread > 99 ? "99+" : unread}
      </span>
    ) : null;

  const ringCls = appearance === "sidebar" ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-300 hover:text-white hover:bg-white/5";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        active ? "text-white bg-white/10" : ringCls
      }`}
    >
      <Icon.Bell className="w-4 h-4" />
      {badge}
    </Link>
  );
}
