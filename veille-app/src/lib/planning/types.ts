/**
 * Types partagés du module Planning (tour de service ferroviaire).
 *
 * Vocabulaire métier — cf. memory/project-sncf-context.md :
 *  - UCH       : Unité de Commandement Hiérarchique (équipe d'appartenance)
 *  - POP / JS  : Période OPérationnelle = Journée de Service
 *  - NPO       : Non-Période Opérationnelle (repos, congé, absence)
 *  - JS number : référence numérique de la journée de service
 *
 * Règles fixées par le PO (cf. memory/planning-import-rules.md) :
 *  - Seules les lignes SERVICE (JS) sont parsées en ResolvedShift et persistées.
 *  - Les NPO sont comptées dans le rapport mais jamais transformées en row.
 *  - Le matching agent se fait par matricule uniquement.
 *  - Un nouvel import écrase l'ancien (transaction Prisma unique).
 */

/** Une ligne SERVICE prête à être insérée (avant matching matricule). */
export type ParsedShift = {
  /** Numéro de ligne dans le fichier (1-based, en-tête = ligne 0). */
  rowIndex: number;
  /** Matricule de l'agent (col CODE IMMATRICULATION). */
  matricule: string;
  /** DATE DEBUT + HEURE DEBUT en `Date` locale Europe/Paris. */
  startsAt: Date;
  /** DATE FIN + HEURE FIN. Peut être J+1 (service de nuit). */
  endsAt: Date;
  /** Col NUMERO JS (ex "20412"). */
  jsNumber: string | null;
  /** Col CODE JS / CODE NPO — quand SERVICE, jamais sensible. */
  jsCode: string | null;
};

/** Erreur de parsing d'une ligne — comptée dans rowsErrored. */
export type PlanningParseError = {
  rowIndex: number;
  reason: string;
};

/** Comptage brut des UCH observées (info seule, jamais utilisée pour le scope). */
export type RawUchSummary = {
  byAppartenance: Record<string, number>;
  byAffectation: Record<string, number>;
};

/** Résultat brut du parser, sans contact DB. */
export type PlanningParseResult = {
  /** Lignes SERVICE prêtes à matcher (col 16 = "JS"). */
  shifts: ParsedShift[];
  /** Total des lignes de données (hors header). */
  rowsTotal: number;
  /** Total des lignes typées JS dans le fichier (≥ shifts.length à cause de rowsErrored). */
  rowsService: number;
  /** Total des lignes typées NPO — comptées seulement, non persistées. */
  rowsNonService: number;
  /** Lignes en erreur (date invalide, matricule vide, etc.). */
  rowsErrored: number;
  errors: PlanningParseError[];
  rawUchSummary: RawUchSummary;
  periodStart: Date | null;
  periodEnd: Date | null;
};

/** Un shift résolu côté DB : agentId au lieu de matricule. */
export type ResolvedShift = {
  agentId: string;
  startsAt: Date;
  endsAt: Date;
  jsNumber: string | null;
  jsCode: string | null;
};

/** Preview d'import : ce qui sera persisté + compteurs. */
export type PlanningImportPreview = {
  rowsTotal: number;
  rowsService: number;
  rowsNonService: number;
  rowsImported: number;
  rowsIgnored: number;
  rowsErrored: number;
  errors: PlanningParseError[];
  unknownMatricules: string[];
  rawUchSummary: RawUchSummary;
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Shifts prêts à être insérés dans PlanningShift. */
  resolvedShifts: ResolvedShift[];
};
