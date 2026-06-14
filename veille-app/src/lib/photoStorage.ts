/**
 * Stockage des photos — résolution de chemin disque + URL d'accès auth.
 *
 * Stratégie cohabitation V1 (Sprint 3 C9) :
 *  - **Nouvelles photos** → écrites dans `data/uploads/photos/` (hors `public/`).
 *    `storagePath` = `"private:photos/<name>"` (préfixe explicite).
 *  - **Anciennes photos (legacy)** → restent dans `public/uploads/photos/`.
 *    `storagePath` = `"/uploads/photos/<name>"` (préfixe d'URL).
 *
 * Toute lecture passe par la route auth `/api/photos/[id]/file` qui appelle
 * `resolvePhotoFilePath` pour servir l'un ou l'autre format. Un script
 * `scripts/migrate-uploads-to-private.ts` permet de migrer les anciennes au
 * moment opportun (rétro-compat préservée tant que la migration n'est pas
 * effectuée).
 */

import { join, normalize, sep } from "path";

/**
 * Dossier privé pour les nouvelles photos. Hors `public/`, jamais servi
 * directement par Next. Variable d'env `VEILLE_PRIVATE_UPLOAD_DIR` pour
 * pointer vers un volume monté en production.
 */
export const PRIVATE_UPLOAD_DIR =
  process.env.VEILLE_PRIVATE_UPLOAD_DIR ||
  join(process.cwd(), "data", "uploads");

/**
 * Dossier public legacy. Variable d'env `VEILLE_UPLOAD_DIR` conservée pour
 * rétro-compat. Conservé pour servir les anciennes photos tant que la
 * migration n'a pas été exécutée.
 */
export const PUBLIC_UPLOAD_DIR =
  process.env.VEILLE_UPLOAD_DIR ||
  join(process.cwd(), "public", "uploads");

/** Préfixe `storagePath` pour les nouvelles photos privées. */
export const PRIVATE_STORAGE_PREFIX = "private:";

/** Préfixe d'URL legacy. */
export const LEGACY_STORAGE_PREFIX = "/uploads/";

export type PhotoFileLocation = {
  absolutePath: string;
  origin: "private" | "legacy";
};

/**
 * Résout le chemin disque absolu d'une photo à partir de son `storagePath`.
 *
 * Refuse :
 *  - `..` (path traversal),
 *  - chemins absolus dans la partie relative,
 *  - tout format inconnu (renvoie null, jamais d'exception).
 *
 * Le chemin résolu est garanti d'être sous PRIVATE_UPLOAD_DIR ou
 * PUBLIC_UPLOAD_DIR (vérif `startsWith` après normalisation).
 */
export function resolvePhotoFilePath(
  storagePath: string | null | undefined,
): PhotoFileLocation | null {
  if (!storagePath || typeof storagePath !== "string") return null;
  if (storagePath.includes("..")) return null;

  if (storagePath.startsWith(PRIVATE_STORAGE_PREFIX)) {
    const rel = storagePath.slice(PRIVATE_STORAGE_PREFIX.length);
    if (!rel || rel.startsWith("/") || rel.startsWith("\\")) return null;
    const abs = normalize(join(PRIVATE_UPLOAD_DIR, rel));
    if (!isUnder(abs, PRIVATE_UPLOAD_DIR)) return null;
    return { absolutePath: abs, origin: "private" };
  }

  if (storagePath.startsWith(LEGACY_STORAGE_PREFIX)) {
    const rel = storagePath.slice(LEGACY_STORAGE_PREFIX.length);
    if (!rel) return null;
    const abs = normalize(join(PUBLIC_UPLOAD_DIR, rel));
    if (!isUnder(abs, PUBLIC_UPLOAD_DIR)) return null;
    return { absolutePath: abs, origin: "legacy" };
  }

  return null;
}

/** Construit la valeur `storagePath` à écrire en DB pour une nouvelle photo. */
export function buildPrivateStoragePath(relativeName: string): string {
  return `${PRIVATE_STORAGE_PREFIX}photos/${relativeName}`;
}

/** URL relative à utiliser dans les composants pour servir une photo. */
export function photoApiUrl(photoId: string): string {
  return `/api/photos/${photoId}/file`;
}

function isUnder(abs: string, parent: string): boolean {
  // Normalise les terminaisons : on accepte `parent` exact ou `parent + sep + ...`
  return abs === parent || abs.startsWith(parent + sep);
}
