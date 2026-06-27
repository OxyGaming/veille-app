import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParsedShift,
  PlanningParseResult,
  ResolvedShift,
} from "./types";

// ── Mocks Prisma ────────────────────────────────────────────────────────────
const findManyAgent = vi.fn();
const deleteManyShift = vi.fn();
const deleteManyImport = vi.fn();
const createImport = vi.fn();
const createManyShift = vi.fn();
const createAudit = vi.fn();

// `txClient` réfère aux mêmes vi.fn que la racine prisma : on garde un alias
// pour les passer au callback de $transaction. Il est utilisé uniquement
// lors de l'invocation effective de transaction(), donc l'init paresseuse
// suffit (vi.mock factory est hoistée avant les `const` du fichier).
type TxClient = {
  planningShift: {
    deleteMany: typeof deleteManyShift;
    createMany: typeof createManyShift;
  };
  planningImport: {
    deleteMany: typeof deleteManyImport;
    create: typeof createImport;
  };
  auditLog: { create: typeof createAudit };
};

const transaction = vi.fn(
  async (arg: unknown[] | ((tx: TxClient) => Promise<unknown>)) => {
    if (typeof arg === "function") {
      const tx: TxClient = {
        planningShift: {
          deleteMany: deleteManyShift,
          createMany: createManyShift,
        },
        planningImport: {
          deleteMany: deleteManyImport,
          create: createImport,
        },
        auditLog: { create: createAudit },
      };
      return arg(tx);
    }
    return arg;
  },
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: (...a: unknown[]) => findManyAgent(...a) },
    planningShift: {
      deleteMany: (...a: unknown[]) => deleteManyShift(...a),
      createMany: (...a: unknown[]) => createManyShift(...a),
    },
    planningImport: {
      deleteMany: (...a: unknown[]) => deleteManyImport(...a),
      create: (...a: unknown[]) => createImport(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
    $transaction: (arg: unknown) => transaction(arg as never),
  },
}));

import {
  commitPlanningImport,
  resolveAgents,
} from "./import";

