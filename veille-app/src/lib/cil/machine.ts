/**
 * Machine d'état du Livret CIL — déclarative et SOUPLE.
 *
 * Philosophie (cf. plan) : un seul invariant DUR — aucune écriture sur un
 * incident `CLOSED` (réouverture réservée EDITOR/ADMIN). Le reste est du
 * GUIDAGE : `computeAvailableActions` ne renvoie que les actions utiles à la
 * situation, avec d'éventuels avertissements NON bloquants pour couvrir les
 * cas exceptionnels. La « phase » et les « protections actives » sont
 * DÉRIVÉES des données (pas de drapeau stocké).
 *
 * Module pur : aucune I/O, entièrement testable.
 */
import type { DepecheSubtype, IncidentStatus } from "./types";

export type CilPhase =
  | "CREATED"
  | "MISSION"
  | "ON_SITE"
  | "INTERVENTION"
  | "REPRISE"
  | "CLOSED";

export type CilActionId =
  | "DECLARE_ARRIVAL"
  | "ADD_PROTECTION_CIRCULATION"
  | "ADD_PROTECTION_ELECTRIQUE"
  | "ADD_DEPECHE_LIBRE"
  | "ADD_INTERVENANT"
  | "ADD_REPRISE_PARTIELLE"
  | "ADD_REPRISE_NORMALE"
  | "ADD_RETABLISSEMENT_PARTIEL"
  | "ADD_RETABLISSEMENT_NORMAL"
  | "CHANGE_CIL"
  | "ADD_NOTE"
  | "CLOSE"
  | "REOPEN";

export type MachineContext = {
  status: IncidentStatus;
  arrivedOnSiteAt: string | null;
  /** Sous-types des dépêches déjà enregistrées (ordre chronologique). */
  depecheSubtypes: DepecheSubtype[];
  /** Rôle de l'utilisateur courant (pour la réouverture). */
  role?: "USER" | "EDITOR" | "ADMIN";
};

export type ActiveProtections = { circulation: boolean; electrique: boolean };

/**
 * Protections actives (dérivées) :
 *  - circulation active tant qu'aucune REPRISE_NORMALE n'a été passée après
 *    au moins une PROTECTION_CIRCULATION ;
 *  - électrique active tant qu'aucun RETABLISSEMENT_NORMAL n'a été passé après
 *    au moins une PROTECTION_ELECTRIQUE.
 * (La reprise/rétablissement PARTIEL ne lève pas la protection.)
 */
export function activeProtections(ctx: MachineContext): ActiveProtections {
  const has = (s: DepecheSubtype) => ctx.depecheSubtypes.includes(s);
  return {
    circulation: has("PROTECTION_CIRCULATION") && !has("REPRISE_NORMALE"),
    electrique: has("PROTECTION_ELECTRIQUE") && !has("RETABLISSEMENT_NORMAL"),
  };
}

/** Phase dérivée — indicative (affichage), non contraignante. */
export function derivePhase(ctx: MachineContext): CilPhase {
  if (ctx.status === "CLOSED") return "CLOSED";
  const prot = activeProtections(ctx);
  const hasReprise = ctx.depecheSubtypes.some(
    (s) =>
      s === "REPRISE_PARTIELLE" ||
      s === "REPRISE_NORMALE" ||
      s === "RETABLISSEMENT_PARTIEL" ||
      s === "RETABLISSEMENT_NORMAL",
  );
  const hasProtection = ctx.depecheSubtypes.some(
    (s) => s === "PROTECTION_CIRCULATION" || s === "PROTECTION_ELECTRIQUE",
  );
  if (hasReprise && !prot.circulation && !prot.electrique) return "REPRISE";
  if (hasProtection) return "INTERVENTION";
  if (ctx.arrivedOnSiteAt) return "ON_SITE";
  return "MISSION";
}

export type AvailableAction = {
  id: CilActionId;
  label: string;
  /** Action mise en avant dans le guidage (bouton primaire). */
  primary: boolean;
  /** Avertissement NON bloquant (situation inhabituelle). */
  warning?: string;
};

const LABELS: Record<CilActionId, string> = {
  DECLARE_ARRIVAL: "Je suis arrivé sur place",
  ADD_PROTECTION_CIRCULATION: "Protection circulation (rouge)",
  ADD_PROTECTION_ELECTRIQUE: "Protection électrique (bleue)",
  ADD_DEPECHE_LIBRE: "Dépêche libre",
  ADD_INTERVENANT: "Ajouter un intervenant",
  ADD_REPRISE_PARTIELLE: "Reprise partielle de la circulation",
  ADD_REPRISE_NORMALE: "Reprise de la circulation",
  ADD_RETABLISSEMENT_PARTIEL: "Rétablissement partiel de la tension",
  ADD_RETABLISSEMENT_NORMAL: "Rétablissement de la tension",
  CHANGE_CIL: "Changement de CIL",
  ADD_NOTE: "Ajouter une note",
  CLOSE: "Clôturer l'incident",
  REOPEN: "Rouvrir l'incident",
};

