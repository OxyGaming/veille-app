import { describe, expect, it } from "vitest";
import { buildCilDocxData, livretCilDocxFilename } from "./data";
import type {
  CilDepecheDTO,
  CilIncidentDTO,
  CilIncidentFull,
  CilSignatureDTO,
} from "../types";

const iso = (m: number) =>
  new Date(Date.parse("2026-07-16T12:02:00Z") + m * 60000).toISOString();

function incident(over: Partial<CilIncidentDTO> = {}): CilIncidentDTO {
  return {
    id: "x", status: "OPEN", reference: "1607261402-Givors", type: "INCENDIE",
    typeLibre: null, occurredAt: iso(0), lieu: "Givors-Canal", poste: "PRG", voie: "1",
    observations: null, gareMode: "UNIQUE", gareUnique: "Givors", gareA: null, gareB: null,
    voies: null, km: null, acLabel: null, motif: null,
    cilNom: "MARTIN", cilPrenom: "Paul", cilEtablissement: "INFP_RHN",
    designatedAt: iso(6), arrivedOnSiteAt: iso(29), closedAt: null, ...over,
  };
}

function dep(over: Partial<CilDepecheDTO>): CilDepecheDTO {
  return {
    id: "d", subtype: "PROTECTION_ELECTRIQUE", interlocutor: "CRC", sens: null,
    texte: "…", numeroDonne: 10, numeroRecu: null, collationne: false, occurredAt: iso(33),
    avisCrcAt: null, avisCosAt: null, avisOpjAt: null, departEffectifAt: null,
    repriseAuthorization: null, geometry: {}, destinataires: [], ...over,
  };
}

function full(over: Partial<CilIncidentFull> = {}): CilIncidentFull {
  return { incident: incident(), events: [], depeches: [], intervenants: [], signatures: [], autorisations: [], ...over };
}

describe("buildCilDocxData — en-tête", () => {
  it("remplit les champs et coche l'établissement RHN", () => {
    const d = buildCilDocxData(full());
    expect(d.txt_dateHeure).toBe("16/07/2026 à 14h02");
    expect(d.txt_incident).toBe("Incendie");
    expect(d.txt_lieu).toBe("Givors-Canal");
    expect(d.txt_nomCil).toBe("MARTIN Paul");
    expect(d.txt_designeA).toBe("14h08");
    expect(d.check_etab_rhn).toBe("☒");
    expect(d.check_etab_ral).toBe("☐");
    expect(d.check_etab_lgv).toBe("☐");
  });
});

describe("buildCilDocxData — protections à 2 dépêches", () => {
  it("mappe CRC + RSS (électrique) et CRC + AC (circulation)", () => {
    const d = buildCilDocxData(
      full({
        depeches: [
          dep({ id: "ec", subtype: "PROTECTION_ELECTRIQUE", interlocutor: "CRC", numeroDonne: 10, numeroRecu: "27", avisCosAt: iso(40) }),
          dep({ id: "er", subtype: "PROTECTION_ELECTRIQUE", interlocutor: "RSS", numeroDonne: 11, numeroRecu: "31" }),
          dep({ id: "cc", subtype: "PROTECTION_CIRCULATION", interlocutor: "CRC", numeroDonne: 12, numeroRecu: "44" }),
          dep({ id: "ca", subtype: "PROTECTION_CIRCULATION", interlocutor: "AC", numeroDonne: 13, numeroRecu: "50" }),
        ],
      }),
    );
    expect(d.txt_prot_elec_crc_donne).toBe("10");
    expect(d.txt_prot_elec_crc_recu).toBe("27");
    expect(d.txt_prot_elec_rss_donne).toBe("11");
    expect(d.txt_prot_elec_rss_recu).toBe("31");
    expect(d.txt_prot_circ_crc_donne).toBe("12");
    expect(d.txt_prot_circ_ac_donne).toBe("13");
    expect(d.txt_prot_circ_ac_recu).toBe("50");
    expect(d.txt_prot_elec_avis_cos).toBe("le 16/07/2026 à 14h42");
  });
});

