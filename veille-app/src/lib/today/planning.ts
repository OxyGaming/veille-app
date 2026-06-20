/**
 * Source de données — "Agents en service aujourd'hui" pour la page /today.
 *
 * **Règle critique** : le planning sert UNIQUEMENT à enrichir des agents déjà
 * scopés via les helpers Veille existants. Le cloisonnement reste
 * `Utilisateur → Team Veille → AgentTeam → Agent`. UCH / UCH JS du fichier
 * d'import sont délibérément ignorés ici. Cf. memory/planning-import-rules.md.
 *
 * Implémentation : filtrage 100 % SQL via la relation `agent → memberships`,
 * pas de chargement global suivi d'un filtre JS.
 */
import { prisma } from "@/lib/prisma";
import { agentScope, type SessionUser } from "@/lib/auth";

/** Statut visuel d'un agent par rapport au moment courant. */
export type DutyStatus = "IN_SERVICE" | "LATER" | "FINISHED";

/** Item rendu côté UI dans la section "Agents en service aujourd'hui". */
export type AgentOnDutyItem = {
  /** Identifiant unique du shift (sert de key React). */
  shiftId: string;
  agentId: string;
  agentName: string;
  /** Matricule (clé métier, affiché sous le nom). */
  agentMatricule: string;
  /** ISO 8601 — l'UI parse pour afficher l'horaire. */
  startsAt: string;
  endsAt: string;
  /** Référence courte de la JS (col NUMERO JS du fichier d'origine). */
  jsNumber: string | null;
  /** Code court de la tournée (col CODE JS — jamais une valeur NPO sensible). */
  jsCode: string | null;
  /** Vrai si endsAt tombe le jour suivant `startsAt` (service de nuit). */
  isOvernight: boolean;
  status: DutyStatus;
  /** Jours depuis la dernière session de veille (null si jamais veillé). */
  daysSinceLastSession: number | null;
  /** Nombre total de sessions VeilleSession (tous statuts confondus). */
  sessionCount: number;
  /** Nombre d'actions ImportedAction en `localStatus = ACTIVE` pour l'agent. */
  openActionsCount: number;
  /**
   * 30 buckets quotidiens d'activité (sessions + validations + sightings) sur
   * les 30 derniers jours, le dernier index = aujourd'hui. Rendu par le
   * composant `<Sparkline>`.
   */
  activity: number[];
};

/** Sortie complète consommée par EditorPayload / AdminPayload. */
export type AgentsOnDutyResult = {
  items: AgentOnDutyItem[];
  /** Vrai si au moins un PlanningImport existe en base. */
  hasPlanningImport: boolean;
};

/** 00:00 du jour calendaire local de `now`. */
function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 00:00 du jour suivant (= 24 h après startOfDay). */
function startOfNextDay(now: Date): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Détermine le statut d'un shift par rapport à `now`. */
export function getDutyStatus(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): DutyStatus {
  if (startsAt.getTime() > now.getTime()) return "LATER";
  if (endsAt.getTime() < now.getTime()) return "FINISHED";
  return "IN_SERVICE";
}

/** Vrai si `endsAt` n'est pas le même jour calendaire que `startsAt`. */
export function isOvernightShift(startsAt: Date, endsAt: Date): boolean {
  return (
    startsAt.getFullYear() !== endsAt.getFullYear() ||
    startsAt.getMonth() !== endsAt.getMonth() ||
    startsAt.getDate() !== endsAt.getDate()
  );
}

/** Priorité pour le tri principal (1. EN SERVICE / 2. PLUS TARD / 3. TERMINE). */
const STATUS_ORDER: Record<DutyStatus, number> = {
  IN_SERVICE: 0,
  LATER: 1,
  FINISHED: 2,
};