/**
 * Actions à proposer pour l'état courant. N'affiche que ce qui est utile
 * (implémente « le workflow ne doit afficher que les événements utiles »).
 * L'ordre reflète la priorité de guidage.
 */
export function computeAvailableActions(
  ctx: MachineContext,
): AvailableAction[] {
  const make = (
    id: CilActionId,
    primary = false,
    warning?: string,
  ): AvailableAction => ({ id, label: LABELS[id], primary, warning });

  // Incident clôturé : seule la réouverture (rôle habilité) est proposée.
  if (ctx.status === "CLOSED") {
    const canReopen = ctx.role === "EDITOR" || ctx.role === "ADMIN";
    return canReopen ? [make("REOPEN")] : [];
  }

  const prot = activeProtections(ctx);
  const actions: AvailableAction[] = [];

  // 1. Arrivée sur site — action primaire tant qu'elle n'est pas déclarée.
  if (!ctx.arrivedOnSiteAt) {
    actions.push(make("DECLARE_ARRIVAL", true));
  }

  const beforeArrival = !ctx.arrivedOnSiteAt
    ? "Arrivée sur site non encore déclarée."
    : undefined;

  // 2. Protections (indépendantes ; on ne propose pas de recréer une active).
  if (!prot.circulation) {
    actions.push(
      make("ADD_PROTECTION_CIRCULATION", !!ctx.arrivedOnSiteAt, beforeArrival),
    );
  }
  if (!prot.electrique) {
    actions.push(make("ADD_PROTECTION_ELECTRIQUE", false, beforeArrival));
  }

  // 3. Reprises / rétablissements — seulement si la protection correspondante
  //    est active.
  if (prot.circulation) {
    actions.push(make("ADD_REPRISE_PARTIELLE"));
    actions.push(make("ADD_REPRISE_NORMALE"));
  }
  if (prot.electrique) {
    actions.push(make("ADD_RETABLISSEMENT_PARTIEL"));
    actions.push(make("ADD_RETABLISSEMENT_NORMAL"));
  }

  // 4. Toujours disponibles.
  actions.push(make("ADD_INTERVENANT"));
  actions.push(make("ADD_DEPECHE_LIBRE"));
  actions.push(make("CHANGE_CIL"));
  actions.push(make("ADD_NOTE"));

  // 5. Clôture — avertit si une protection est encore active.
  const closeWarning =
    prot.circulation || prot.electrique
      ? "Une ou plusieurs protections sont encore actives."
      : undefined;
  actions.push(make("CLOSE", false, closeWarning));

  return actions;
}

/** `true` si une écriture métier est autorisée (invariant dur). */
export function canWrite(ctx: Pick<MachineContext, "status">): boolean {
  return ctx.status !== "CLOSED";
}

// ─── Garde-fous autorisations (reprise / rétablissement) ─────────────────────

export type IntervenantPresence = {
  type: string;
  arrivedAt: string | null;
  departedAt: string | null;
};

/** Un intervenant de ce type est PRÉSENT (arrivé et non reparti). */
export function isPresent(
  intervenants: IntervenantPresence[],
  type: "COS" | "OPJ",
): boolean {
  return intervenants.some(
    (i) => i.type === type && !!i.arrivedAt && !i.departedAt,
  );
}

/** Ce qu'une autorité présente doit avoir fourni pour libérer la reprise. */
export type RoleRequirement = { authorized: boolean; signed: boolean };

export type MissingRequirement = {
  role: "COS" | "OPJ";
  /** Ce qui manque encore pour cette autorité. */
  needs: ("autorisation" | "signature")[];
};

/**
 * Autorisation d'une reprise / d'un rétablissement (partiel ou normal).
 * Pour CHAQUE COS/OPJ présent (arrivé, non reparti), il faut à la fois son
 * autorisation horodatée ET sa signature — l'imprimé réserve les deux, et une
 * autorisation non signée n'engage personne. Un départ enregistré lève
 * l'exigence (l'autorité n'est plus « présente »).
 */
export function repriseAllowed(
  intervenants: IntervenantPresence[],
  provided: { COS: RoleRequirement; OPJ: RoleRequirement },
): { ok: boolean; missing: MissingRequirement[] } {
  const missing: MissingRequirement[] = [];
  for (const role of ["COS", "OPJ"] as const) {
    if (!isPresent(intervenants, role)) continue;
    const needs: ("autorisation" | "signature")[] = [];
    if (!provided[role].authorized) needs.push("autorisation");
    if (!provided[role].signed) needs.push("signature");
    if (needs.length) missing.push({ role, needs });
  }
  return { ok: missing.length === 0, missing };
}

/** Message d'erreur lisible à partir des exigences manquantes. */
export function missingRequirementsMessage(
  missing: MissingRequirement[],
): string {
  const parts = missing.map((m) => `${m.role} (${m.needs.join(" et ")})`);
  return `Reprise impossible : il manque ${parts.join(", ")}.`;
}

// ─── Rappels métier (assistant) ──────────────────────────────────────────────

export type ReminderDepeche = {
  id: string;
  subtype: DepecheSubtype;
  interlocutor: string | null;
  avisCrcAt: string | null;
  avisCosAt: string | null;
  avisOpjAt: string | null;
};

