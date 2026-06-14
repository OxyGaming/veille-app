"use client";

import { useState } from "react";
import type { AuditFilters, AuditItem } from "@/lib/audit-aggregator";

type Props = {
  initialItems: AuditItem[];
  initialNextCursor: string | null;
  filters: AuditFilters;
};

/**
 * Tableau dense desktop, cards mobile (Sprint 5 C6).
 * Pagination cursor via `/api/admin/audit?cursor=...&from=...`.
 * Détails JSON repliés par défaut.
 */
export function AuditTable({
  initialItems,
  initialNextCursor,
  filters,
}: Props) {
  const [items, setItems] = useState<AuditItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );

  async function loadMore() {
    if (!nextCursor) return;
    const qs = new URLSearchParams();
    qs.set("cursor", nextCursor);
    if (filters.userId) qs.set("userId", filters.userId);
    if (filters.action) qs.set("action", filters.action);
    if (filters.from)
      qs.set("from", filters.from.toISOString().slice(0, 10));
    if (filters.to) qs.set("to", filters.to.toISOString().slice(0, 10));
    const r = await fetch(`/api/admin/audit?${qs.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return;
    const data = await r.json();
    setItems((prev) => [...prev, ...(data.items as AuditItem[])]);
    setNextCursor(data.nextCursor ?? null);
  }

  if (items.length === 0) {
    return (
      <section className="px-4 lg:px-8 mt-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 text-center">
          Aucune entrée d'audit ne correspond aux filtres.
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 lg:px-8 mt-4">
      <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {items.map((item) => (
          <AuditRow key={item.id} item={item} />
        ))}
      </ul>
      {nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Afficher 50 de plus
          </button>
        </div>
      )}
    </section>
  );
}

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function AuditRow({ item }: { item: AuditItem }) {
  const [open, setOpen] = useState(false);
  const hasDetails = item.details !== null;
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            <span className="font-mono text-[11px] text-slate-500">
              {item.action}
            </span>
            {" — "}
            <span className="text-slate-700">{item.entity}</span>
            {item.entityId ? (
              <span className="font-mono text-[11px] text-slate-400">
                {" "}
                #{item.entityId.slice(-8)}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600 truncate">
            {item.userEmail ?? "—"} · {formatDateFr(item.createdAt)}
          </p>
          {open && hasDetails && (
            <pre className="mt-2 text-[11px] font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {typeof item.details === "string"
                ? item.details
                : JSON.stringify(item.details, null, 2)}
            </pre>
          )}
        </div>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 text-[11px] font-mono text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5"
          >
            {open ? "Masquer" : "Détails"}
          </button>
        )}
      </div>
    </li>
  );
}