beforeEach(() => {
  findManyAgent.mockReset();
  deleteManyShift.mockReset();
  deleteManyImport.mockReset();
  createImport.mockReset();
  createManyShift.mockReset();
  createAudit.mockReset();
  transaction.mockClear();

  findManyAgent.mockResolvedValue([]);
  deleteManyShift.mockResolvedValue({ count: 0 });
  deleteManyImport.mockResolvedValue({ count: 0 });
  createImport.mockResolvedValue({ id: "new-import-id" });
  createManyShift.mockResolvedValue({ count: 0 });
  createAudit.mockResolvedValue({ id: "audit-id" });
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

function shift(matricule: string, opts: Partial<ParsedShift> = {}): ParsedShift {
  return {
    rowIndex: opts.rowIndex ?? 1,
    matricule,
    startsAt: opts.startsAt ?? new Date(2026, 5, 9, 8, 0, 0),
    endsAt: opts.endsAt ?? new Date(2026, 5, 9, 14, 0, 0),
    jsNumber: opts.jsNumber ?? "20412",
    jsCode: opts.jsCode ?? "VMCAS",
  };
}

function parsed(shifts: ParsedShift[]): PlanningParseResult {
  return {
    shifts,
    rowsTotal: shifts.length,
    rowsService: shifts.length,
    rowsNonService: 0,
    rowsErrored: 0,
    errors: [],
    rawUchSummary: { byAppartenance: {}, byAffectation: {} },
    periodStart: shifts.length ? shifts[0].startsAt : null,
    periodEnd: shifts.length ? shifts[0].endsAt : null,
  };
}

// ─── resolveAgents ───────────────────────────────────────────────────────────

describe("resolveAgents", () => {
  it("résout les matricules connus, compte les inconnus, déduplique la liste", async () => {
    findManyAgent.mockResolvedValue([
      { id: "agent-A", matricule: "AAA111" },
      { id: "agent-B", matricule: "BBB222" },
    ]);

    const preview = await resolveAgents(
      parsed([
        shift("AAA111"),
        shift("BBB222"),
        shift("ZZZ999"), // inconnu
        shift("ZZZ999"), // inconnu (doublon)
      ]),
      "team-X",
    );

    expect(preview.rowsImported).toBe(2);
    expect(preview.rowsIgnored).toBe(2);
    expect(preview.unknownMatricules).toEqual(["ZZZ999"]); // dédupliqué
    expect(preview.resolvedShifts.map((s) => s.agentId).sort()).toEqual([
      "agent-A",
      "agent-B",
    ]);
  });

  it("ne lance pas de requête findMany si aucun shift", async () => {
    const preview = await resolveAgents(parsed([]), "team-X");
    expect(findManyAgent).not.toHaveBeenCalled();
    expect(preview.rowsImported).toBe(0);
    expect(preview.resolvedShifts).toEqual([]);
  });

  it("conserve plusieurs shifts pour le même matricule connu", async () => {
    findManyAgent.mockResolvedValue([{ id: "agent-A", matricule: "AAA111" }]);
    const a = shift("AAA111", { jsNumber: "1" });
    const b = shift("AAA111", { jsNumber: "2" });
    const preview = await resolveAgents(parsed([a, b]), "team-X");
    expect(preview.rowsImported).toBe(2);
    expect(preview.resolvedShifts.map((s) => s.jsNumber).sort()).toEqual([
      "1",
      "2",
    ]);
  });

  it("transmet rawUchSummary, periodStart/End, errors tels quels", async () => {
    findManyAgent.mockResolvedValue([{ id: "agent-A", matricule: "AAA111" }]);
    const input: PlanningParseResult = {
      shifts: [shift("AAA111")],
      rowsTotal: 10,
      rowsService: 1,
      rowsNonService: 8,
      rowsErrored: 1,
      errors: [{ rowIndex: 5, reason: "test" }],
      rawUchSummary: { byAppartenance: { ONDAINE: 5 }, byAffectation: {} },
      periodStart: new Date(2026, 0, 1),
      periodEnd: new Date(2026, 11, 31),
    };
    const preview = await resolveAgents(input, "team-X");
    expect(preview.rowsTotal).toBe(10);
    expect(preview.rowsNonService).toBe(8);
    expect(preview.rowsErrored).toBe(1);
    expect(preview.errors).toEqual([{ rowIndex: 5, reason: "test" }]);
    expect(preview.rawUchSummary.byAppartenance).toEqual({ ONDAINE: 5 });
    expect(preview.periodStart).toEqual(new Date(2026, 0, 1));
  });
});

// ─── commitPlanningImport ────────────────────────────────────────────────────

describe("commitPlanningImport", () => {
  function previewFor(shifts: ResolvedShift[]) {
    return {
      rowsTotal: shifts.length,
      rowsService: shifts.length,
      rowsNonService: 0,
      rowsImported: shifts.length,
      rowsIgnored: 0,
      rowsErrored: 0,
      errors: [],
      unknownMatricules: [],
      rawUchSummary: { byAppartenance: {}, byAffectation: {} },
      periodStart: shifts.length ? shifts[0].startsAt : null,
      periodEnd: shifts.length ? shifts[0].endsAt : null,
      resolvedShifts: shifts,
    };
  }

  it("efface l'ancien import, crée le nouveau, insère les shifts, log l'audit — dans une transaction", async () => {
    const resolved: ResolvedShift = {
      agentId: "agent-A",
      startsAt: new Date(2026, 5, 9, 8),
      endsAt: new Date(2026, 5, 9, 14),
      jsNumber: "20412",
      jsCode: "VMCAS",
    };

    const result = await commitPlanningImport(previewFor([resolved]), {
      teamId: "team-X",
      importedById: "user-1",
      importedByEmail: "u@x",
      fileName: "planning.ods",
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(deleteManyShift).toHaveBeenCalledOnce();
    expect(deleteManyImport).toHaveBeenCalledOnce();
    expect(createImport).toHaveBeenCalledOnce();
    expect(createManyShift).toHaveBeenCalledOnce();
    expect(createAudit).toHaveBeenCalledOnce();

    // Ordre transactionnel : delete avant create.
    const deleteShiftCall = deleteManyShift.mock.invocationCallOrder[0];
    const createImportCall = createImport.mock.invocationCallOrder[0];
    const createShiftCall = createManyShift.mock.invocationCallOrder[0];
    const auditCall = createAudit.mock.invocationCallOrder[0];
    expect(deleteShiftCall).toBeLessThan(createImportCall);
    expect(createImportCall).toBeLessThan(createShiftCall);
    expect(createShiftCall).toBeLessThan(auditCall);

    // Le createMany shift référence l'importId fraîchement créé.
    const args = createManyShift.mock.calls[0][0];
    expect(args.data[0].importId).toBe("new-import-id");
    expect(args.data[0].agentId).toBe("agent-A");
    expect(args.data[0].jsNumber).toBe("20412");

    // L'audit log embarque les compteurs (pas la liste des shifts).
    const auditArgs = createAudit.mock.calls[0][0];
    expect(auditArgs.data.action).toBe("PLANNING_IMPORTED");
    expect(auditArgs.data.entity).toBe("PlanningImport");
    expect(auditArgs.data.entityId).toBe("new-import-id");
    const details = JSON.parse(auditArgs.data.details);
    expect(details.rowsImported).toBe(1);
    expect(details.fileName).toBe("planning.ods");
    expect(details).not.toHaveProperty("resolvedShifts");

    expect(result.importId).toBe("new-import-id");
    expect(result.rowsImported).toBe(1);
  });

  it("ne crée pas de PlanningShift si la preview est vide, mais log quand même l'import", async () => {
    await commitPlanningImport(previewFor([]), {
      teamId: "team-X",
      importedById: null,
      importedByEmail: null,
      fileName: null,
    });
    expect(createImport).toHaveBeenCalledOnce();
    expect(createManyShift).not.toHaveBeenCalled();
    expect(createAudit).toHaveBeenCalledOnce();
  });

  it("propage l'échec si createMany rejette → la transaction rollback", async () => {
    createManyShift.mockRejectedValue(new Error("insert failed"));
    const preview = previewFor([
      {
        agentId: "agent-A",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600_000),
        jsNumber: null,
        jsCode: null,
      },
    ]);
    await expect(
      commitPlanningImport(preview, {
        teamId: "team-X",
        importedById: null,
        importedByEmail: null,
        fileName: null,
      }),
    ).rejects.toThrow(/insert failed/);
    // L'audit n'a pas été créé après l'échec.
    expect(createAudit).not.toHaveBeenCalled();
  });

  it("sérialise unknownMatricules et rawUchSummary en JSON dans l'enregistrement", async () => {
    const preview = {
      ...previewFor([]),
      unknownMatricules: ["XYZ"],
      rawUchSummary: { byAppartenance: { ONDAINE: 3 }, byAffectation: {} },
    };
    await commitPlanningImport(preview, {
      teamId: "team-X",
      importedById: null,
      importedByEmail: null,
      fileName: null,
    });
    const args = createImport.mock.calls[0][0];
    expect(args.data.unknownMatricules).toBe(JSON.stringify(["XYZ"]));
    expect(JSON.parse(args.data.rawUchSummary)).toEqual({
      byAppartenance: { ONDAINE: 3 },
      byAffectation: {},
    });
  });
});
