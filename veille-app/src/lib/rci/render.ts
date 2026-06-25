/**
 * Pipeline de rendu d'un RCI vers un fichier .docx.
 *
 * Toute la génération se fait côté client :
 *  - fetch du template balisé (public/rci/template.docx)
 *  - mapping payload → dictionnaire docxtemplater (placeholders normalisés
 *    selon les conventions de [[fields]] : txt_*, check_*, photo_*)
 *  - cases à cocher : booléens → caractères Unicode ☒ / ☐
 *  - photos inline via docxtemplater-image-module-free (tagValue base64)
 *
 * Docxtemplater et PizZip sont chargés via require() à l'intérieur de
 * renderRci : on obtient directement module.exports sans l'encapsulation
 * namespace ESM que webpack crée pour les CJS, évitant ainsi l'erreur
 * "Cannot call a class as a function" (_classCallCheck instanceof).
 * ImageModule reste en import() dynamique avec dégradation gracieuse.
 */

import {
  ABSENT_KEYS,
  CHECK_BOOL_KEYS,
  CHECK_TERNARY_KEYS,
  PHOTO_KEYS,
  type RciPayload,
  type RciPhotos,
} from "./fields";

const CHECKED = "☒"; // ☒
const UNCHECKED = "☐"; // ☐

// PNG 1×1 blanc — utilisé comme image de substitution quand une signature est absente,
// pour éviter que l'ImageModule plante sur un tag {%photo_*} sans valeur.
const BLANK_PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=";

const BOOL_SET = new Set<string>(CHECK_BOOL_KEYS as readonly string[]);
const TERNARY_SET = new Set<string>(CHECK_TERNARY_KEYS as readonly string[]);
const PHOTO_SET = new Set<string>(PHOTO_KEYS as readonly string[]);
const ABSENT_SET = new Set<string>(ABSENT_KEYS as readonly string[]);

/**
 * Construit le dictionnaire passé à docxtemplater.render().
 *
 * Conventions :
 *  - clé payload `xxx: string`           → tag `txt_xxx`
 *  - clé payload `xxx: boolean`          → tag `check_xxx`            (☒/☐)
 *  - clé payload `xxx: boolean | null`   → tags `check_xxx_oui` + `check_xxx_non`
 *  - clé payload `xxx_absent: boolean`   → booléen brut `xxx_absent` (section)
 *  - clé photos  `yyy: string` (base64)  → tag `photo_yyy`
 */
export function buildTemplateData(
  payload: RciPayload,
  photos: RciPhotos,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (TERNARY_SET.has(key)) {
      out[`check_${key}_oui`] = value === true ? CHECKED : UNCHECKED;
      out[`check_${key}_non`] = value === false ? CHECKED : UNCHECKED;
    } else if (BOOL_SET.has(key)) {
      out[`check_${key}`] = value === true ? CHECKED : UNCHECKED;
    } else if (ABSENT_SET.has(key)) {
      // « Non présent sur place » : booléen brut (sans préfixe) pilotant la
      // section conditionnelle de la cellule signature dans le template.
      out[key] = value === true;
    } else if (PHOTO_SET.has(key)) {
      // Signatures : base64 brut → photo_{key} pour l'ImageModule.
      // Fallback PNG 1×1 blanc si absent — évite que le module image plante
      // sur un tag {%photo_*} sans valeur dans le template.
      out[`photo_${key}`] =
        typeof value === "string" && value.length > 0 ? value : BLANK_PNG_1X1;
    } else {
      // String (ou nullable). Null → "".
      out[`txt_${key}`] = value == null ? "" : String(value);
    }
  }
  for (const [key, b64] of Object.entries(photos)) {
    if (typeof b64 === "string" && b64.length > 0) {
      out[`photo_${key}`] = b64;
    }
  }
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * Déballe un module CommonJS importé dynamiquement.
 *
 * Selon le bundler (Webpack / Turbopack / esbuild) et le mode (dev / prod
 * minifié), `import("commonjs-module")` peut retourner :
 *  - la classe / fonction directement,
 *  - `{ default: Cls }` (interop standard),
 *  - `{ default: { default: Cls } }` (double-wrap qui apparaît sur certains
 *    modules CJS legacy comme `docxtemplater-image-module-free` v1.x).
 *
 * Cette fonction descend la chaîne `.default` jusqu'à trouver une fonction,
 * avec un garde-fou contre les boucles infinies. Sans ce déballage, le bundle
 * prod minifié plante en `n is not a function` lors du `new`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrapCjsCtor<T = any>(mod: unknown): T {
  let cur: unknown = mod;
  for (let depth = 0; depth < 3; depth++) {
    if (typeof cur === "function") return cur as T;
    if (cur && typeof cur === "object" && "default" in (cur as object)) {
      cur = (cur as { default?: unknown }).default;
      continue;
    }
    break;
  }
  if (typeof cur !== "function") {
    throw new Error(
      "Module dynamiquement importé n'expose pas de constructeur exploitable.",
    );
  }
  return cur as T;
}