export type ReminderEvent = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
};

export type PendingReminder = {
  id: string;
  /** Entité porteuse de l'avis (dépêche ou événement). */
  target: "DEPECHE" | "EVENT";
  targetId: string;
  /** Champ d'avis à renseigner sur la cible. */
  field: string;
  message: string;
};

const REPRISE_SUBTYPES: DepecheSubtype[] = [
  "REPRISE_PARTIELLE",
  "REPRISE_NORMALE",
  "RETABLISSEMENT_PARTIEL",
  "RETABLISSEMENT_NORMAL",
];

/**
 * Avis obligatoires encore à recueillir. L'imprimé réserve une case « Avis
 * (obligatoire) » à chaque étape : tant qu'elle est vide, l'assistant le
 * rappelle. Deux familles :
 *  - protection reprise à son compte → aviser chaque COS/OPJ PRÉSENT (couvre le
 *    cas où l'autorité arrive APRÈS la reprise des mesures) ;
 *  - reprise / rétablissement → aviser le CRC.
 * Module pur : la liste est recalculée à chaque rendu, rien n'est stocké.
 */
export function pendingReminders(input: {
  depeches: ReminderDepeche[];
  intervenants: IntervenantPresence[];
  events?: ReminderEvent[];
}): PendingReminder[] {
  const out: PendingReminder[] = [];

  // 1. Avis aux autorités présentes sur les protections (dépêche au CRC).
  for (const d of input.depeches) {
    const isProtection =
      d.subtype === "PROTECTION_CIRCULATION" ||
      d.subtype === "PROTECTION_ELECTRIQUE";
    if (!isProtection || d.interlocutor !== "CRC") continue;
    for (const role of ["COS", "OPJ"] as const) {
      const field = role === "COS" ? "avisCosAt" : "avisOpjAt";
      if (!isPresent(input.intervenants, role) || d[field]) continue;
      out.push({
        id: `${d.id}:${field}`,
        target: "DEPECHE",
        targetId: d.id,
        field,
        message: `Avisez le ${role} que les mesures de protection sont reprises à votre compte, puis notez l'heure de l'avis.`,
      });
    }
  }

  // 2. Avis au CRC après chaque reprise / rétablissement.
  for (const d of input.depeches) {
    if (!REPRISE_SUBTYPES.includes(d.subtype) || d.avisCrcAt) continue;
    out.push({
      id: `${d.id}:avisCrcAt`,
      target: "DEPECHE",
      targetId: d.id,
      field: "avisCrcAt",
      message: "Avisez le CRC de Lyon et notez l'heure de l'avis.",
    });
  }

  // 3. Changement de CIL : le relais doit être annoncé à l'AC, au CRC et à
  //    chaque autorité PRÉSENTE. Les heures sont portées par le metadata de
  //    l'événement et imprimées dans les colonnes prévues du livret.
  for (const e of input.events ?? []) {
    if (e.type !== "CHANGEMENT_CIL") continue;
    const meta = e.metadata ?? {};
    const targets: { key: string; label: string; required: boolean }[] = [
      { key: "avis_ac", label: "l'AC concerné", required: true },
      { key: "avis_crc", label: "le CRC de Lyon", required: true },
      { key: "avis_cos", label: "le COS", required: isPresent(input.intervenants, "COS") },
      { key: "avis_opj", label: "l'OPJ", required: isPresent(input.intervenants, "OPJ") },
    ];
    for (const t of targets) {
      if (!t.required || meta[t.key]) continue;
      out.push({
        id: `${e.id}:${t.key}`,
        target: "EVENT",
        targetId: e.id,
        field: t.key,
        message: `Changement de CIL : avisez ${t.label} et notez l'heure de l'avis.`,
      });
    }
  }

  return out;
}

// ─── Voies de protection (« fils d'Ariane » rouge / bleue) ───────────────────

export type ProtectionKind = "CIRCULATION" | "ELECTRIQUE";

export type ProtectionLaneState = {
  kind: ProtectionKind;
  created: boolean;
  active: boolean;
  /** Une reprise/rétablissement PARTIEL a été passé. */
  partialDone: boolean;
  /** `true` si la protection a été levée (reprise/rétablissement NORMAL). */
  lifted: boolean;
};

/** État dérivé d'une voie de protection pour le rendu guidé. */
export function protectionLane(
  kind: ProtectionKind,
  ctx: MachineContext,
): ProtectionLaneState {
  const has = (s: DepecheSubtype) => ctx.depecheSubtypes.includes(s);
  if (kind === "CIRCULATION") {
    const created = has("PROTECTION_CIRCULATION");
    const lifted = has("REPRISE_NORMALE");
    return {
      kind,
      created,
      active: created && !lifted,
      partialDone: has("REPRISE_PARTIELLE"),
      lifted,
    };
  }
  const created = has("PROTECTION_ELECTRIQUE");
  const lifted = has("RETABLISSEMENT_NORMAL");
  return {
    kind,
    created,
    active: created && !lifted,
    partialDone: has("RETABLISSEMENT_PARTIEL"),
    lifted,
  };
}