/**
 * Renvoie les shifts du jour pour les agents du scope de `user`.
 *
 * Stratégie :
 *  1. Une seule requête `findMany` avec where SQL :
 *     - intersection journée : `startsAt < J+1` ET `endsAt > J`
 *     - scope : `agent.isVisible = true` + `agentScope(user)`
 *     L'index composite (startsAt, endsAt) couvre la fenêtre de date ;
 *     le filtre agent est appliqué par le moteur via la relation indexée.
 *  2. Dédup par agent côté JS (un même agent peut avoir un service de nuit
 *     qui se termine + un autre qui commence le même jour). On garde le
 *     shift avec la priorité de statut la plus forte (IN_SERVICE > LATER >
 *     FINISHED), puis le startsAt le plus tôt en cas d'égalité.
 *  3. Tri final : statut puis startsAt asc.
 *
 * Volumétrie : sur un mois de planning (~4 000 shifts) avec un scope EDITOR
 * de quelques dizaines d'agents, la fenêtre journalière ramène au plus
 * ~80-100 rows avant dédup. La requête reste sub-50 ms.
 */
export async function getAgentsOnDutyToday(
  user: SessionUser,
  now: Date,
): Promise<AgentsOnDutyResult> {
  const dayStart = startOfDay(now);
  const dayEnd = startOfNextDay(now);

  // Sparkline 30 jours — fenêtre [now-29j 00:00 → now 23:59]. Aligné sur
  // le pattern de src/app/api/agents/sparklines/route.ts.
  const SPARK_DAYS = 30;
  const sparkFrom = new Date(dayStart);
  sparkFrom.setDate(sparkFrom.getDate() - (SPARK_DAYS - 1));
  const sparkTo = new Date(dayEnd.getTime() - 1); // inclusif fin de journée

  // Compte total des imports — sert à différencier "aucun planning importé"
  // de "planning importé mais aucun agent du scope aujourd'hui". Le compte
  // (et pas le findMany) suffit ; pas d'include ni de data sensible chargée.
  const [shifts, importCount] = await Promise.all([
    prisma.planningShift.findMany({
      where: {
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        agent: { isVisible: true, ...agentScope(user) },
      },
      select: {
        id: true,
        agentId: true,
        startsAt: true,
        endsAt: true,
        jsNumber: true,
        jsCode: true,
        agent: {
          select: {
            firstName: true,
            lastName: true,
            matricule: true,
            // Dernière session pour calculer la fraîcheur ("il y a X jours").
            sessions: {
              orderBy: { startedAt: "desc" },
              take: 1,
              select: { startedAt: true },
            },
            // Compteur sessions total (tous statuts) + actions ouvertes ACTIVE.
            _count: {
              select: {
                sessions: true,
                importedActions: { where: { localStatus: "ACTIVE" } },
              },
            },
          },
        },
      },
    }),
    prisma.planningImport.count(),
  ]);

  // Sparkline activité 30 j — récupéré une seule fois pour les agents
  // effectivement en service aujourd'hui (typiquement quelques dizaines).
  // Trois sources : VeilleSession, ActionValidation, AgentSighting.
  // Aligné sur le pattern de /api/agents/sparklines.
  const dutyAgentIds = Array.from(new Set(shifts.map((s) => s.agentId)));
  const activityByAgent = new Map<string, number[]>();
  for (const id of dutyAgentIds) {
    activityByAgent.set(id, new Array(SPARK_DAYS).fill(0));
  }
  if (dutyAgentIds.length > 0) {
    const [sparkSessions, sparkValidations, sparkSightings] = await Promise.all(
      [
        prisma.veilleSession.findMany({
          where: {
            agentId: { in: dutyAgentIds },
            startedAt: { gte: sparkFrom, lte: sparkTo },
          },
          select: { agentId: true, startedAt: true },
        }),
        prisma.actionValidation.findMany({
          where: {
            agentId: { in: dutyAgentIds },
            realizedAt: { gte: sparkFrom, lte: sparkTo },
          },
          select: { agentId: true, realizedAt: true },
        }),
        prisma.agentSighting.findMany({
          where: {
            agentId: { in: dutyAgentIds },
            sightedAt: { gte: sparkFrom, lte: sparkTo },
          },
          select: { agentId: true, sightedAt: true },
        }),
      ],
    );
    const DAY_MS_SPARK = 86_400_000;
    const dayIndex = (d: Date) => {
      const diff = Math.floor(
        (d.getTime() - sparkFrom.getTime()) / DAY_MS_SPARK,
      );
      return Math.max(0, Math.min(SPARK_DAYS - 1, diff));
    };
    for (const s of sparkSessions) {
      if (!s.agentId) continue;
      const arr = activityByAgent.get(s.agentId);
      if (arr) arr[dayIndex(s.startedAt)]++;
    }
    for (const v of sparkValidations) {
      if (!v.agentId) continue;
      const arr = activityByAgent.get(v.agentId);
      if (arr) arr[dayIndex(v.realizedAt)]++;
    }
    for (const s of sparkSightings) {
      const arr = activityByAgent.get(s.agentId);
      if (arr) arr[dayIndex(s.sightedAt)]++;
    }
  }

  // Dédup par agent : on garde le shift "le plus pertinent" (statut prioritaire).
  // Si plusieurs candidats à statut égal, le startsAt le plus tôt gagne — cohérent
  // avec l'ordre d'affichage final.
  const DAY_MS = 86_400_000;
  const bestByAgent = new Map<string, AgentOnDutyItem>();
  for (const s of shifts) {
    const startsAt = s.startsAt;
    const endsAt = s.endsAt;
    const status = getDutyStatus(startsAt, endsAt, now);
    const lastSessionAt = s.agent.sessions[0]?.startedAt ?? null;
    const daysSinceLastSession = lastSessionAt
      ? Math.floor((now.getTime() - lastSessionAt.getTime()) / DAY_MS)
      : null;
    const candidate: AgentOnDutyItem = {
      shiftId: s.id,
      agentId: s.agentId,
      agentName: `${s.agent.firstName} ${s.agent.lastName}`.trim(),
      agentMatricule: s.agent.matricule,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      jsNumber: s.jsNumber,
      jsCode: s.jsCode,
      isOvernight: isOvernightShift(startsAt, endsAt),
      status,
      daysSinceLastSession,
      sessionCount: s.agent._count.sessions,
      openActionsCount: s.agent._count.importedActions,
      activity: activityByAgent.get(s.agentId) ?? new Array(SPARK_DAYS).fill(0),
    };
    const prev = bestByAgent.get(s.agentId);
    if (!prev) {
      bestByAgent.set(s.agentId, candidate);
      continue;
    }
    if (
      STATUS_ORDER[candidate.status] < STATUS_ORDER[prev.status] ||
      (STATUS_ORDER[candidate.status] === STATUS_ORDER[prev.status] &&
        candidate.startsAt < prev.startsAt)
    ) {
      bestByAgent.set(s.agentId, candidate);
    }
  }

  const items = Array.from(bestByAgent.values()).sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    return a.startsAt.localeCompare(b.startsAt);
  });

  return { items, hasPlanningImport: importCount > 0 };
}

