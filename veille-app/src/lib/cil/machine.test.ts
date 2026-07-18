import { describe, expect, it } from "vitest";
import {
  activeProtections,
  canWrite,
  computeAvailableActions,
  derivePhase,
  isPresent,
  missingRequirementsMessage,
  pendingReminders,
  protectionLane,
  repriseAllowed,
  type IntervenantPresence,
  type MachineContext,
} from "./machine";
import type { DepecheSubtype } from "./types";

function ctx(over: Partial<MachineContext> = {}): MachineContext {
  return {
    status: "OPEN",
    arrivedOnSiteAt: null,
    depecheSubtypes: [],
    role: "USER",
    ...over,
  };
}

const ids = (over: Partial<MachineContext> = {}) =>
  computeAvailableActions(ctx(over)).map((a) => a.id);

describe("activeProtections (dérivées)", () => {
  it("circulation active après protection, levée après reprise normale", () => {
    expect(activeProtections(ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION"] })).circulation).toBe(true);
    expect(
      activeProtections(
        ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION", "REPRISE_PARTIELLE"] }),
      ).circulation,
    ).toBe(true); // partielle ne lève pas
    expect(
      activeProtections(
        ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION", "REPRISE_NORMALE"] }),
      ).circulation,
    ).toBe(false);
  });
  it("électrique active après protection, levée après rétablissement normal", () => {
    expect(activeProtections(ctx({ depecheSubtypes: ["PROTECTION_ELECTRIQUE"] })).electrique).toBe(true);
    expect(
      activeProtections(
        ctx({ depecheSubtypes: ["PROTECTION_ELECTRIQUE", "RETABLISSEMENT_NORMAL"] }),
      ).electrique,
    ).toBe(false);
  });
});

describe("derivePhase", () => {
  it("MISSION avant arrivée", () => {
    expect(derivePhase(ctx())).toBe("MISSION");
  });
  it("ON_SITE après arrivée sans protection", () => {
    expect(derivePhase(ctx({ arrivedOnSiteAt: "2026-07-16T12:00:00Z" }))).toBe("ON_SITE");
  });
  it("INTERVENTION avec protection active", () => {
    expect(
      derivePhase(ctx({ arrivedOnSiteAt: "x", depecheSubtypes: ["PROTECTION_CIRCULATION"] })),
    ).toBe("INTERVENTION");
  });
  it("REPRISE quand toutes les protections sont levées", () => {
    expect(
      derivePhase(
        ctx({
          arrivedOnSiteAt: "x",
          depecheSubtypes: ["PROTECTION_CIRCULATION", "REPRISE_NORMALE"],
        }),
      ),
    ).toBe("REPRISE");
  });
  it("CLOSED si status CLOSED", () => {
    expect(derivePhase(ctx({ status: "CLOSED" }))).toBe("CLOSED");
  });
});

describe("computeAvailableActions", () => {
  it("propose l'arrivée en action primaire tant qu'elle n'est pas déclarée", () => {
    const actions = computeAvailableActions(ctx());
    const arrival = actions.find((a) => a.id === "DECLARE_ARRIVAL");
    expect(arrival?.primary).toBe(true);
  });

  it("ne propose plus l'arrivée une fois déclarée", () => {
    expect(ids({ arrivedOnSiteAt: "x" })).not.toContain("DECLARE_ARRIVAL");
  });

  it("avertit (soft) si on crée une protection avant l'arrivée, sans bloquer", () => {
    const a = computeAvailableActions(ctx()).find(
      (x) => x.id === "ADD_PROTECTION_CIRCULATION",
    );
    expect(a).toBeDefined();
    expect(a?.warning).toMatch(/arriv/i);
  });

  it("ne propose reprise/rétablissement que si la protection est active", () => {
    expect(ids({ arrivedOnSiteAt: "x" })).not.toContain("ADD_REPRISE_NORMALE");
    const withCirc = ids({
      arrivedOnSiteAt: "x",
      depecheSubtypes: ["PROTECTION_CIRCULATION"],
    });
    expect(withCirc).toContain("ADD_REPRISE_PARTIELLE");
    expect(withCirc).toContain("ADD_REPRISE_NORMALE");
    expect(withCirc).not.toContain("ADD_RETABLISSEMENT_NORMAL");
  });

  it("ne propose pas de recréer une protection déjà active", () => {
    const withCirc = ids({
      arrivedOnSiteAt: "x",
      depecheSubtypes: ["PROTECTION_CIRCULATION"],
    });
    expect(withCirc).not.toContain("ADD_PROTECTION_CIRCULATION");
    expect(withCirc).toContain("ADD_PROTECTION_ELECTRIQUE");
  });

  it("clôture avertit si une protection est encore active", () => {
    const close = computeAvailableActions(
      ctx({ arrivedOnSiteAt: "x", depecheSubtypes: ["PROTECTION_ELECTRIQUE"] }),
    ).find((a) => a.id === "CLOSE");
    expect(close?.warning).toMatch(/protection/i);
  });

  it("incident CLOSED : seul REOPEN, réservé EDITOR/ADMIN", () => {
    expect(ids({ status: "CLOSED", role: "USER" })).toEqual([]);
    expect(ids({ status: "CLOSED", role: "EDITOR" })).toEqual(["REOPEN"]);
    expect(ids({ status: "CLOSED", role: "ADMIN" })).toEqual(["REOPEN"]);
  });

  it("actions toujours disponibles quand OPEN", () => {
    const base = ids({ arrivedOnSiteAt: "x" });
    for (const id of [
      "ADD_INTERVENANT",
      "ADD_DEPECHE_LIBRE",
      "CHANGE_CIL",
      "ADD_NOTE",
      "CLOSE",
    ] as const) {
      expect(base).toContain(id);
    }
  });
});

describe("repriseAllowed (garde-fou autorisations + signatures)", () => {
  const present = (type: string): IntervenantPresence => ({ type, arrivedAt: "x", departedAt: null });
  const departed = (type: string): IntervenantPresence => ({ type, arrivedAt: "x", departedAt: "y" });
  const OK = { authorized: true, signed: true };
  const KO = { authorized: false, signed: false };

  it("aucun présent → autorisé", () => {
    expect(repriseAllowed([], { COS: KO, OPJ: KO }).ok).toBe(true);
  });

  it("COS présent sans rien → autorisation ET signature manquantes", () => {
    const r = repriseAllowed([present("COS")], { COS: KO, OPJ: KO });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ role: "COS", needs: ["autorisation", "signature"] }]);
  });

  it("autorisation SANS signature → toujours bloqué", () => {
    const r = repriseAllowed([present("COS")], {
      COS: { authorized: true, signed: false },
      OPJ: KO,
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ role: "COS", needs: ["signature"] }]);
  });

  it("signature SANS autorisation → toujours bloqué", () => {
    const r = repriseAllowed([present("COS")], {
      COS: { authorized: false, signed: true },
      OPJ: KO,
    });
    expect(r.missing).toEqual([{ role: "COS", needs: ["autorisation"] }]);
  });

  it("autorisation + signature → autorisé", () => {
    expect(repriseAllowed([present("COS")], { COS: OK, OPJ: KO }).ok).toBe(true);
  });

  it("COS parti → plus rien exigé", () => {
    expect(repriseAllowed([departed("COS")], { COS: KO, OPJ: KO }).ok).toBe(true);
  });

  it("COS et OPJ présents → les deux doivent autoriser ET signer", () => {
    const r = repriseAllowed([present("COS"), present("OPJ")], { COS: OK, OPJ: KO });
    expect(r.missing).toEqual([{ role: "OPJ", needs: ["autorisation", "signature"] }]);
    expect(repriseAllowed([present("COS"), present("OPJ")], { COS: OK, OPJ: OK }).ok).toBe(true);
  });

  it("message lisible de ce qui manque", () => {
    const r = repriseAllowed([present("COS")], { COS: { authorized: true, signed: false }, OPJ: KO });
    expect(missingRequirementsMessage(r.missing)).toBe(
      "Reprise impossible : il manque COS (signature).",
    );
  });

  it("isPresent : arrivé et non reparti", () => {
    expect(isPresent([present("COS")], "COS")).toBe(true);
    expect(isPresent([departed("COS")], "COS")).toBe(false);
    expect(isPresent([{ type: "COS", arrivedAt: null, departedAt: null }], "COS")).toBe(false);
  });
});

