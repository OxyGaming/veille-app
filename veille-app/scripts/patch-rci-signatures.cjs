/**
 * Patch du template RCI : enrichit le tableau « RCI établi par + signatures ».
 *
 * Ajoute, par rapport au template v10 d'origine :
 *  - colonne Établissement saisissable pour chaque intervenant
 *  - 2 lignes SNCF Réseau supplémentaires (sous-rôle + établissement libres)
 *  - réalignement des lignes Autres GI / EF (nom/fonction et tél étaient décalés)
 *  - section conditionnelle « Non présent sur place » dans chaque cellule signature
 *
 * Idempotent dans l'esprit : part toujours du template fourni en entrée et
 * réécrit intégralement les cellules ciblées (préserve tcPr : bordures/largeur).
 *
 * Usage : node scripts/patch-rci-signatures.cjs <in.docx> <out.docx>
 */
const fs = require("fs");
const PizZip = require("pizzip");

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Usage: node patch-rci-signatures.cjs <in.docx> <out.docx>");
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(inPath));
let xml = zip.file("word/document.xml").asText();

// Toutes les cellules, avec position (index) et longueur pour un splice fiable.
const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
const cells = [];
let m;
while ((m = cellRe.exec(xml)) !== null) {
  cells.push({ index: m.index, length: m[0].length, text: m[0] });
}
console.log("Cellules détectées :", cells.length);

// Extrait <w:tc><w:tcPr>...</w:tcPr> d'une cellule pour préserver son style.
function tcPrefix(cellText) {
  const mm = cellText.match(/^(<w:tc\b[^>]*>\s*<w:tcPr>[\s\S]*?<\/w:tcPr>)/);
  if (!mm) throw new Error("tcPr introuvable dans la cellule");
  return mm[1];
}

const RPR_BOLD16 =
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';
const RPR_16 =
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';

// Construit une cellule « texte » : un seul run centré contenant le placeholder.
function textCell(origText, tag) {
  const para =
    `<w:p><w:pPr><w:suppressAutoHyphens/><w:jc w:val="center"/>${RPR_BOLD16}</w:pPr>` +
    `<w:r>${RPR_BOLD16}<w:t xml:space="preserve">{${tag}}</w:t></w:r></w:p>`;
  return tcPrefix(origText) + para + "</w:tc>";
}

// Construit une cellule « signature » : section conditionnelle absent / image.
// IMPORTANT : l'ImageModule exige que `{%photo}` soit SEUL dans son <w:t>.
// On isole donc le tag image dans son propre run ; les balises de section
// ouvrante/fermante sont dans des runs distincts. Tout reste dans UN paragraphe
// (pas de ligne vide résiduelle selon la branche rendue).
//   Run 1 : {#absent}Non présent sur place{/absent}{^absent}
//   Run 2 : {%photo_data}            ← seul dans son <w:t>
//   Run 3 : {/absent}
function sigCell(origText, absentKey, dataKey) {
  const run = (txt) =>
    `<w:r>${RPR_16}<w:t xml:space="preserve">${txt}</w:t></w:r>`;
  const para =
    `<w:p><w:pPr><w:suppressAutoHyphens/><w:jc w:val="center"/>${RPR_16}</w:pPr>` +
    run(`{#${absentKey}}Non présent sur place{/${absentKey}}{^${absentKey}}`) +
    run(`{%photo_${dataKey}}`) +
    run(`{/${absentKey}}`) +
    "</w:p>";
  return tcPrefix(origText) + para + "</w:tc>";
}

// Mapping index de cellule → nouveau contenu.
// (indices issus de l'analyse du template : cf. conversation)
const TEXT_CELLS = {
  292: "txt_sig_eic_etablissement",
  297: "txt_sig_sncf2_sous_role",
  298: "txt_sig_sncf2_etablissement",
  299: "txt_sig_sncf2_nom_fonction",
  300: "txt_sig_sncf2_tel",
  303: "txt_sig_sncf3_sous_role",
  304: "txt_sig_sncf3_etablissement",
  305: "txt_sig_sncf3_nom_fonction",
  306: "txt_sig_sncf3_tel",
  310: "txt_sig_autres_gi_etablissement",
  311: "txt_sig_autres_gi_nom_fonction",
  312: "txt_sig_autres_gi_tel",
  316: "txt_sig_ef1_etablissement",
  317: "txt_sig_ef1_nom_fonction",
  318: "txt_sig_ef1_tel",
  322: "txt_sig_ef2_etablissement",
  323: "txt_sig_ef2_nom_fonction",
  324: "txt_sig_ef2_tel",
};
const SIG_CELLS = {
  295: ["sig_eic_absent", "sig_eic_data"],
  301: ["sig_sncf2_absent", "sig_sncf2_data"],
  307: ["sig_sncf3_absent", "sig_sncf3_data"],
  313: ["sig_autres_gi_absent", "sig_autres_gi_data"],
  319: ["sig_ef1_absent", "sig_ef1_data"],
  325: ["sig_ef2_absent", "sig_ef2_data"],
};

// Garde-fou : vérifie qu'on cible bien les bonnes cellules (largeurs attendues).
function widthOf(text) {
  const w = text.match(/w:w="(\d+)"/);
  return w ? w[1] : "?";
}
const EXPECT_TEXT_W = {
  292: "1920", 297: "1372", 298: "1920", 299: "2056", 300: "1783",
  303: "1372", 304: "1920", 305: "2056", 306: "1783",
  310: "1920", 311: "2056", 312: "1783",
  316: "1920", 317: "2056", 318: "1783",
  322: "1920", 323: "2056", 324: "1783",
};
for (const [idx, expW] of Object.entries(EXPECT_TEXT_W)) {
  const got = widthOf(cells[idx].text);
  if (got !== expW) {
    throw new Error(`Cellule ${idx} : largeur ${got} ≠ attendu ${expW} — abandon (template inattendu)`);
  }
}
for (const idx of Object.keys(SIG_CELLS)) {
  if (widthOf(cells[idx].text) !== "2398") {
    throw new Error(`Cellule signature ${idx} : largeur ${widthOf(cells[idx].text)} ≠ 2398 — abandon`);
  }
}
console.log("Garde-fou largeurs : OK");

// Applique les remplacements du dernier index au premier (préserve les offsets).
const edits = [];
for (const [idx, tag] of Object.entries(TEXT_CELLS)) {
  edits.push({ idx: +idx, content: textCell(cells[idx].text, tag) });
}
for (const [idx, [aKey, dKey]] of Object.entries(SIG_CELLS)) {
  edits.push({ idx: +idx, content: sigCell(cells[idx].text, aKey, dKey) });
}
edits.sort((a, b) => b.idx - a.idx);
for (const e of edits) {
  const c = cells[e.idx];
  xml = xml.slice(0, c.index) + e.content + xml.slice(c.index + c.length);
}
console.log("Cellules patchées :", edits.length);

zip.file("word/document.xml", xml);
const out = zip.generate({ type: "nodebuffer" });
fs.writeFileSync(outPath, out);
console.log("Écrit :", outPath, out.length, "octets");
