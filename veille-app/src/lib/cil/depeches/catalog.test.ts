import { describe, expect, it } from "vitest";
import {
  DEPECHE_TEMPLATES,
  getTemplateForSubtype,
  renderDepecheTemplate,
  renderTemplateText,
} from "./catalog";
import { DEPECHE_SUBTYPES } from "../types";

describe("catalogue de dépêches", () => {
  it("un modèle par sous-type standard (tous sauf LIBRE)", () => {
    for (const s of DEPECHE_SUBTYPES) {
      if (s === "LIBRE") continue;
      expect(getTemplateForSubtype(s), `template manquant pour ${s}`).toBeDefined();
    }
  });

  it("chaque variable déclarée apparaît dans le texte", () => {
    for (const tpl of DEPECHE_TEMPLATES) {
      for (const v of tpl.variables) {
        expect(tpl.text, `${tpl.id} doit contenir {{${v.name}}}`).toContain(
          `{{${v.name}}}`,
        );
      }
    }
  });
});

describe("renderDepecheTemplate", () => {
  it("remplit les placeholders fournis", () => {
    const out = renderDepecheTemplate("protection-electrique", {
      cil: "MARTIN",
      evenement: "incendie poste",
      voies: "1 et 2",
      km: "12,300",
      motif: "feu de broussailles",
      destinataire: "CRC de Lyon",
    });
    expect(out).toContain("M. MARTIN, CIL, à CRC de Lyon");
    expect(out).toContain("suite à (l'événement) incendie poste sur voie(s) 1 et 2 au kilomètre 12,300");
    expect(out).toContain("Motif : feu de broussailles");
    expect(out).not.toContain("{{");
  });

  it("laisse une chaîne vide pour une variable absente", () => {
    const out = renderDepecheTemplate("retablissement-partiel", { cil: "X" });
    expect(out).not.toContain("{{");
    expect(out).toContain("M. X, CIL, à RSS de Lyon");
  });

  it("renvoie '' pour un id inconnu", () => {
    expect(renderDepecheTemplate("inexistant", {})).toBe("");
  });
});

describe("renderTemplateText", () => {
  it("substitue toutes les occurrences", () => {
    expect(renderTemplateText("{{a}}-{{b}}-{{a}}", { a: "1", b: "2" })).toBe("1-2-1");
  });
});