describe("protectionLane (fils de protection)", () => {
  it("circulation : created → active → levée par reprise normale", () => {
    expect(protectionLane("CIRCULATION", ctx()).created).toBe(false);
    const created = protectionLane("CIRCULATION", ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION"] }));
    expect(created).toMatchObject({ created: true, active: true, lifted: false });
    const partial = protectionLane("CIRCULATION", ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION", "REPRISE_PARTIELLE"] }));
    expect(partial).toMatchObject({ active: true, partialDone: true, lifted: false });
    const lifted = protectionLane("CIRCULATION", ctx({ depecheSubtypes: ["PROTECTION_CIRCULATION", "REPRISE_NORMALE"] }));
    expect(lifted).toMatchObject({ active: false, lifted: true });
  });
  it("électrique : levée par rétablissement normal", () => {
    const lifted = protectionLane("ELECTRIQUE", ctx({ depecheSubtypes: ["PROTECTION_ELECTRIQUE", "RETABLISSEMENT_NORMAL"] }));
    expect(lifted).toMatchObject({ created: true, active: false, lifted: true });
  });
});

describe("canWrite (invariant dur)", () => {
  it("autorise si OPEN, refuse si CLOSED", () => {
    expect(canWrite({ status: "OPEN" })).toBe(true);
    expect(canWrite({ status: "CLOSED" })).toBe(false);
  });
});

describe("pendingReminders (avis obligatoires)", () => {
  const present = (type: string): IntervenantPresence => ({
    type,
    arrivedAt: "2026-07-16T12:00:00Z",
    departedAt: null,
  });
  const protCrc = (over = {}) => ({
    id: "p",
    subtype: "PROTECTION_CIRCULATION" as DepecheSubtype,
    interlocutor: "CRC",
    avisCrcAt: null,
    avisCosAt: null,
    avisOpjAt: null,
    ...over,
  });

  it("rappelle d'aviser chaque autorité présente sans heure d'avis", () => {
    const r = pendingReminders({
      depeches: [protCrc()],
      intervenants: [present("COS"), present("OPJ")],
    });
    expect(r.map((x) => x.field).sort()).toEqual(["avisCosAt", "avisOpjAt"]);
    expect(r[0]).toMatchObject({ target: "DEPECHE", targetId: "p" });
  });

  it("ne rappelle rien si l'avis est horodaté ou l'autorité absente", () => {
    expect(
      pendingReminders({
        depeches: [protCrc({ avisCosAt: "2026-07-16T13:00:00Z" })],
        intervenants: [present("COS")],
      }),
    ).toEqual([]);
    // COS arrivé APRÈS la protection → le rappel apparaît alors.
    expect(pendingReminders({ depeches: [protCrc()], intervenants: [] })).toEqual([]);
  });

  it("ignore la 2ᵉ dépêche de protection (RSS/AC) : l'avis est porté par le CRC", () => {
    const r = pendingReminders({
      depeches: [protCrc({ id: "s", interlocutor: "AC" })],
      intervenants: [present("COS")],
    });
    expect(r).toEqual([]);
  });

  it("rappelle l'avis au CRC après une reprise sans heure", () => {
    const base = { interlocutor: "CRC", avisCrcAt: null, avisCosAt: null, avisOpjAt: null };
    const r = pendingReminders({
      depeches: [
        { id: "a", subtype: "REPRISE_NORMALE", ...base },
        { id: "b", subtype: "RETABLISSEMENT_PARTIEL", ...base, avisCrcAt: "2026-07-16T14:00:00Z" },
      ],
      intervenants: [],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ targetId: "a", field: "avisCrcAt" });
  });
});

describe("pendingReminders — changement de CIL", () => {
  const chg = (metadata: Record<string, unknown> | null) => ({
    id: "e1",
    type: "CHANGEMENT_CIL",
    metadata,
  });

  it("réclame l'avis à l'AC et au CRC, et aux autorités présentes", () => {
    const r = pendingReminders({
      depeches: [],
      intervenants: [{ type: "COS", arrivedAt: "x", departedAt: null }],
      events: [chg(null)],
    });
    expect(r.map((x) => x.field).sort()).toEqual(["avis_ac", "avis_cos", "avis_crc"]);
    expect(r[0]).toMatchObject({ target: "EVENT", targetId: "e1" });
  });

  it("ne réclame plus un avis déjà horodaté", () => {
    const r = pendingReminders({
      depeches: [],
      intervenants: [],
      events: [chg({ avis_ac: "2026-07-18T10:00:00Z" })],
    });
    expect(r.map((x) => x.field)).toEqual(["avis_crc"]);
  });

  it("n'exige pas l'avis d'une autorité absente", () => {
    const r = pendingReminders({
      depeches: [],
      intervenants: [{ type: "OPJ", arrivedAt: "x", departedAt: "y" }],
      events: [chg({ avis_ac: "t", avis_crc: "t" })],
    });
    expect(r).toEqual([]);
  });
});

// Garde-fou : tous les subtypes sont couverts par la dérivation.
describe("exhaustivité subtypes", () => {
  it("chaque subtype protection est reconnu", () => {
    const subs: DepecheSubtype[] = ["PROTECTION_CIRCULATION", "PROTECTION_ELECTRIQUE"];
    for (const s of subs) {
      expect(activeProtections(ctx({ depecheSubtypes: [s] }))).toBeDefined();
    }
  });
});
