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
 * Lazy-loaded à l'usage — les dépendances (~150 KB) ne tombent dans le bundle
 * qu'au premier rendu effectif, pas au chargement du wizard.
 */

import {
  CHECK_BOOL_KEYS,
  CHECK_TERNARY_KEYS,
  type RciPayload,
  type RciPhotos,
} from "./fields";

const CHECKED = "☒"; // ☒
const UNCHECKED = "☐"; // ☐

const BOOL_SET = new Set<string>(CHECK_BOOL_KEYS as readonly string[]);
const TERNARY_SET = new Set<string>(CHECK_TERNARY_KEYS as readonly string[]);

/**
 * Construit le dictionnaire passé à docxtemplater.render().
 *
 * Conventions :
 *  - clé payload `xxx: string`           → tag `txt_xxx`
 *  - clé payload `xxx: boolean`          → tag `check_xxx`            (☒/☐)
 *  - clé payload `xxx: boolean | null`   → tags `check_xxx_oui` + `check_xxx_non`
 *  - clé photos  `yyy: string` (base64)  → tag `photo_yyy`
 */
export function buildTemplateData(
  payload: RciPayload,
  photos: RciPhotos,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (TERNARY_SET.has(key)) {
      out[`check_${key}_oui`] = value === true ? CHECKED : UNCHECKED;
      out[`check_${key}_non`] = value === false ? CHECKED : UNCHECKED;
    } else if (BOOL_SET.has(key)) {
      out[`check_${key}`] = value === true ? CHECKED : UNCHECKED;
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
    /** Override du chemin du template (défaut : /rci/template.docx). */
    templateUrl?: string;
    /** Dimensions de chaque photo inline en pixels (défaut : 400×300). */
    photoSize?: [number, number];
  } = {},
): Promise<Blob> {
  const [DocxtemplaterNs, PizZipNs, ImageModuleNs] = await Promise.all([
    import("docxtemplater"),
    import("pizzip"),
    import("docxtemplater-image-module-free"),
  ]);
  // Déballage robuste — couvre les variantes d'interop CJS/ESM produites par
  // Next.js en prod minifié (sinon `n is not a function` au `new`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Docxtemplater: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PizZip: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ImageModule: any;
  try {
    Docxtemplater = unwrapCjsCtor(DocxtemplaterNs);
  } catch (e) {
    throw new Error(
      "module 'docxtemplater' indisponible : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }
  try {
    PizZip = unwrapCjsCtor(PizZipNs);
  } catch (e) {
    throw new Error(
      "module 'pizzip' indisponible : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }
  try {
    ImageModule = unwrapCjsCtor(ImageModuleNs);
  } catch (e) {
    throw new Error(
      "module 'docxtemplater-image-module-free' indisponible : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  const url = opts.templateUrl ?? "/rci/template.docx";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Template introuvable (${res.status}) : ${url}`);
  }
  let zip: unknown;
  try {
    zip = new PizZip(await res.arrayBuffer());
  } catch (e) {
    throw new Error(
      "PizZip(buffer) a échoué : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  const imageOpts = {
    centered: false,
    getImage: (tagValue: unknown) => b64ToBytes(String(tagValue)),
    getSize: () => (opts.photoSize ?? [400, 300]) as [number, number],
  };
  let imageModule: unknown;
  try {
    imageModule = new ImageModule(imageOpts);
  } catch (e) {
    throw new Error(
      "new ImageModule(opts) a échoué : " +
        (e instanceof Error ? e.message : String(e)),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
      // Tag manquant ou null → vide plutôt que d'échouer (utile pendant le
      // wizard où le payload est incomplet).
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
