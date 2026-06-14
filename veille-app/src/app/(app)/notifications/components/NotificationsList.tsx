"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type {
  NotificationItem,
  NotificationsPayload,
} from "@/lib/notifications-aggregator";

type Props = {
  initial: NotificationsPayload;
};

type Filter = "all" | "unread" | "read";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "unread", label: "Non lues" },
  { value: "read", label: "Lues" },
];

/**
 * Liste interactive du Centre de notifications (Sprint 5 C5).
 *
 * - filtre (chips)
 * - actions « Tout marquer comme lu » (bulk) et marquage individuel au clic
 * - pagination « Afficher 25 de plus » via cursor (no full reload)
 * - mise à jour optimiste : on bascule readAt local AVANT la confirmation
 *   serveur, on rollback si erreur
 */
export function NotificationsList({ initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initial.nextCursor,
  );
  const [unreadCount, setUnreadCount] = useState<number>(initial.unreadCount);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  async function changeFilter(next: Filter) {
    if (next === filter) return;
    setFilter(next);
    const r = await fetch(`/api/notifications?filter=${next}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return;
    const data: NotificationsPayload = await r.json();
    setItems(data.items);
    setNextCursor(data.nextCursor);
    setUnreadCount(data.unreadCount);
  }

  async function loadMore() {
    if (!nextCursor || pending) return;
    const r = await fetch(
      `/api/notifications?filter=${filter}&cursor=${nextCursor}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!r.ok) return;
    const data: NotificationsPayload = await r.json();
    setItems((prev) => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
    // unreadCount peut avoir bougé entre temps — on resynchronise
    setUnreadCount(data.unreadCount);
  }

  async function markOne(id: string) {
    // Optimistic update
    let wasUnread = false;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        wasUnread = it.readAt === null;
        return { ...it, readAt: new Date().toISOString() };
      }),
    );
    if (wasUnread) setUnreadCount((n) => Math.max(0, n - 1));
    try {
      const r = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("read failed");
    } catch {
      // Rollback simple : on refresh la liste côté serveur
      router.refresh();
    }
  }

  async function markAll() {
    if (unreadCount === 0) return;
    // Optimistic
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) => (it.readAt === null ? { ...it, readAt: now } : it)),
    );
    setUnreadCount(0);
    try {
      await fetch(`/api/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      router.refresh();
    }
  }

  function handleClick(item: NotificationItem) {
    // Marquage en arrière-plan, navigation immédiate via Link.
    startTransition(() => {
      void markOne(item.id);
    });
  }

  return (
    <section className="px-4 lg:px-8 mt-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => changeFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={unreadCount === 0}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Tout marquer comme lu
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 text-center">
          {filter === "unread"
            ? "Aucune notification non lue."
            : filter === "read"
              ? "Aucune notification lue."
              : "Aucune notification."}
        </div>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onActivate={() => handleClick(item)}
            />
          ))}
        </ul>
      )}

      {nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Afficher 25 de plus
          </button>
        </div>
      )}
    </section>
  );
}

const KIND_DOT: Record<string, string> = {
  ACTION_ASSIGNED_TO_ME: "bg-indigo-500",
  ACTION_VALIDATED_ON_MY_ACTION: "bg-emerald-500",
  VISIT_FINISHED_ON_MY_SITE: "bg-violet-500",
  ECHEANCE_CRITICAL_ON_MY_PERIMETER: "bg-red-500",
};

function NotificationRow({
  item,
  onActivate,
}: {
  item: NotificationItem;
  onActivate: () => void;
}) {
  const isUnread = item.readAt === null;
  const dot = KIND_DOT[item.type] ?? "bg-slate-400";
  const dateLabel = formatRelative(new Date(item.createdAt));
  const inner = (
    <div
      className={`flex items-start gap-3 px-3 py-3 transition-colors ${
        isUnread ? "bg-indigo-50/30" : ""
      } hover:bg-slate-50`}
    >
      <span
        className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${
          isUnread ? dot : "bg-transparent border border-slate-300"
        }`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug truncate ${
            isUnread ? "font-semibold text-slate-900" : "text-slate-700"
          }`}
        >
          {item.title}
        </p>
        <p className="text-[12px] text-slate-600 leading-snug line-clamp-2 mt-0.5">
          {item.message}
        </p>
        <p className="mt-1 text-[10px] font-mono text-slate-500">
          {dateLabel}
        </p>
      </div>
      {item.targetUrl && (
        <Icon.ChevronRight
          className="shrink-0 w-4 h-4 text-slate-400 mt-1"
          aria-hidden
        />
      )}
    </div>
  );

  if (item.targetUrl) {
    return (
      <li>
        <Link
          href={item.targetUrl}
          onClick={onActivate}
          aria-label={isUnread ? `${item.title} — non lue` : item.title}
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        className="w-full text-left"
        aria-label={isUnread ? `${item.title} — non lue` : item.title}
      >
        {inner}
      </button>
    </li>
  );
}

function formatRelative(at: Date): string {
  const now = Date.now();
  const diffMs = now - at.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(at);
}
