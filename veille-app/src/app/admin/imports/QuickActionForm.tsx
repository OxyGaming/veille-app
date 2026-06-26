"use client";

import { useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { TagInput } from "@/components/TagChips";
import AgentMultiPicker from "@/components/AgentMultiPicker";

type Agent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  teamIds: string[];
};
type Team = { id: string; name: string };
type Result = {
  externalId: string;
  title: string;
  dueAt: string;
  agentsCount: number;
  tags: string[];
};

/**
 * Création rapide d'une action.
 *  - tags libres (multi) — défaut : ["veille légale", "obligatoire"] modifiables ;
 *  - agents cibles : multi-select avec filtres équipes, recherche, tout/rien ;
 *  - échéance : défaut M+7.
 */
export default function QuickActionForm({
  agents,
  teams,
  defaultTeamId = null,
}: {
  agents: Agent[];
  teams: Team[];
  defaultTeamId?: string | null;
}) {
  const defaultDue = format(addMonths(new Date(), 7), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [tags, setTags] = useState<string[]>(["veille légale", "obligatoire"]);
  const [showOptions, setShowOptions] = useState(false);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  // Équipe cible : l'action est créée DANS cette équipe, pour des agents qui
  // en sont membres. Évite d'assigner un teamId à des agents d'une autre équipe
  // (action invisible côté fiche, cf. cloisonnement).
  const [teamId, setTeamId] = useState<string>(
    defaultTeamId && teams.some((t) => t.id === defaultTeamId)
      ? defaultTeamId
      : teams[0]?.id ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Agents proposables = ceux rattachés à l'équipe cible uniquement.
  const teamAgents = useMemo(
    () => (teamId ? agents.filter((a) => a.teamIds.includes(teamId)) : []),
    [agents, teamId]
  );

  function changeTeam(next: string) {
    setTeamId(next);
    // Le vivier d'agents change → on repart d'une sélection vide pour ne pas
    // conserver des agents hors de la nouvelle équipe.
    setAgentIds([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!teamId) {
      setError("Sélectionnez une équipe cible.");
      return;
    }
    if (!agentIds.length) {
      setError("Sélectionnez au moins un agent dans « Plus d'options ».");
      setShowOptions(true);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/actions/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueAt: new Date(dueAt + "T00:00:00").toISOString(),
          tags,
          agentIds,
          teamId,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Échec de la création");
        return;
      }
      setResult(j);
      setTitle("");
      setDueAt(defaultDue);
      setTags(["veille légale", "obligatoire"]);
      setShowOptions(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 grid place-items-center shrink-0">
          <Icon.AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">Création rapide d&apos;action</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Diffuse une action vers les agents sélectionnés. Tags libres,
            agents/équipes au choix.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Titre <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Renouvellement habilitation S0 — campagne 2026"
            className="input"
            maxLength={300}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Équipe cible <span className="text-rose-600">*</span>
          </label>
          {teams.length === 0 ? (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Aucune équipe disponible.
            </div>
          ) : (
            <select
              value={teamId}
              onChange={(e) => changeTeam(e.target.value)}
              className="input"
              required
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Tags
          </label>
          <TagInput
            tags={tags}
            onChange={setTags}
            placeholder="Tag libre (Entrée pour valider)…"
          />
          <div className="text-[10px] text-slate-400 mt-1">
            Exemples : veille légale, obligatoire, sécurité, suivi DPX,
            compétence, terrain…
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
        >
          {showOptions ? "▴" : "▾"} {showOptions ? "Masquer" : "Plus d'options"}
        </button>

        {showOptions && (
          <div className="grid grid-cols-1 gap-3 animate-in border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Échéance{" "}
                <span className="text-[10px] font-mono text-slate-400">
                  (défaut M+7)
                </span>
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="input"
              />
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                {format(new Date(dueAt + "T00:00:00"), "PPPP", { locale: fr })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Agents impactés
              </label>
              <AgentMultiPicker
                agents={teamAgents}
                teams={teams.filter((t) => t.id === teamId)}
                value={agentIds}
                onChange={setAgentIds}
                initialMode="all"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || busy}
            className="btn btn-primary"
          >
            <Icon.Plus className="w-4 h-4" />
            {busy
              ? "Création…"
              : `Créer pour ${agentIds.length || teamAgents.length} agent${
                  (agentIds.length || teamAgents.length) > 1 ? "s" : ""
                }`}
          </button>
          {!showOptions && (
            <span className="text-[11px] text-slate-500 font-mono">
              Échéance :{" "}
              {format(new Date(dueAt + "T00:00:00"), "P", { locale: fr })}
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon.Check className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>« {result.title} »</b> créée pour {result.agentsCount} agent(s)
            — échéance {format(new Date(result.dueAt), "P", { locale: fr })}
            {result.tags.length > 0 && (
              <>
                {" · tags : "}
                {result.tags.join(", ")}
              </>
            )}
            .
          </div>
        </div>
      )}
    </div>
  );
}
