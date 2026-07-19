/**
 * Mapping PUR incident → dictionnaire de tags docxtemplater du livret CIL.
 *
 * Conventions (comme le RCI, cf. src/lib/rci/render.ts) : `txt_*` texte,
 * `check_*` ☒/☐, `num_NN` numéro (barré si utilisé), `photo_sig_*` base64.
 * Testable sans docx. Le document reste une pure représentation des données.
 */
import { fmtDateCourteFr, fmtDateFr, fmtTimeFr } from "../format";
import type {
  CilDepecheDTO,
  CilIncidentFull,
  IntervenantType,
} from "../types";
import { INCIDENT_TYPE_LABELS } from "../types";

const CHECKED = "☒";
const UNCHECKED = "☐";

/** Numéro « barré » (combining long stroke overlay) → geste de cochage papier. */
function strike(n: number): string {
  return String(n)
    .split("")
    .map((c) => c + "̶")
    .join("");
}

/** « le JJ/MM/AAAA à HHhMM » depuis un ISO, ou "" si absent. */
function dh(iso: string | null): string {
  if (!iso) return "";
  return `le ${fmtDateFr(iso)} à ${fmtTimeFr(iso)}`;
}

const ARR_KEY: Partial<Record<IntervenantType, string>> = {
  COS: "cos",
  OPJ: "opj",
  POMPES_FUNEBRES: "pf",
  EIC: "eic",
  INFP: "infp",
  EXF_TRACTION: "exft",
  EXF_VOYAGEURS: "exfv",
};

function findDepeche(
  depeches: CilDepecheDTO[],
  subtype: string,
  interlocutor?: string,
): CilDepecheDTO | undefined {
  return depeches.find(
    (d) =>
      d.subtype === subtype &&
      (interlocutor === undefined || d.interlocutor === interlocutor),
  );
}

export type CilDocxData = Record<string, string>;

/**
 * Construit le dictionnaire de tags. Les signatures absentes ne sont PAS
 * ajoutées ici (le rendu fournit un PNG de substitution) pour éviter les
 * clés vides.
 */
