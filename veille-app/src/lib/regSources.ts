/**
 * Mapping préfixe document → libellé court du référentiel source.
 * Source de vérité unique partagée entre :
 *   - le popover "i" (HelpBadge) sur la liste d'items en session ;
 *   - le rapport PDF de session (pied de page "Sources réglementaires").
 *
 * Pour ajouter un nouveau document : ajouter une entrée ici, le mapping
 * est utilisé partout. Doit rester aligné avec les `helpReference` saisis
 * dans les scripts de patch (préfixe = identifiant du document avant le
 * " §" ou " Fiche").
 */
export const SOURCE_BY_PREFIX: Record<string, string> = {
  DC03969:
    "Modes opératoires des agents-circulation — Tome 1 (13-09-2022)",
  DC07202: "Communications de sécurité — DC07202 v2 (07-10-2025)",
  DC01506:
    "Gare temporaire DV BA — Reprise/cessation — DC01506 v2 (30-07-2025)",
  DC01503: "Incidents de circulation — DC01503 v5 (07-10-2025)",
  DC01505:
    "DV et voies banalisées — Circulation, secours, VUT, contre-voie — DC01505 v11 (29-09-2025)",
  DC08043:
    "Traction électrique — Consignation C / Protection C — DC08043 v4 (07-10-2021)",
  DC01792:
    "Acheminement transports particuliers (TE, MD radioactives, météo extrêmes) — DC01792 v2 (29-09-2025)",
  DC01556:
    "Shuntage — Circulations catégorie A, B, C — DC01556 v4 (13-03-2025)",
  DC01560: "Poste tout Relais à Transit Souple (PRS) — DC01560 v12 (07-01-2026)",
  DC03858:
    "Poste d'aiguillage à leviers individuels — DC03858 v2 (26-03-2014)",
  DC01510:
    "Service de la circulation (Organisation et méthode) — DC01510 v3 (07-04-2023)",
};

/** Extrait le préfixe (ex. "DC01503") d'une référence. Null si non reconnu. */
export function prefixOf(reference: string | null | undefined): string | null {
  if (!reference) return null;
  const m = reference.match(/^([A-Z]{2,}\d+)/);
  return m?.[1] ?? null;
}

/** Libellé du référentiel source. Fallback : "Référentiel SNCF Réseau". */
export function sourceForReference(
  reference: string | null | undefined
): string {
  const key = prefixOf(reference);
  return (key && SOURCE_BY_PREFIX[key]) || "Référentiel SNCF Réseau";
}

/**
 * Extrait les N premières phrases d'un texte (séparées par . ! ? suivi
 * d'espace ou fin). Utilisé dans la synthèse NC pour donner un extrait
 * de l'explication sans tronquer en milieu de phrase.
 */
export function firstSentences(text: string, n = 3): string {
  if (!text) return "";
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!parts) return text.trim();
  return parts.slice(0, n).join("").trim();
}
