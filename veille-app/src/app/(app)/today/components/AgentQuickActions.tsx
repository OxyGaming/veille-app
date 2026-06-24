"use client";

/**
 * Actions rapides Vu + Commentaire sur un agent — utilisé par la
 * section "Agents en service" de la vue Aujourd'hui (C11).
 *
 * - Vu (Icon.Eye)        → POST /api/agents/[id]/sight kind=SIGHT
 *                          en 1 clic, toast de confirmation, refresh.
 * - Commentaire (Icon.MessageSquare) → ouvre NoteModal (kind=NOTE,
 *                          commentaire obligatoire, photos optionnelles).
 *
 * Pas de modal pour Vu : ergonomie liste — un croisement rapide doit
 * être 1 clic. Si l'observateur veut commenter, il utilise l'autre bouton.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import NoteModal from "@/components/NoteModal";

type Props = {
  agentId: string;
  agentName: string;
};

export function AgentQuickActions({ agentId, agentName }: Props) {
  const router = useRouter();
  const [noting, setNoting] = useState(false);
  const [pending, startTransition] = useTransition();

  async function markSeen() {
    if (pending) return;
    try {
      const r = await fetch(`/api/agents/${agentId}/sight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind: "SIGHT", comment: null }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error || "Vu non enregistré.");
        return;
      }
      toast.success(`${agentName} marqué comme vu.`);
      startTransition(() => router.refresh());
    } catch {
      toast.error("Vu non enregistré.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={markSeen}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 min-h-[36px]"
        title={`Marquer ${agentName} comme vu`}
        aria-label={`Marquer ${agentName} comme vu`}
      >
        <Icon.Eye className="w-4 h-4" aria-hidden />
        <span className="hidden md:inline">Vu</span>
      </button>
      <button
        type="button"
        onClick={() => setNoting(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 min-h-[36px]"
        title={`Ajouter un commentaire à ${agentName}`}
        aria-label={`Ajouter un commentaire à ${agentName}`}
      >
        <Icon.MessageSquare className="w-4 h-4" aria-hidden />
        <span className="hidden md:inline">Comm.</span>
      </button>

      {noting && (
        <NoteModal
          target="agent"
          targetId={agentId}
          targetName={agentName}
          onClose={() => setNoting(false)}
          onCreated={() => {
            setNoting(false);
            toast.success("Commentaire enregistré.");
            startTransition(() => router.refresh());
          }}
        />
      )}
    </>
  );
}
