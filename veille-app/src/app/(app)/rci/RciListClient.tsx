"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";

type Item = {
  id: string;
  status: string;
  title: string | null;
  dossierNumber: string | null;
  eventAt: string | null;
  updatedAt: string;
  authorName: string;
  teamName: string;
  photoCount: number;
};

export default function RciListClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const drafts = items.filter((r) => r.status === "DRAFT");
  const finals = items.filter((r) => r.status === "FINAL");

  async function createNew() {
    setCreating(true);
    try {
      const res = await fetch("/api/rci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Création impossible");
        return;
      }
      const created = await res.json();
      router.push(`/rci/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce brouillon RCI ? Cette action est irréversible."))
      return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/rci/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Suppression impossible");
        return;
      }
      toast.success("Brouillon supprimé");
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto">
      <header className="card p-5 lg:p-6 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Icon.AlertTriangle className="w-5 h-5 text-amber-600" /> RCI
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Relevés de Constatations Immédiates — partie 1 « Avis immédiat »
              (à transmettre sous 12 h au Pôle Sécurité EIC RAL).
            </p>
          </div>
          <button
            type="button"
            onClick={createNew}
            disabled={creating}
            className="btn btn-primary shrink-0"
          >
            <Icon.Plus className="w-4 h-4" />
            {creating ? "Création…" : "Nouveau RCI"}
          </button>
        </div>
      </header>

      <Section
        title="Brouillons"
        count={drafts.length}
        emptyLabel="Aucun brouillon en cours."
      >
        {drafts.map((r) => (
          <RciRow
            key={r.id}
            r={r}
            onDelete={() => remove(r.id)}
            deleting={deleting === r.id}
          />
        ))}
      </Section>

      {finals.length > 0 && (
        <Section
          title="Finalisés"
          count={finals.length}
          emptyLabel="Aucun RCI finalisé."
        >
          {finals.map((r) => (
            <RciRow key={r.id} r={r} readOnly />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold mb-2.5 flex items-center gap-2">
        {title}
        <span className="text-[11px] font-mono text-slate-400">{count}</span>
      </h2>
      {count === 0 ? (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-6 text-center">
          {emptyLabel}
        </div>
      ) : (
        <ul className="grid gap-2">{children}</ul>
      )}
    </section>
  );
}

function RciRow({
  r,
  onDelete,
  deleting,
  readOnly = false,
}: {
  r: Item;
  onDelete?: () => void;
  deleting?: boolean;
  readOnly?: boolean;
}) {
  const event = r.eventAt ? new Date(r.eventAt) : null;
  return (
    <li className="card px-3.5 py-3 flex items-start gap-3">
      <Link href={`/rci/${r.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {r.status === "FINAL" && (
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              FINALISÉ
            </span>
          )}
          {r.dossierNumber && (
            <span className="text-[11px] font-mono text-slate-500">
              {r.dossierNumber}
            </span>
          )}
        </div>
        <div className="text-sm font-semibold truncate">
          {r.title || <span className="text-slate-400 italic">Sans titre</span>}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {event && (
            <span>Événement : {format(event, "PPp", { locale: fr })}</span>
          )}
          <span>
            Modifié {format(new Date(r.updatedAt), "PPp", { locale: fr })}
          </span>
          <span>par {r.authorName}</span>
          <span>· {r.teamName}</span>
          {r.photoCount > 0 && <span>· {r.photoCount} photo(s)</span>}
        </div>
      </Link>
      {!readOnly && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Supprimer le brouillon"
          aria-label="Supprimer"
          className="text-slate-300 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors"
        >
          <Icon.X className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}
