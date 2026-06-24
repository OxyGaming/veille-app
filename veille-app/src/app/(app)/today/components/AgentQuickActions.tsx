"use client";

/**
 * Actions rapides Vu + Commentaire sur un agent — utilisé par la
 * section "Agents en service" de la vue Aujourd'hui (C11).
 *
 * - Vu (Icon.Eye)         → ouvre SightingModal (kind=SIGHT, commentaire
 *                           optionnel). Comportement IDENTIQUE à la fiche
 *                           agent : pas d'action 1-clic, le user doit
 *                           confirmer pour éviter les faux positifs.
 * - Commentaire (MessageSquare) → ouvre NoteModal (kind=NOTE, commentaire
 *                           obligatoire, photos optionnelles).
 *
 * Les deux modals sont les composants partagés `@/components/*` —
 * pas de duplication de logique avec AgentActionsClient.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import NoteModal from "@/components/NoteModal";
import SightingModal from "@/components/SightingModal";

type Props = {
  agentId: string;
  agentName: string;
};

export function AgentQuickActions({ agentId, agentName }: Props) {
  const router = useRouter();
  const [sighting, setSighting] = useState(false);
  const [noting, setNoting] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setSighting(true)}
        className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 w-9 h-9"
        title={`Marquer ${agentName} comme vu`}
        aria-label={`Marquer ${agentName} comme vu`}
      >
        <Icon.Eye className="w-4 h-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setNoting(true)}
        className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 w-9 h-9"
        title={`Ajouter un commentaire à ${agentName}`}
        aria-label={`Ajouter un commentaire à ${agentName}`}
      >
        <Icon.MessageSquare className="w-4 h-4" aria-hidden />
      </button>

      {sighting && (
        <SightingModal
          targetId={agentId}
          targetName={agentName}
          targetKind="agent"
          onClose={() => setSighting(false)}
          onCreated={() => {
            setSighting(false);
            toast.success(`${agentName} marqué comme vu.`);
            startTransition(() => router.refresh());
          }}
        />
      )}
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
