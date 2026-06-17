import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks Prisma ────────────────────────────────────────────────────────────
const agentFindFirst = vi.fn();
const sessionFindMany = vi.fn();
const sightingFindMany = vi.fn();
const validationFindMany = vi.fn();
const actionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findFirst: (...a: unknown[]) => agentFindFirst(...a) },
    veilleSession: { findMany: (...a: unknown[]) => sessionFindMany(...a) },
    agentSighting: { findMany: (...a: unknown[]) => sightingFindMany(...a) },
    actionValidation: { findMany: (...a: unknown[]) => validationFindMany(...a) },
    importedAction: { findMany: (...a: unknown[]) => actionFindMany(...a) },
  },
}));

import { aggregateAgentDevelopment } from "./agent-development-aggregator";

// ── Fixtures ────────────────────────────────────────────────────────────────
const AGENT = {
  id: "agent-1",
  firstName: "Sebastien",
  lastName: "Aouadissian",
  matricule: "7906853F",
  team: { name: "Rive Droite Nord" },
};

function makeSession(opts: {
  startedAt: Date;
  procedures: Array<{
    procedureId: string;
    title: string;
    domain: string;
    items: Array<{
      id?: string;
      checklistItemId: string;
      label: string;
      status: string;
      comment?: string | null;
      recordedAt: Date;
    }>;
  }>;
  observerName?: string;
}) {
  return {
    id: `sess-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: opts.startedAt,
    observer: { name: opts.observerName ?? "Manager" },
    procedures: opts.procedures.map((po) => ({
      procedureId: po.procedureId,
      procedure: {
        id: po.procedureId,
        title: po.title,
        domain: po.domain,
      },
      items: po.items.map((it) => ({
        id: it.id ?? `it-${Math.random().toString(36).slice(2, 8)}`,
        checklistItemId: it.checklistItemId,
        checklistItem: { id: it.checklistItemId, label: it.label },
        status: it.status,
        comment: it.comment ?? null,
        recordedAt: it.recordedAt,
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  agentFindFirst.mockResolvedValue(AGENT);
  sessionFindMany.mockResolvedValue([]);
  sightingFindMany.mockResolvedValue([]);
  validationFindMany.mockResolvedValue([]);
  actionFindMany.mockResolvedValue([]);
});

describe("aggregateAgentDevelopment", () => {
  const FROM = new Date("2025-06-01T00:00:00Z");
  const TO = new Date("2026-06-01T00:00:00Z");

  it("renvoie null si l'agent est introuvable", async () => {
    agentFindFirst.mockResolvedValueOnce(null);
    const r = await aggregateAgentDevelopment("inconnu", FROM, TO);
    expect(r).toBeNull();
  });

  it("renvoie une fiche minimale (zéros) quand aucune donnée", async () => {
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r).not.toBeNull();
    expect(r!.counts.sessions).toBe(0);
    expect(r!.counts.observationsTotal).toBe(0);
    expect(r!.lowSample).toBe(true);
    expect(r!.trend).toBe("not-enough-data");
    // 12 mois de buckets de juin 2025 à juin 2026 (13 mois car bornes incluses).
    expect(r!.monthly.length).toBe(13);
    expect(r!.monthly[0].month).toBe("2025-06");
    expect(r!.silentMonths.length).toBe(13);
  });

  it("exclut NON_OBSERVE et NON_APPLICABLE des comptes", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-09-15T10:00:00Z"),
        procedures: [
          {
            procedureId: "proc-1",
            title: "Signal contrarié",
            domain: "Circulation",
            items: [
              { checklistItemId: "ci-1", label: "Item A", status: "CONFORME", recordedAt: new Date("2025-09-15T10:00:00Z") },
              { checklistItemId: "ci-2", label: "Item B", status: "NON_OBSERVE", recordedAt: new Date("2025-09-15T10:00:00Z") },
              { checklistItemId: "ci-3", label: "Item C", status: "NON_APPLICABLE", recordedAt: new Date("2025-09-15T10:00:00Z") },
            ],
          },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.counts.observationsTotal).toBe(1);
    expect(r!.counts.conforme).toBe(1);
  });

  it("compte sightings et notes séparément (kind=SIGHT vs NOTE)", async () => {
    sightingFindMany.mockResolvedValueOnce([
      { sightedAt: new Date("2025-10-01"), kind: "SIGHT", comment: null, observer: { name: "M" } },
      { sightedAt: new Date("2025-10-02"), kind: "SIGHT", comment: "RAS", observer: { name: "M" } },
      { sightedAt: new Date("2025-10-03"), kind: "NOTE", comment: "Bon réflexe", observer: { name: "M" } },
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.counts.sightings).toBe(2);
    expect(r!.counts.notes).toBe(1);
  });

  it("agrège les domaines, trie par total décroissant", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-09-15"),
        procedures: [
          {
            procedureId: "p1",
            title: "P1",
            domain: "Circulation",
            items: [
              { checklistItemId: "c1", label: "A", status: "CONFORME", recordedAt: new Date("2025-09-15") },
              { checklistItemId: "c2", label: "B", status: "NON_CONFORME", recordedAt: new Date("2025-09-15") },
              { checklistItemId: "c3", label: "C", status: "CONFORME", recordedAt: new Date("2025-09-15") },
            ],
          },
          {
            procedureId: "p2",
            title: "P2",
            domain: "Cybersécurité",
            items: [
              { checklistItemId: "c4", label: "D", status: "CONFORME", recordedAt: new Date("2025-09-15") },
            ],
          },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.byDomain[0].domain).toBe("Circulation");
    expect(r!.byDomain[0].total).toBe(3);
    expect(r!.byDomain[0].nonConforme).toBe(1);
    expect(r!.byDomain[1].domain).toBe("Cybersécurité");
    expect(r!.byDomain[1].total).toBe(1);
  });

  it("topConforme et topAxes triés correctement", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-09-15"),
        procedures: [
          {
            procedureId: "p1",
            title: "Proc Forte",
            domain: "Circulation",
            items: [
              { checklistItemId: "c1", label: "A", status: "CONFORME", recordedAt: new Date("2025-09-15") },
              { checklistItemId: "c2", label: "B", status: "CONFORME", recordedAt: new Date("2025-09-15") },
              { checklistItemId: "c3", label: "C", status: "CONFORME", recordedAt: new Date("2025-09-15") },
            ],
          },
          {
            procedureId: "p2",
            title: "Proc Faible",
            domain: "Circulation",
            items: [
              { checklistItemId: "c4", label: "D", status: "NON_CONFORME", recordedAt: new Date("2025-09-15") },
              { checklistItemId: "c5", label: "E", status: "A_REVOIR", recordedAt: new Date("2025-09-15") },
            ],
          },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.topConforme[0].title).toBe("Proc Forte");
    expect(r!.topConforme[0].conformeCount).toBe(3);
    expect(r!.topAxes[0].title).toBe("Proc Faible");
    expect(r!.topAxes[0].nonConformeCount).toBe(1);
    expect(r!.topAxes[0].aRevoirCount).toBe(1);
  });

  it("détecte les NC récurrentes (>= 2 occurrences sur le même item)", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-08-15"),
        procedures: [
          {
            procedureId: "p1",
            title: "P1",
            domain: "D",
            items: [
              { checklistItemId: "ITEM-X", label: "Transmission PN", status: "NON_CONFORME", recordedAt: new Date("2025-08-15") },
            ],
          },
        ],
      }),
      makeSession({
        startedAt: new Date("2025-10-15"),
        procedures: [
          {
            procedureId: "p1",
            title: "P1",
            domain: "D",
            items: [
              { checklistItemId: "ITEM-X", label: "Transmission PN", status: "A_REVOIR", recordedAt: new Date("2025-10-15") },
            ],
          },
        ],
      }),
      makeSession({
        startedAt: new Date("2025-11-15"),
        procedures: [
          {
            procedureId: "p1",
            title: "P1",
            domain: "D",
            items: [
              { checklistItemId: "ITEM-Y", label: "Autre", status: "NON_CONFORME", recordedAt: new Date("2025-11-15") },
            ],
          },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    // Seul ITEM-X a 2 occurrences ; ITEM-Y n'apparaît pas (1 seule).
    expect(r!.recurringNCs.length).toBe(1);
    expect(r!.recurringNCs[0].checklistItemId).toBe("ITEM-X");
    expect(r!.recurringNCs[0].occurrences).toBe(2);
  });

  it("extrait commentaires positifs et d'attention, max 5 chacun, plus récents d'abord", async () => {
    const sessions = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(2025, 8, i + 1);
      return makeSession({
        startedAt: date,
        procedures: [
          {
            procedureId: "p1",
            title: "P1",
            domain: "D",
            items: [
              { checklistItemId: `c-${i}`, label: `Item ${i}`, status: "CONFORME", comment: `Positif ${i}`, recordedAt: date },
              { checklistItemId: `n-${i}`, label: `Item ${i}`, status: "NON_CONFORME", comment: `Attention ${i}`, recordedAt: date },
            ],
          },
        ],
      });
    });
    sessionFindMany.mockResolvedValueOnce(sessions);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.positiveComments.length).toBe(5);
    expect(r!.attentionComments.length).toBe(5);
    // Le plus récent doit être en tête (date du 7 = index 6).
    expect(r!.positiveComments[0].comment).toBe("Positif 6");
    expect(r!.attentionComments[0].comment).toBe("Attention 6");
  });

  it("calcule silentMonths = mois sans aucune session ni sighting", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-09-15"),
        procedures: [
          { procedureId: "p1", title: "P1", domain: "D", items: [
            { checklistItemId: "c", label: "X", status: "CONFORME", recordedAt: new Date("2025-09-15") },
          ] },
        ],
      }),
    ]);
    sightingFindMany.mockResolvedValueOnce([
      { sightedAt: new Date("2026-02-10"), kind: "SIGHT", comment: null, observer: { name: "M" } },
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    // Mois actifs : 2025-09 et 2026-02. Tous les autres mois entre 2025-06 et 2026-06 sont silencieux.
    expect(r!.silentMonths).not.toContain("2025-09");
    expect(r!.silentMonths).not.toContain("2026-02");
    expect(r!.silentMonths).toContain("2025-07");
    expect(r!.silentMonths).toContain("2026-04");
  });

  it("trend = decreasing-nc quand la 2e moitié a moins de NC", async () => {
    sessionFindMany.mockResolvedValueOnce([
      // 1ère moitié (juin 2025 - décembre 2025) : 3 obs, 2 NC = 66%
      makeSession({
        startedAt: new Date("2025-09-15"),
        procedures: [
          { procedureId: "p1", title: "P1", domain: "D", items: [
            { checklistItemId: "c1", label: "X", status: "NON_CONFORME", recordedAt: new Date("2025-09-15") },
            { checklistItemId: "c2", label: "Y", status: "NON_CONFORME", recordedAt: new Date("2025-09-15") },
            { checklistItemId: "c3", label: "Z", status: "CONFORME", recordedAt: new Date("2025-09-15") },
          ] },
        ],
      }),
      // 2e moitié (décembre 2025 - juin 2026) : 4 obs, 0 NC = 0%
      makeSession({
        startedAt: new Date("2026-03-15"),
        procedures: [
          { procedureId: "p1", title: "P1", domain: "D", items: [
            { checklistItemId: "c4", label: "A", status: "CONFORME", recordedAt: new Date("2026-03-15") },
            { checklistItemId: "c5", label: "B", status: "CONFORME", recordedAt: new Date("2026-03-15") },
            { checklistItemId: "c6", label: "C", status: "CONFORME", recordedAt: new Date("2026-03-15") },
            { checklistItemId: "c7", label: "D", status: "CONFORME", recordedAt: new Date("2026-03-15") },
          ] },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.trend).toBe("decreasing-nc");
  });

  it("lowSample vrai quand peu de données, faux quand suffisamment", async () => {
    // 3 sessions => suffisant
    sessionFindMany.mockResolvedValueOnce([
      makeSession({ startedAt: new Date("2025-09-15"), procedures: [] }),
      makeSession({ startedAt: new Date("2025-10-15"), procedures: [] }),
      makeSession({ startedAt: new Date("2025-11-15"), procedures: [] }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.lowSample).toBe(false);
  });

  it("buckets mensuels rangent les obs au bon mois", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({
        startedAt: new Date("2025-09-15"),
        procedures: [
          {
            procedureId: "p1", title: "P1", domain: "D",
            items: [
              { checklistItemId: "c1", label: "X", status: "CONFORME", recordedAt: new Date("2025-09-15T10:00:00Z") },
              { checklistItemId: "c2", label: "Y", status: "NON_CONFORME", recordedAt: new Date("2026-01-15T10:00:00Z") },
            ],
          },
        ],
      }),
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    const sept = r!.monthly.find((m) => m.month === "2025-09")!;
    const jan = r!.monthly.find((m) => m.month === "2026-01")!;
    expect(sept.conforme).toBe(1);
    expect(sept.nonConforme).toBe(0);
    expect(jan.conforme).toBe(0);
    expect(jan.nonConforme).toBe(1);
  });

  it("timeline regroupe sessions + sightings + validations et trie desc", async () => {
    sessionFindMany.mockResolvedValueOnce([
      makeSession({ startedAt: new Date("2025-09-01"), procedures: [] }),
    ]);
    sightingFindMany.mockResolvedValueOnce([
      { sightedAt: new Date("2025-10-01"), kind: "SIGHT", comment: "Vu", observer: { name: "M" } },
    ]);
    validationFindMany.mockResolvedValueOnce([
      {
        realizedAt: new Date("2025-11-01"),
        comment: null,
        action: { comment: "AA 100%", keyPoint: null, theme: null, domain: null },
        validatedBy: { name: "M" },
      },
    ]);
    const r = await aggregateAgentDevelopment(AGENT.id, FROM, TO);
    expect(r!.timeline.length).toBe(3);
    expect(r!.timeline[0].type).toBe("validation");
    expect(r!.timeline[1].type).toBe("sighting");
    expect(r!.timeline[2].type).toBe("session");
  });
});