export function buildCilDocxData(full: CilIncidentFull): CilDocxData {
  const { incident, depeches, intervenants, signatures } = full;
  const out: CilDocxData = {};

  // ── En-tête ───────────────────────────────────────────────────────────────
  const nature =
    incident.type === "AUTRE" && incident.typeLibre
      ? incident.typeLibre
      : INCIDENT_TYPE_LABELS[incident.type];
  out.txt_dateHeure = incident.occurredAt
    ? `${fmtDateFr(incident.occurredAt)} à ${fmtTimeFr(incident.occurredAt)}`
    : "";
  out.txt_incident = nature;
  out.txt_lieu = incident.lieu;
  out.txt_voie = incident.voie ?? "";
  out.txt_nomCil = [incident.cilNom, incident.cilPrenom]
    .filter(Boolean)
    .join(" ");
  out.txt_designeA = fmtTimeFr(incident.designatedAt);
  out.check_etab_ral = incident.cilEtablissement === "EIC_RAL" ? CHECKED : UNCHECKED;
  out.check_etab_rhn = incident.cilEtablissement === "INFP_RHN" ? CHECKED : UNCHECKED;
  out.check_etab_lgv = incident.cilEtablissement === "INFP_LGV" ? CHECKED : UNCHECKED;

  // ── Protections (2 dépêches : CRC + RSS/AC) ─────────────────────────────────
  const fill = (prefix: string, d: CilDepecheDTO | undefined) => {
    out[`${prefix}_donne`] = d ? String(d.numeroDonne) : "";
    out[`${prefix}_recu`] = d?.numeroRecu ?? "";
    out[`${prefix}_dh`] = dh(d?.occurredAt ?? null);
  };
  const elecCrc = findDepeche(depeches, "PROTECTION_ELECTRIQUE", "CRC");
  fill("txt_prot_elec_crc", elecCrc);
  fill("txt_prot_elec_rss", findDepeche(depeches, "PROTECTION_ELECTRIQUE", "RSS"));
  const circCrc = findDepeche(depeches, "PROTECTION_CIRCULATION", "CRC");
  fill("txt_prot_circ_crc", circCrc);
  fill("txt_prot_circ_ac", findDepeche(depeches, "PROTECTION_CIRCULATION", "AC"));
  // Avis COS / OPJ (portés par la dépêche CRC de chaque protection).
  out.txt_prot_elec_avis_cos = dh(elecCrc?.avisCosAt ?? null);
  out.txt_prot_elec_avis_opj = dh(elecCrc?.avisOpjAt ?? null);
  out.txt_prot_circ_avis_cos = dh(circCrc?.avisCosAt ?? null);
  out.txt_prot_circ_avis_opj = dh(circCrc?.avisOpjAt ?? null);

  // ── Reprises / rétablissements (1 dépêche chacune) ─────────────────────────
  const rpp = findDepeche(depeches, "REPRISE_PARTIELLE");
  const rpn = findDepeche(depeches, "REPRISE_NORMALE");
  const rtp = findDepeche(depeches, "RETABLISSEMENT_PARTIEL");
  const rtn = findDepeche(depeches, "RETABLISSEMENT_NORMAL");
  fill("txt_repp", rpp);
  fill("txt_repn", rpn);
  fill("txt_retp", rtp);
  fill("txt_retn", rtn);

  // ── Phrases de dépêche (blancs inline) — le nom du CIL et les valeurs
  //    doivent remonter dans le texte pré-imprimé. ─────────────────────────────
  const g = (d: CilDepecheDTO | undefined) => d?.geometry ?? {};
  const putGeom = (
    prefix: string,
    d: CilDepecheDTO | undefined,
    opts: { marches?: boolean; ac?: boolean } = {},
  ) => {
    // On ne remplit la phrase que si la dépêche existe : un cadre non utilisé
    // reste vierge (comme sur l'imprimé papier).
    if (!d) {
      for (const suf of ["cil", "evenement", "voies", "km", "gareA", "gareB", "gareUnique", "motif", "vi", "vp", "vn", "ac"]) {
        out[`${prefix}_${suf}`] = "";
      }
      return;
    }
    const geo = g(d);
    out[`${prefix}_cil`] = out.txt_nomCil;
    out[`${prefix}_evenement`] = nature;
    out[`${prefix}_voies`] = geo.voies ?? "";
    out[`${prefix}_km`] = geo.km ?? "";
    out[`${prefix}_gareA`] = geo.gareA ?? "";
    out[`${prefix}_gareB`] = geo.gareB ?? "";
    out[`${prefix}_gareUnique`] = geo.gareUnique ?? "";
    out[`${prefix}_motif`] = geo.motif ?? "";
    if (opts.marches) {
      out[`${prefix}_vi`] = geo.marcheInterdite ?? "";
      out[`${prefix}_vp`] = geo.marchePrudente ?? "";
      out[`${prefix}_vn`] = geo.marcheNormale ?? "";
    }
    if (opts.ac) {
      // « M. … CIL à AC de … » : la dépêche fait foi, sinon on retombe sur l'AC
      // de l'incident (ou son poste) pour ne jamais laisser le blanc vide.
      out[`${prefix}_ac`] =
        geo.ac ?? incident.acLabel ?? incident.poste ?? geo.gareUnique ?? "";
    }
  };
  putGeom("txt_prot_elec", elecCrc);
  putGeom("txt_prot_circ", circCrc, { marches: true });
  putGeom("txt_repp", rpp, { ac: true });
  putGeom("txt_repn", rpn, { ac: true });
  putGeom("txt_retp", rtp);
  putGeom("txt_retn", rtn);

  // Destinataire de la 2ᵉ dépêche de protection circulation (« AC de … »).
  const acCirc = findDepeche(depeches, "PROTECTION_CIRCULATION", "AC");
  out.txt_ac_label =
    acCirc?.geometry.acLabel ??
    incident.acLabel ??
    incident.poste ??
    "";

  // ── Localisation : choisie UNE fois au niveau incident, imprimée partout ────
  out.check_gare_entre = incident.gareMode === "BETWEEN" ? CHECKED : UNCHECKED;
  out.check_gare_engare = incident.gareMode === "UNIQUE" ? CHECKED : UNCHECKED;
  out.txt_gareA = incident.gareMode === "BETWEEN" ? (incident.gareA ?? "") : "";
  out.txt_gareB = incident.gareMode === "BETWEEN" ? (incident.gareB ?? "") : "";
  out.txt_gareUnique =
    incident.gareMode === "UNIQUE" ? (incident.gareUnique ?? "") : "";

  // ── Autorisations COS/OPJ + avis au CRC (reprises / rétablissements) ────────
  const putAvis = (prefix: string, d: CilDepecheDTO | undefined) => {
    // « Autorisation reçue du COS : le ../../.. à ..h.. » → date ET heure.
    out[`${prefix}_autor_cos`] = dh(d?.avisCosAt ?? null);
    out[`${prefix}_autor_opj`] = dh(d?.avisOpjAt ?? null);
    // « Avis au CRC de Lyon (obligatoire) à ……… » → la phrase n'attend que
    // l'heure : y remettre la date la rendrait incorrecte.
    out[`${prefix}_avis_crc`] = fmtTimeFr(d?.avisCrcAt ?? null);
  };
  putAvis("txt_repp", rpp);
  putAvis("txt_repn", rpn);
  putAvis("txt_retp", rtp);
  putAvis("txt_retn", rtn);

  // ── Changement de CIL (événement + son metadata) ───────────────────────────
  const chg = full.events.find((e) => e.type === "CHANGEMENT_CIL");
  const chgMeta = (chg?.metadata ?? {}) as Record<string, unknown>;
  const metaStr = (k: string) =>
    typeof chgMeta[k] === "string" ? (chgMeta[k] as string) : "";
  out.txt_chg_cil = chg ? out.txt_nomCil : "";
  out.txt_chg_remplacant = metaStr("remplacant");
  out.txt_chg_heure = chg ? fmtTimeFr(chg.occurredAt) : "";
  // Colonnes de notification (heures d'avis du changement).
  for (const k of ["ac", "crc", "opj", "cos"] as const) {
    const v = chgMeta[`avis_${k}`];
    out[`txt_chg_${k}`] = typeof v === "string" && v ? fmtTimeFr(v) : "";
  }

  // ── Intervenants : arrivée, départ et n° de tél par type (1 colonne/type) ──
  for (const key of Object.values(ARR_KEY)) {
    out[`txt_arr_${key}`] = "";
    out[`txt_dep_${key}`] = "";
    out[`txt_tel_${key}`] = "";
  }
  for (const it of intervenants) {
    const key = ARR_KEY[it.type];
    if (!key) continue;
    if (it.arrivedAt && !out[`txt_arr_${key}`]) out[`txt_arr_${key}`] = fmtTimeFr(it.arrivedAt);
    if (it.departedAt && !out[`txt_dep_${key}`]) out[`txt_dep_${key}`] = fmtTimeFr(it.departedAt);
    if (it.tel && !out[`txt_tel_${key}`]) out[`txt_tel_${key}`] = it.tel;
  }

  // ── Carnet d'enregistrement des dépêches (dépêches libres) ─────────────────
  // Une ligne par destinataire (l'imprimé distingue « Reçu de » / « Expédié à »).
  const CARNET_LINES = 28;
  type CarnetRow = {
    num: string; date: string; de: string; texte: string;
    expedie: string; recu: string; heure: string;
  };
  const rows: CarnetRow[] = [];
  const libres = depeches
    .filter((d) => d.subtype === "LIBRE")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const d of libres) {
    const cibles = d.destinataires.length
      ? d.destinataires
      : [{ id: d.id, label: "", numeroRecu: d.numeroRecu }];
    for (const c of cibles) {
      const expedie = d.sens !== "RECU";
      rows.push({
        num: String(d.numeroDonne),
        // Colonne étroite : millésime à 2 chiffres, comme le pré-imprimé.
        date: fmtDateCourteFr(d.occurredAt),
        de: expedie ? "" : c.label,
        texte: d.texte,
        expedie: expedie ? c.label : "",
        recu: c.numeroRecu ?? "",
        heure: fmtTimeFr(d.occurredAt),
      });
    }
  }
  for (let i = 1; i <= CARNET_LINES; i++) {
    const r = rows[i - 1];
    for (const k of ["num", "date", "de", "texte", "expedie", "recu", "heure"] as const) {
      out[`txt_libre_${i}_${k}`] = r ? r[k] : "";
    }
  }

  // ── Numéros 10-69 : barrés si utilisés ─────────────────────────────────────
  const used = new Set(depeches.map((d) => d.numeroDonne));
  for (let n = 10; n <= 69; n++) {
    out[`num_${n}`] = used.has(n) ? strike(n) : String(n);
  }

  // ── Signatures des autorités présentes (COS / OPJ) sur chaque reprise ──────
  // Ce n'est PAS la signature du CIL : l'imprimé recueille celle de l'autorité
  // qui autorise. Les clés absentes reçoivent un PNG blanc au rendu.
  const sigFor = (d: CilDepecheDTO | undefined, role: "COS" | "OPJ") => {
    if (!d) return undefined;
    return signatures.find(
      (s) =>
        s.ownerType === "DEPECHE" && s.ownerId === d.id && s.signerRole === role,
    )?.imageB64;
  };
  for (const [prefix, d] of [
    ["repp", rpp], ["repn", rpn], ["retp", rtp], ["retn", rtn],
  ] as const) {
    for (const role of ["COS", "OPJ"] as const) {
      const img = sigFor(d, role);
      if (img) out[`photo_sig_${prefix}_${role.toLowerCase()}`] = img;
    }
  }

  return out;
}

/** Nom de fichier normalisé du livret. */
export function livretCilDocxFilename(full: CilIncidentFull): string {
  const ref =
    full.incident.reference ||
    full.incident.occurredAt.replace(/[^0-9]/g, "").slice(0, 12);
  return `Livret-CIL-${ref}.docx`;
}