// ─── Hint planning du jour pour un set d'agents (C4) ────────────────────────

/** Format `HH:MM` local du Date (le serveur tourne en Europe/Paris). */
function formatLocalTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Texte court d'enrichissement planning pour la sélection d'agent (autocomplete
 * du wizard de veille). Pur — testable sans Prisma.
 *
 * Sortie attendue côté UI :
 *  - shift présent IN_SERVICE  : "En service aujourd'hui · 06:00 → 14:00 · JS 20412"
 *  - shift présent LATER       : "Prévu plus tard · 13:00 → 21:00 · JS 18754"
 *  - shift présent FINISHED    : "Service terminé · 05:00 → 13:00 · JS 16587"
 *  - service de nuit           : "En service aujourd'hui · 20:40 → 05:00 (+1) · JS 20412"
 *  - aucun shift SERVICE (et planning importé) : "Non prévu en service aujourd'hui"
 *
 * Aucune information NPO (RP / MA / AY …) n'est exposée — par construction,
 * `PlanningShift` ne contient que des SERVICE (filtre amont à l'import).
 */
export function formatPlanningHint(
  shift: {
    startsAt: Date;
    endsAt: Date;
    jsNumber: string | null;
  } | null,
  now: Date,
): string {
  if (!shift) return "Non prévu en service aujourd'hui";
  const status = getDutyStatus(shift.startsAt, shift.endsAt, now);
  const overnight = isOvernightShift(shift.startsAt, shift.endsAt);
  const range = `${formatLocalTime(shift.startsAt)} → ${formatLocalTime(
    shift.endsAt,
  )}${overnight ? " (+1)" : ""}`;
  const js = shift.jsNumber ? ` · JS ${shift.jsNumber}` : "";
  const label =
    status === "IN_SERVICE"
      ? "En service aujourd'hui"
      : status === "LATER"
        ? "Prévu plus tard"
        : "Service terminé";
  return `${label} · ${range}${js}`;
}

/**
 * Renvoie pour un set d'agentIds une Map agentId → texte hint planning du
 * jour, prêt à afficher dans l'autocomplete agent.
 *
 * Stratégie performance :
 *  - 1 requête `planningShift.findMany` couvrant TOUS les agents demandés en
 *    une seule passe (pas de N+1 par agent côté client/serveur)
 *  - 1 `planningImport.count()` pour distinguer "aucun import en base"
 *    (→ on renvoie Map vide, l'UI n'affiche rien) de "import présent mais
 *    pas de shift pour l'agent" (→ "Non prévu en service aujourd'hui")
 *  - select minimal : startsAt, endsAt, jsNumber, agentId (pas de jsCode
 *    nécessaire, le hint ne l'utilise pas pour rester compact)
 *
 * **Pas de scope appliqué ici** : la fonction reçoit déjà des agentIds qui
 * proviennent du moteur de scope existant (caller doit fournir des agents
 * du scope user — appel typique : `findMany({where: agentScope(user)})` puis
 * `getAgentsPlanningHints(ids, now)`). Le planning n'élargit jamais le scope.
 */
export async function getAgentsPlanningHints(
  agentIds: string[],
  now: Date,
): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map();
  const dayStart = startOfDay(now);
  const dayEnd = startOfNextDay(now);
  const [shifts, importCount] = await Promise.all([
    prisma.planningShift.findMany({
      where: {
        agentId: { in: agentIds },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: {
        agentId: true,
        startsAt: true,
        endsAt: true,
        jsNumber: true,
      },
    }),
    prisma.planningImport.count(),
  ]);

  // Aucun planning en base : on renvoie rien pour ne pas polluer l'UI.
  if (importCount === 0) return new Map();

  // Dédup par agent : même règle que getAgentsOnDutyToday — statut
  // prioritaire (IN_SERVICE > LATER > FINISHED) puis startsAt asc.
  const bestByAgent = new Map<
    string,
    { startsAt: Date; endsAt: Date; jsNumber: string | null; status: DutyStatus }
  >();
  for (const s of shifts) {
    const status = getDutyStatus(s.startsAt, s.endsAt, now);
    const prev = bestByAgent.get(s.agentId);
    if (
      !prev ||
      STATUS_ORDER[status] < STATUS_ORDER[prev.status] ||
      (STATUS_ORDER[status] === STATUS_ORDER[prev.status] &&
        s.startsAt < prev.startsAt)
    ) {
      bestByAgent.set(s.agentId, {
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        jsNumber: s.jsNumber,
        status,
      });
    }
  }

  const hints = new Map<string, string>();
  for (const agentId of agentIds) {
    const best = bestByAgent.get(agentId) ?? null;
    hints.set(agentId, formatPlanningHint(best, now));
  }
  return hints;
}