describe("buildCilDocxData — numéros barrés", () => {
  it("barre uniquement les numéros utilisés", () => {
    const d = buildCilDocxData(
      full({ depeches: [dep({ numeroDonne: 10 }), dep({ id: "b", numeroDonne: 30, subtype: "REPRISE_PARTIELLE", interlocutor: "CRC" })] }),
    );
    // 10 et 30 utilisés → barrés (chaque chiffre suivi du combining U+0336).
    expect(d.num_10).toBe("1̶" + "0̶");
    expect(d.num_30).toBe("3̶" + "0̶");
    // 11 libre → chaîne nue.
    expect(d.num_11).toBe("11");
    expect(d.num_69).toBe("69");
  });
});

describe("buildCilDocxData — intervenants & signatures", () => {
  it("mappe arrivée/départ/tél par type et les signatures COS/OPJ de la reprise", () => {
    const sig = (role: string, img: string): CilSignatureDTO => ({
      id: "s" + role, ownerType: "DEPECHE", ownerId: "rn", signerName: null, signerRole: role, imageB64: img,
    });
    const d = buildCilDocxData(
      full({
        depeches: [dep({ id: "rn", subtype: "REPRISE_NORMALE", interlocutor: "CRC", numeroDonne: 31 })],
        intervenants: [
          { id: "i1", type: "COS", typeLibre: null, nom: "Durand", tel: "0612345678", arrivedAt: iso(42), departedAt: iso(83) },
          { id: "i2", type: "EXF_TRACTION", typeLibre: null, nom: "T", tel: null, arrivedAt: iso(50), departedAt: null },
        ],
        signatures: [sig("COS", "AAA"), sig("OPJ", "BBB")],
      }),
    );
    expect(d.txt_arr_cos).toBe("14h44");
    expect(d.txt_dep_cos).toBe("15h25");
    expect(d.txt_arr_exft).toBe("14h52");
    expect(d.txt_tel_cos).toBe("0612345678");
    expect(d.txt_tel_opj).toBe("");
    // Signature de l'autorité, pas celle du CIL.
    expect(d.photo_sig_repn_cos).toBe("AAA");
    expect(d.photo_sig_repn_opj).toBe("BBB");
    // Pas de signature pour les autres cadres → clés absentes (PNG blanc au rendu).
    expect(d.photo_sig_repp_cos).toBeUndefined();
  });
});

