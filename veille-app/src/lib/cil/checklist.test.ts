import { describe, expect, it } from "vitest";
import { computeChecklists } from "./checklist";
import type {
  CilDepecheDTO,
  CilIntervenantDTO,
  CilSignatureDTO,
} from "./types";

function depeche(over: Partial<CilDepecheDTO> = {}): CilDepecheDTO {
  return {
    id: "d1",
    subtype: "PROTECTION_CIRCULATION",
    interlocutor: "CRC",
    sens: null,
    texte: "M. … CIL",
    numeroDonne: 10,
    numeroRecu: null,
    collationne: false,
    occurredAt: "2026-07-16T12:00:00Z",
    avisCrcAt: null,
    avisCosAt: null,
    avisOpjAt: null,
    departEffectifAt: null,
    repriseAuthorization: null,
    geometry: {},
    destinataires: [],
    ...over,
  };
}

function intervenant(over: Partial<CilIntervenantDTO> = {}): CilIntervenantDTO {
  return {
    id: "i1",
    type: "COS",
    typeLibre: null,
    nom: "Dupont",
    tel: null,
    arrivedAt: null,
    departedAt: null,
    ...over,
  };
}

describe("computeChecklists — dépêches", () => {
  it("exclut les dépêches libres", () => {
    const res = computeChecklists([depeche({ subtype: "LIBRE" })], [], []);
    expect(res.depeches).toHaveLength(0);
  });

  it("protection : items dépêche/collationnement/n° attribué/n° reçu, complète quand tout est fait", () => {
    const res = computeChecklists(
      [depeche({ collationne: true, numeroRecu: "27" })],
      [],
      [],
    );
    const cl = res.depeches[0];
    expect(cl.items.map((i) => i.done)).toEqual([true, true, true, true]);
    expect(cl.complete).toBe(true);
  });

  it("protection incomplète si n° reçu manquant", () => {
    const res = computeChecklists([depeche({ collationne: true })], [], []);
    expect(res.depeches[0].complete).toBe(false);
  });

  it("reprise : ajoute l'item signature, coché si une signature DEPECHE existe", () => {
    const d = depeche({ id: "dR", subtype: "REPRISE_NORMALE", numeroDonne: 30 });
    const sig: CilSignatureDTO = {
      id: "s1",
      ownerType: "DEPECHE",
      ownerId: "dR",
      signerName: null,
      signerRole: null,
      imageB64: "AAA",
    };
    const withSig = computeChecklists([d], [], [sig]).depeches[0];
    expect(withSig.items.some((i) => i.label === "Signature" && i.done)).toBe(true);
    const withoutSig = computeChecklists([d], [], []).depeches[0];
    expect(withoutSig.items.some((i) => i.label === "Signature" && !i.done)).toBe(true);
  });
});

describe("computeChecklists — intervenants", () => {
  it("Pompes Funèbres : incomplet sans départ, complet avec départ", () => {
    const pfNoDepart = computeChecklists([], [intervenant({ type: "POMPES_FUNEBRES" })], []);
    expect(pfNoDepart.intervenants[0].complete).toBe(false);
    const pfDepart = computeChecklists(
      [],
      [intervenant({ type: "POMPES_FUNEBRES", departedAt: "2026-07-16T13:00:00Z" })],
      [],
    );
    expect(pfDepart.intervenants[0].complete).toBe(true);
  });

  it("autre intervenant : complet dès qu'une arrivée OU un départ est saisi", () => {
    const arr = computeChecklists([], [intervenant({ arrivedAt: "x" })], []);
    expect(arr.intervenants[0].complete).toBe(true);
    const none = computeChecklists([], [intervenant()], []);
    expect(none.intervenants[0].complete).toBe(false);
  });
});
