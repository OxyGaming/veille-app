/**
 * Rendu du livret CIL en .docx — calqué sur `src/lib/rci/render.ts`.
 *
 * `pizzip` / `docxtemplater` / `docxtemplater-image-module-free` sont chargés
 * via require() (déclarés dans `serverExternalPackages`) ; ce module tourne
 * côté serveur (route API). Les signatures (`{%photo_sig_*}`) passent par
 * l'image module ; un PNG 1×1 blanc est fourni en substitution pour éviter
 * qu'un tag image sans valeur ne fasse planter le rendu.
 */
import type { CilDocxData } from "./data";

const BLANK_PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=";

/** Une signature par autorité présente (COS / OPJ) et par cadre de reprise. */
const SIG_KEYS = (["repp", "repn", "retp", "retn"] as const).flatMap((p) => [
  `photo_sig_${p}_cos`,
  `photo_sig_${p}_opj`,
]);

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** Génère le .docx du livret CIL. `templateBuffer` = template balisé pré-chargé. */
export async function renderLivretCil(
  data: CilDocxData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateBuffer: any,
): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const PizZip: any = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Docxtemplater: any = require("docxtemplater");

  const modules: unknown[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const ImageModuleCtor: any = require("docxtemplater-image-module-free");
    const imageModule = new ImageModuleCtor({
      centered: false,
      getImage: (tagValue: unknown) => b64ToBytes(String(tagValue)),
      // Chaque signature est posée dans la cellule de SA ligne « Autorisation
      // reçue du COS/OPJ » : environ 70 pt de large (~94 px) sur une ligne
      // basse. Au-delà, Word fait déborder l'image sur la cellule voisine.
      getSize: () => [86, 20] as [number, number],
    });
    modules.push(imageModule);
  } catch (e) {
    console.error("[renderLivretCil] ImageModule indisponible :", e);
  }

  // Substitution PNG blanc pour les signatures absentes.
  const filled: CilDocxData = { ...data };
  for (const k of SIG_KEYS) {
    if (!filled[k]) filled[k] = BLANK_PNG_1X1;
  }

  const zip = new PizZip(templateBuffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new Docxtemplater(zip, {
    ...(modules.length > 0 ? { modules } : {}),
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(filled);
  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