describe("buildCilDocxData — localisation, avis, changement de CIL, carnet", () => {
  it("coche la gare unique et laisse les champs « entre les gares » vides", () => {
    const d = buildCilDocxData(full());
    expect(d.check_gare_engare).toBe("☒");
    expect(d.check_gare_entre).toBe("☐");
    expect(d.txt_gareUnique).toBe("Givors");
    expect(d.txt_gareA).toBe("");
  });

  it("coche « entre les gares » et n'imprime pas la gare unique", () => {
    const d = buildCilDocxData(
      full({ incident: incident({ gareMode: "BETWEEN", gareA: "A", gareB: "B", gareUnique: "Givors" }) }),
    );
    expect(d.check_gare_entre).toBe("☒");
    expect(d.txt_gareA).toBe("A");
    expect(d.txt_gareB).toBe("B");
    expect(d.txt_gareUnique).toBe("");
  });

  it("rend les autorisations COS/OPJ et l'avis au CRC d'une reprise", () => {
    const d = buildCilDocxData(
      full({
        depeches: [dep({ id: "rp", subtype: "REPRISE_PARTIELLE", interlocutor: "CRC", numeroDonne: 33, avisCosAt: iso(40), avisOpjAt: iso(41), avisCrcAt: iso(45) })],
      }),
    );
    expect(d.txt_repp_autor_cos).toBe("le 16/07/2026 à 14h42");
    expect(d.txt_repp_autor_opj).toBe("le 16/07/2026 à 14h43");
    expect(d.txt_repp_avis_crc).toBe("le 16/07/2026 à 14h47");
    // Cadre non utilisé → reste vierge.
    expect(d.txt_retn_avis_crc).toBe("");
  });

  it("rend le changement de CIL depuis l'événement et son metadata", () => {
    const d = buildCilDocxData(
      full({
        events: [{
          id: "e", type: "CHANGEMENT_CIL", occurredAt: iso(90), seq: 4,
          label: "Changement de CIL", note: null, actorName: null, refType: null, refId: null,
          metadata: { remplacant: "DUPONT Jean", avis_crc: iso(92) },
        }],
      }),
    );
    expect(d.txt_chg_cil).toBe("MARTIN Paul");
    expect(d.txt_chg_remplacant).toBe("DUPONT Jean");
    expect(d.txt_chg_heure).toBe("15h32");
    expect(d.txt_chg_crc).toBe("15h34");
    expect(d.txt_chg_cos).toBe("");
  });

  it("remplit le carnet avec une ligne par destinataire d'une dépêche libre", () => {
    const d = buildCilDocxData(
      full({
        depeches: [
          dep({ id: "l1", subtype: "LIBRE", interlocutor: "LIBRE", sens: "EXPEDIE", numeroDonne: 50, texte: "Texte A", occurredAt: iso(60),
            destinataires: [
              { id: "x", label: "AC de Givors", numeroRecu: "12" },
              { id: "y", label: "RSS", numeroRecu: null },
            ] }),
          dep({ id: "l2", subtype: "LIBRE", interlocutor: "LIBRE", sens: "RECU", numeroDonne: 51, texte: "Texte B", occurredAt: iso(70),
            destinataires: [{ id: "z", label: "CRC", numeroRecu: "7" }] }),
        ],
      }),
    );
    expect(d.txt_libre_1_num).toBe("50");
    expect(d.txt_libre_1_expedie).toBe("AC de Givors");
    expect(d.txt_libre_1_de).toBe("");
    expect(d.txt_libre_1_texte).toBe("Texte A");
    expect(d.txt_libre_1_recu).toBe("12");
    expect(d.txt_libre_2_expedie).toBe("RSS");
    // Dépêche reçue → la colonne « Reçu de » porte l'interlocuteur.
    expect(d.txt_libre_3_de).toBe("CRC");
    expect(d.txt_libre_3_expedie).toBe("");
    expect(d.txt_libre_3_heure).toBe("15h12");
    // Lignes restantes vierges.
    expect(d.txt_libre_28_num).toBe("");
  });
});

describe("buildCilDocxData — phrases (blancs inline)", () => {
  it("remplit le nom du CIL et la géométrie dans les phrases", () => {
    const d = buildCilDocxData(
      full({
        depeches: [
          dep({ id: "ec", subtype: "PROTECTION_ELECTRIQUE", interlocutor: "CRC", numeroDonne: 15, geometry: { voies: "1", km: "12,300", gareUnique: "Givors", motif: "feu" } }),
          dep({ id: "cc", subtype: "PROTECTION_CIRCULATION", interlocutor: "CRC", numeroDonne: 18, geometry: { voies: "1 et 2", km: "12,300", gareA: "A", gareB: "B", marcheInterdite: "1", marchePrudente: "2" } }),
          dep({ id: "rp", subtype: "REPRISE_PARTIELLE", interlocutor: "CRC", numeroDonne: 33, geometry: { voies: "1", km: "12,300", ac: "Givors" } }),
        ],
      }),
    );
    expect(d.txt_prot_elec_cil).toBe("MARTIN Paul");
    expect(d.txt_prot_elec_evenement).toBe("Incendie");
    expect(d.txt_prot_elec_voies).toBe("1");
    expect(d.txt_prot_elec_gareUnique).toBe("Givors");
    expect(d.txt_prot_elec_motif).toBe("feu");
    expect(d.txt_prot_circ_gareA).toBe("A");
    expect(d.txt_prot_circ_vi).toBe("1");
    expect(d.txt_prot_circ_vp).toBe("2");
    expect(d.txt_repp_cil).toBe("MARTIN Paul");
    expect(d.txt_repp_ac).toBe("Givors");
  });
});

describe("livretCilDocxFilename", () => {
  it("utilise la référence", () => {
    expect(livretCilDocxFilename(full())).toBe("Livret-CIL-1607261402-Givors.docx");
  });
});
