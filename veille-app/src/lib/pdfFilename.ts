import { format } from "date-fns";

/**
 * Slugifie une chaîne pour usage dans un nom de fichier :
 *  - retire les accents (NFD + suppression des diacritiques) ;
 *  - remplace tout ce qui n'est pas alphanumérique par un tiret ;
 *  - replie les tirets et trim.
 */
function slug(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Construit un nom de fichier PDF normalisé :
 *   `{type}_{sujet}_{YYYY-MM-DD_HHmm}.pdf`
 *
 * Exemple :
 *   pdfFilename({ type: "Visite Planifiée", subject: "Poste de Givors Canal",
 *                 date: visit.visitDate })
 *   → "Visite-Planifiee_Poste-de-Givors-Canal_2026-06-11_1430.pdf"
 */
export function pdfFilename(parts: {
  /** Type du document (ex. "Visite Planifiée", "Session veille"). */
  type: string;
  /** Sujet : site, agent… (optionnel). */
  subject?: string | null;
  /** Date+heure de référence (de la visite/session, pas de la génération). */
  date: Date | string;
  /** Suffixe optionnel ajouté avant l'extension (ex. layout PDF). */
  suffix?: string | null;
}): string {
  const d = parts.date instanceof Date ? parts.date : new Date(parts.date);
  const stamp = format(d, "yyyy-MM-dd_HHmm");
  const bits = [slug(parts.type), slug(parts.subject), stamp];
  const tail = parts.suffix ? `_${slug(parts.suffix)}` : "";
  return `${bits.filter(Boolean).join("_")}${tail}.pdf`;
}
