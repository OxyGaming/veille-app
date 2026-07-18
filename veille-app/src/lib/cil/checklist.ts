/**
 * Checklists métier du Livret CIL — AIDE VISUELLE CALCULÉE (point 7 du plan).
 *
 * Ce ne sont PAS des données supplémentaires : chaque item est dérivé des
 * entités enregistrées (dépêches, intervenants, signatures). Objectif : guider
 * le CIL (« la dépêche a-t-elle été collationnée ? le numéro reçu ? »).
 *
 * Module pur, testable sans base.
 */
import type {
  CilDepecheDTO,
  CilIntervenantDTO,
  CilSignatureDTO,
} from "./types";
import { DEPECHE_SUBTYPE_LABELS, INTERVENANT_TYPE_LABELS } from "./types";

export type ChecklistItem = { label: string; done: boolean };

export type DepecheChecklist = {
  depecheId: string;
  title: string;
  items: ChecklistItem[];
  /** Tous les items requis sont faits. */
  complete: boolean;
};

export type IntervenantChecklist = {
  intervenantId: string;
  title: string;
  items: ChecklistItem[];
  complete: boolean;
};

export type CilChecklists = {
  depeches: DepecheChecklist[];
  intervenants: IntervenantChecklist[];
};

/** Les sous-types qui comportent un cadre « Signature » sur l'imprimé officiel. */
const SIGNED_SUBTYPES = new Set([
  "REPRISE_PARTIELLE",
  "REPRISE_NORMALE",
  "RETABLISSEMENT_PARTIEL",
  "RETABLISSEMENT_NORMAL",
]);

function hasSignatureFor(
  ownerType: string,
  ownerId: string,
  signatures: CilSignatureDTO[],
): boolean {
  return signatures.some(
    (s) => s.ownerType === ownerType && s.ownerId === ownerId,
  );
}

/**
 * Calcule les checklists de toutes les dépêches (hors libres) et de tous les
 * intervenants d'un incident.
 */
export function computeChecklists(
  depeches: CilDepecheDTO[],
  intervenants: CilIntervenantDTO[],
  signatures: CilSignatureDTO[],
): CilChecklists {
  const depecheLists: DepecheChecklist[] = depeches
    .filter((d) => d.subtype !== "LIBRE")
    .map((d) => {
      const items: ChecklistItem[] = [
        { label: "Dépêche passée", done: d.texte.trim().length > 0 },
        { label: "Numéro attribué", done: d.numeroDonne > 0 },
        { label: "Numéro reçu", done: !!d.numeroRecu && d.numeroRecu.trim() !== "" },
      ];
      if (SIGNED_SUBTYPES.has(d.subtype)) {
        items.push({
          label: "Signature",
          done: hasSignatureFor("DEPECHE", d.id, signatures),
        });
      }
      return {
        depecheId: d.id,
        title: `${DEPECHE_SUBTYPE_LABELS[d.subtype]} · n° ${d.numeroDonne}`,
        items,
        complete: items.every((i) => i.done),
      };
    });

  const intervenantLists: IntervenantChecklist[] = intervenants.map((i) => {
    const departRequired = i.type === "POMPES_FUNEBRES";
    const items: ChecklistItem[] = [
      { label: "Arrivée enregistrée", done: !!i.arrivedAt },
      {
        label: departRequired ? "Départ enregistré (obligatoire)" : "Départ enregistré",
        done: !!i.departedAt,
      },
    ];
    // L'arrivée est facultative ; seul le départ des Pompes Funèbres est requis.
    const complete = departRequired
      ? !!i.departedAt
      : !!i.arrivedAt || !!i.departedAt;
    const name =
      i.nom?.trim() ||
      (i.type === "AUTRE" && i.typeLibre ? i.typeLibre : INTERVENANT_TYPE_LABELS[i.type]);
    return {
      intervenantId: i.id,
      title: `${INTERVENANT_TYPE_LABELS[i.type]} — ${name}`,
      items,
      complete,
    };
  });

  return { depeches: depecheLists, intervenants: intervenantLists };
}
