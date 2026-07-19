/**
 * Formatage date/heure du Livret CIL — client-safe (pas d'I/O).
 * Toutes les valeurs métier sont des DateTime ISO ; on dérive ici l'affichage
 * FR et les valeurs d'input `datetime-local` / `time`.
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const fmtTimeFr = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "HH'h'mm", { locale: fr }) : "";
export const fmtDateFr = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "dd/MM/yyyy", { locale: fr }) : "";
/** Date courte « 18/07/26 » — colonnes étroites de l'imprimé (carnet). */
export const fmtDateCourteFr = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "dd/MM/yy", { locale: fr }) : "";
export const fmtDateTimeFr = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "dd/MM/yyyy 'à' HH'h'mm", { locale: fr }) : "";
export const fmtDayLongFr = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "EEEE d MMMM yyyy", { locale: fr }) : "";

/** ISO → valeur d'un `<input type="datetime-local">` (heure locale). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valeur `datetime-local` (heure locale) → ISO UTC. */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Maintenant, au format `datetime-local`. */
export function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}

/** ISO → valeur d'un `<input type="time">` (heure locale HH:MM). */
export function isoToTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Valeur `<input type="time">` (HH:MM) → ISO, en s'appuyant sur la date de
 * référence `baseIso` (jour de l'incident) pour composer un DateTime complet.
 */
export function timeInputToIso(time: string, baseIso: string): string | null {
  if (!time) return null;
  const base = new Date(baseIso);
  const m = time.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  base.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return base.toISOString();
}