/**
 * Génère le .docx final. Charge le template, applique les substitutions,
 * renvoie un Blob prêt à `saveAs(...)` ou à uploader.
 */
export async function renderRci(
  payload: RciPayload,
  photos: RciPhotos,
  opts: {
    /** Buffer pré-chargé du template — Buffer Node.js ou ArrayBuffer (prioritaire sur templateUrl). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    templateBuffer?: any;
    /** Override du chemin du template (défaut : /rci/template.docx). */
    templateUrl?: string;
    /** Dimensions de chaque photo inline en pixels (défaut : 400×300). */
    photoSize?: [number, number];
  } = {},
): Promise<Blob> {
  // require() retourne directement module.exports (la classe réelle) sans
  // l'encapsulation namespace ESM/Turbopack — évite _classCallCheck instanceof.
  // Cette fonction tourne désormais côté serveur (API route), où ces 3 packages
  // sont déclarés dans serverExternalPackages : require() les charge nativement.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const PizZip: any = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Docxtemplater: any = require("docxtemplater");

  // ImageModule : require() natif aussi, avec dégradation gracieuse.
  // Si le module échoue, on génère le docx sans images plutôt que de tout bloquer.
  const modules: unknown[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const ImageModuleCtor: any = require("docxtemplater-image-module-free");
    const imageModule = new ImageModuleCtor({
      centered: false,
      getImage: (tagValue: unknown) => b64ToBytes(String(tagValue)),
      // getSize(img, tagValue, tagName) : les signatures sont petites (cellule
      // étroite ~1,5"), le schéma succinct prend la taille par défaut plus grande.
      getSize: (_img: unknown, _val: unknown, tagName: unknown) => {
        if (typeof tagName === "string" && tagName.startsWith("photo_sig_")) {
          return [150, 50] as [number, number];
        }
        return (opts.photoSize ?? [400, 300]) as [number, number];
      },
    });
    modules.push(imageModule);
  } catch (e) {
    console.error("[renderRci] ImageModule indisponible :", e);
  }

  let arrayBuf: ArrayBuffer;
  if (opts.templateBuffer) {
    arrayBuf = opts.templateBuffer;
  } else {
    const url = opts.templateUrl ?? "/rci/template.docx";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Template introuvable (${res.status}) : ${url}`);
    }
    arrayBuf = await res.arrayBuffer();
  }
  let zip: unknown;
  try {
    zip = new PizZip(arrayBuf);
  } catch (e) {
    throw new Error(
      "PizZip(buffer) a échoué : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = new Docxtemplater(zip, {
      ...(modules.length > 0 ? { modules } : {}),
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
  } catch (e) {
    throw new Error(
      "new Docxtemplater(zip, opts) a échoué : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  const data = buildTemplateData(payload, photos);
  try {
    doc.render(data);
  } catch (e) {
    throw new Error(
      "doc.render(data) a échoué : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
