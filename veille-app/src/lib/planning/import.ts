/**
 * Orchestration de l'import planning : preview + commit transactionnel.
 *
 * Pattern aligné sur src/lib/actionImport.ts : fonctions pures côté parser,
 * orchestrateur côté `import.ts` qui parle à Prisma. C2 ajoutera une route
 * Next.js qui appelle ces helpers — pour C1 ils sont juste exportés.
 *
 * Règles métier (cf. memory/planning-import-rules.md) :
 *  - SERVICE uniquement persisté ; matching par matricule.
 *  - Un nouvel import écrase l'ancien dans une seule transaction Prisma
 *    (deleteMany → create → createMany). Si la création échoue, l'ancien
 *    import reste intact (atomicité garantie par $transaction).
 *  - AuditLog `PLANNING_IMPORTED` posé dans la même transaction.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { parsePlanningBuffer } from "./parser";
import type {
  PlanningImportPreview,
  PlanningParseResult,
  ResolvedShift,
} from "./types";

/**
 * Sous-ensemble Prisma utilisé par l'orchestrateur — laisse passer le
 * client global et facilite le mock côté tests.
 */
export type PlanningPrismaClient = Pick<
  PrismaClient,
  "agent" | "planningShift" | "planningImport" | "auditLog" | "$transaction"
>;

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Parse le fichier + résout les matricules vers des agentId.
 * Ne touche pas la DB en écriture — pur read.
 *
 * - Matricules inconnus → comptés dans `rowsIgnored` + listés dans
 *   `unknownMatricules` (déduplication interne).
 * - Matricules dupliqués dans le fichier → résolus une seule fois, chaque
 *   shift garde son agentId.
 */
export async function previewPlanningImport(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  teamId: string,
  client: PlanningPrismaClient = defaultPrisma,
): Promise<PlanningImportPreview> {
  const parsed = parsePlanningBuffer(buffer);
  return resolveAgents(parsed, teamId, client);
}

/**
 * Variante directement à partir d'un PlanningParseResult — utile en test
 * pour piloter le parser sans passer par un buffer ODS.
 */
export async function resolveAgents(
  parsed: PlanningParseResult,
  teamId: string,
  client: PlanningPrismaClient = defaultPrisma,
): Promise<PlanningImportPreview> {
  const matricules = Array.from(new Set(parsed.shifts.map((s) => s.matricule)));
  // Cloisonnement : seul un agent appartenant à l'équipe cible (AgentTeam ou
  // teamId legacy) est résolu ; les autres matricules sont comptés inconnus.
  // Le planning n'importe jamais un agent d'une autre équipe.
  const knownAgents = matricules.length
    ? await client.agent.findMany({
        where: {
          matricule: { in: matricules },
          OR: [{ teamId }, { memberships: { some: { teamId } } }],
        },
        select: { id: true, matricule: true },
      })
    : [];
  const matriculeToId = new Map<string, string>(
    knownAgents.map((a) => [a.matricule, a.id]),
  );

  const resolvedShifts: ResolvedShift[] = [];
  const unknownSet = new Set<string>();
  for (const shift of parsed.shifts) {
    const agentId = matriculeToId.get(shift.matricule);
    if (!agentId) {
      unknownSet.add(shift.matricule);
      continue;
    }
    resolvedShifts.push({
      agentId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      jsNumber: shift.jsNumber,
      jsCode: shift.jsCode,
    });
  }

  return {
    rowsTotal: parsed.rowsTotal,
    rowsService: parsed.rowsService,
    rowsNonService: parsed.rowsNonService,
    rowsImported: resolvedShifts.length,
    rowsIgnored: parsed.rowsService - resolvedShifts.length,
    rowsErrored: parsed.rowsErrored,
    errors: parsed.errors,
    unknownMatricules: Array.from(unknownSet).sort(),
    rawUchSummary: parsed.rawUchSummary,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    resolvedShifts,
  };
}

// ─── Commit transactionnel ───────────────────────────────────────────────────

export type CommitOptions = {
  /** Équipe cible — l'import écrase UNIQUEMENT le planning de cette équipe. */
  teamId: string;
  importedById: string | null;
  importedByEmail: string | null;
  fileName: string | null;
};

export type CommitResult = {
  importId: string;
  rowsImported: number;
};

/**
 * Persiste une preview : remplace tout l'historique planning + crée
 * l'enregistrement d'import + log d'audit dans une seule transaction.
 *
 * En cas d'échec à n'importe quelle étape, la transaction est annulée
 * et l'état précédent reste intact.
 */
export async function commitPlanningImport(
  preview: PlanningImportPreview,
  options: CommitOptions,
  client: PlanningPrismaClient = defaultPrisma,
): Promise<CommitResult> {
  const importData: Prisma.PlanningImportCreateInput = {
    fileName: options.fileName,
    periodStart: preview.periodStart,
    periodEnd: preview.periodEnd,
    rowsTotal: preview.rowsTotal,
    rowsService: preview.rowsService,
    rowsNonService: preview.rowsNonService,
    rowsImported: preview.rowsImported,
    rowsIgnored: preview.rowsIgnored,
    rowsErrored: preview.rowsErrored,
    unknownMatricules: JSON.stringify(preview.unknownMatricules),
    rawUchSummary: JSON.stringify(preview.rawUchSummary),
    team: { connect: { id: options.teamId } },
    ...(options.importedById
      ? { importedBy: { connect: { id: options.importedById } } }
      : {}),
  };

  return client.$transaction(async (tx) => {
    // 1. Vider le planning DE CETTE ÉQUIPE uniquement (overwrite par équipe —
    //    plus de purge globale qui effacerait les autres équipes). Cascade
    //    schema supprimerait aussi les shifts mais on filtre par teamId.
    await tx.planningShift.deleteMany({ where: { teamId: options.teamId } });
    await tx.planningImport.deleteMany({ where: { teamId: options.teamId } });

    // 2. Créer le nouvel import.
    const created = await tx.planningImport.create({
      data: importData,
      select: { id: true },
    });

    // 3. Insérer les shifts résolus (createMany — performant pour ~4k rows).
    if (preview.resolvedShifts.length > 0) {
      await tx.planningShift.createMany({
        data: preview.resolvedShifts.map((s) => ({
          importId: created.id,
          teamId: options.teamId,
          agentId: s.agentId,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          jsNumber: s.jsNumber,
          jsCode: s.jsCode,
        })),
      });
    }

    // 4. Trace d'audit. Ne stocke pas la liste complète des shifts —
    //    seulement les compteurs et la liste des matricules inconnus.
    await tx.auditLog.create({
      data: {
        userId: options.importedById,
        userEmail: options.importedByEmail,
        action: "PLANNING_IMPORTED",
        entity: "PlanningImport",
        entityId: created.id,
        details: JSON.stringify({
          fileName: options.fileName,
          rowsTotal: preview.rowsTotal,
          rowsService: preview.rowsService,
          rowsNonService: preview.rowsNonService,
          rowsImported: preview.rowsImported,
          rowsIgnored: preview.rowsIgnored,
          rowsErrored: preview.rowsErrored,
          unknownMatriculesCount: preview.unknownMatricules.length,
          periodStart: preview.periodStart?.toISOString() ?? null,
          periodEnd: preview.periodEnd?.toISOString() ?? null,
        }),
      },
    });

    return {
      importId: created.id,
      rowsImported: preview.resolvedShifts.length,
    };
  });
}
