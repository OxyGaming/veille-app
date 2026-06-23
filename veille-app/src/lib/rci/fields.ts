/**
 * RCI — référence unique des champs balisés dans le template officiel
 * EIC RAL v10. Source de vérité partagée entre :
 *   - le balisage (script PowerShell qui injecte les placeholders dans le .docx)
 *   - le wizard (formulaire de saisie)
 *   - le rendering (mapping payload → docxtemplater)
 *
 * Couvre la VAGUE 1 (cf. doc/rci/template-audit.txt) : tout sauf la grosse
 * table « Personnes / organismes appelés - présents sur place » (T5 R24-41).
 *
 * Conventions de nommage :
 *   - {txt_xxx}    → champ texte libre
 *   - {check_xxx}  → case à cocher, rendue ☒ / ☐ via parser custom
 *   - {%photo_xxx} → zone d'image inline (docxtemplater-image-module-free)
 *
 * Les booléens ternaires (oui / non / non renseigné) sont décomposés en deux
 * cases distinctes `_oui` et `_non` (cf. le template officiel qui les présente
 * comme deux cases adjacentes). null côté wizard ⇒ aucune des deux cochée.
 */

export type Ternary = boolean | null;

/** Payload sérialisable d'un RCI (vague 1). */
export type RciPayload = {
  // ── Header (T1) ────────────────────────────────────────────────────────
  dossier_numero: string;

  // ── Quand (T2 R3-5) ────────────────────────────────────────────────────
  jour_semaine: string; // « Lundi », « Mardi »…
  date_evenement: string; // « JJ/MM/AAAA »
  heure_evenement: string; // « HHhMM »

  // ── Quoi (nature de l'événement) (T2 R3) ───────────────────────────────
  nature: string; // texte libre court — synthèse en titre

  // ── Où (T2 R7-9) ───────────────────────────────────────────────────────
  gare_section: string;
  point_km: string;
  numero_voie: string;
  numero_ligne: string;
  numero_dpt: string;
  type_voie: string; // texte libre : « DV », « VU », « VS »…
  type_voie_vp: boolean;
  type_voie_vs: boolean;
  vp_engagee: Ternary;

  // ── Installations signalisation (T2 R10-18) ────────────────────────────
  appareil_voie: string;
  signal_repere: string;
  inst_kvb: boolean;
  inst_kvb_en_service: Ternary;
  inst_tvm: boolean;
  inst_tvm_300: boolean;
  inst_tvm_430: boolean;
  inst_tvm_en_service: Ternary;
  inst_etcs: boolean;
  inst_etcs_1: boolean;
  inst_etcs_2: boolean;
  inst_etcs_en_service: Ternary;
  inst_daat: boolean;
  inst_daat_en_service: Ternary;
  inst_crocodile: boolean;
  inst_crocodile_en_service: Ternary;
  inst_detonateur: Ternary;
  inst_cartouche_percutee: Ternary;

  // ── PN (T2 R17, conditionnel nature=PN) ────────────────────────────────
  pn_numero: string;
  pn_sal2: boolean;
  pn_sal4: boolean;
  pn_autres: boolean;
  pn_feux_routiers: Ternary;
  autres_installations: string;

  // ── Mobiles : train principal (T3) — vague 1 = 1 train ─────────────────
  train_numero: string;
  train_ef: string;
  train_locomotive_numero: string;
  train_us: boolean;
  train_um: boolean;
  train_rame_numero: string;
  train_engin_travaux_numero: string;
  train_conduite_em_en_tete: Ternary;
  train_sous_traitant: boolean;
  train_mouvement_manoeuvre_non_guide: string;
  train_evolution_numero: string;
  train_type_ttx: boolean;
  train_type_tus: boolean;
  train_type_tsv: boolean;
  train_type_numero: string;
  train_double_traction: boolean;
  train_pousse: boolean;
  train_mouvement_manoeuvre_guide_numero: string;

  // ── Équipements en service en cabine de conduite (T3 R4) ───────────────
  cab_kvb_covit: Ternary;
  cab_daat: Ternary;
  cab_rst: Ternary;
  cab_gsm_gfu: Ternary;
  cab_rs: Ternary;
  cab_etcs_1: boolean;
  cab_etcs_2: boolean;
  cab_etcs: Ternary;
  cab_tvm_300: boolean;
  cab_tvm_430: boolean;
  cab_tvm: Ternary;

  // ── Composition (T3 R8) ────────────────────────────────────────────────
  compo_code: string;
  compo_nb_vehicules: string;
  compo_longueur: string;
  compo_masse: string;
  compo_masse_freinee_realisee: string;
  compo_masse_freinee_necessaire: string;

  // ── Parcours (T3 R9) ───────────────────────────────────────────────────
  parcours_de: string;
  parcours_a: string;
  vitesse_evenement: string;

  // ── Véhicules accidentés (T3 R10-15, conditionnel déraillement) ────────
  veh_nombre: string;
  veh_numero: string;
  veh_masse_rail: string;
  veh_masse_freinee_realisee: string;
  veh_position_freinage: string;
  veh_marchandise: boolean;
  veh_voyageur: boolean;
  veh_vide: boolean;
  veh_charge: boolean;
  veh_code_danger_onu: string;
  veh_tampons_circulaire: boolean;
  veh_tampons_rectangulaire: boolean;
  veh_tampons_autres: boolean;
  veh_serres_refus: Ternary;
  veh_besoin_relevage: Ternary;

  // ── Qui — SNCF Réseau (T3 R17 + T4) ────────────────────────────────────
  qui_sgc: boolean;
  qui_maintenance_travaux_mainteneur: boolean;
  qui_maintenance_travaux_convois_gi: boolean;
  qui_nb_personnes_cabine: string;
  qui_conducteur_seul_reseau: boolean;
  qui_conducteur_seul_prestataire: boolean;
  qui_conducteur_seul_conduite: boolean;
  qui_conducteur_seul_nom: string;
  qui_pilote_reseau: boolean;
  qui_pilote_prestataire: boolean;
  qui_pilote_conduite: boolean;
  qui_pilote_nom: string;
  qui_pam_reseau: boolean;
  qui_pam_prestataire: boolean;
  qui_pam_conduite: boolean;
  qui_pam_nom: string;
  qui_ops_sol_reseau: boolean;
  qui_ops_sol_prestataire: boolean;
  qui_ops_sol_conduite: boolean;
  qui_ops_sol_nom: string;

  // ── Qui — Autres GI / EF (T3 R18-19) ───────────────────────────────────
  autres_gi_nom: string;
  autres_gi_delegataire: boolean;
  autres_gi_titulaire: boolean;
  ef1_nom: string;
  ef1_pour_elle_meme: boolean;
  ef1_sous_traitant: boolean;
  ef1_utilisatrice_nom: string;
  ef2_nom: string;
  ef2_pour_elle_meme: boolean;
  ef2_sous_traitant: boolean;
  ef2_utilisatrice_nom: string;

  // ── Alcoolémie (T5 R1-3) ───────────────────────────────────────────────
  alcool_personne: string;
  alcool_pratique: Ternary;
  alcool_positif: Ternary;

  // ── Accident personne (T5 R4-6, conditionnel) ──────────────────────────
  ap_blesse: Ternary;
  ap_deces: Ternary;
  ap_suicide_presume: Ternary;
  ap_source: string;

  // ── Mesures conservatoires (T5 R7-16) ──────────────────────────────────
  mc_l1_heure: string;
  mc_l1_par_qui: string;
  mc_l1_mesures: string;
  mc_l2_heure: string;
  mc_l2_par_qui: string;
  mc_l2_mesures: string;
  mc_l3_heure: string;
  mc_l3_par_qui: string;
  mc_l3_mesures: string;
  mc_notification_heure: string;
  mc_notification_dpx: boolean;
  mc_notification_cogc: boolean;
  consequences_visibles: string;

  // ── Comment (T5 R17-18) — récit chronologique multi-ligne ──────────────
  recit_chronologique: string;

  // ── Acteurs principaux (T5 R19-23) — 3 lignes max ──────────────────────
  acteur_l1_entreprise: string;
  acteur_l1_nom: string;
  acteur_l1_fonction: string;
  acteur_l2_entreprise: string;
  acteur_l2_nom: string;
  acteur_l2_fonction: string;
  acteur_l3_entreprise: string;
  acteur_l3_nom: string;
  acteur_l3_fonction: string;

  // ── Personnes et organismes appelés — présents sur place (T4 R25-R41) ──
  // 13 rôles × { heure d'avis, présent (ternaire), heure d'arrivée }
  // Représentants SNCF Réseau
  po_dpx_heure_avis: string;
  po_dpx_present: Ternary;
  po_dpx_heure_arrivee: string;
  po_utm_heure_avis: string;
  po_utm_present: Ternary;
  po_utm_heure_arrivee: string;
  po_reg_heure_avis: string;
  po_reg_present: Ternary;
  po_reg_heure_arrivee: string;
  // Intervenants externes
  po_police_heure_avis: string;
  po_police_present: Ternary;
  po_police_heure_arrivee: string;
  po_pompiers_heure_avis: string;
  po_pompiers_present: Ternary;
  po_pompiers_heure_arrivee: string;
  po_funebres_heure_avis: string;
  po_funebres_present: Ternary;
  po_funebres_heure_arrivee: string;
  po_autres_label: string;
  po_autres_heure_avis: string;
  po_autres_present: Ternary;
  po_autres_heure_arrivee: string;
  // Représentants des exploitants
  po_ef1_heure_avis: string;
  po_ef1_present: Ternary;
  po_ef1_heure_arrivee: string;
  po_ef2_heure_avis: string;
  po_ef2_present: Ternary;
  po_ef2_heure_arrivee: string;
  po_convois_heure_avis: string;
  po_convois_present: Ternary;
  po_convois_heure_arrivee: string;
  po_suge_heure_avis: string;
  po_suge_present: Ternary;
  po_suge_heure_arrivee: string;
  // Représentants des autres GI
  po_titulaire_heure_avis: string;
  po_titulaire_present: Ternary;
  po_titulaire_heure_arrivee: string;
  po_delegataire_heure_avis: string;
  po_delegataire_present: Ternary;
  po_delegataire_heure_arrivee: string;

  // ── Schéma + cases bas de page (T6 R3-5) ───────────────────────────────
  franchissement_point_protege_engage: Ternary;
  photos_jointes: Ternary;
  photos_titres_habilitation: Ternary;

  // ── Footer (T6 R6 + T7) ────────────────────────────────────────────────
  rci_etabli_le: string;
  rci_etabli_par: string;
  sig_eic_nom_fonction: string;
  sig_eic_tel: string;
  sig_autres_gi_nom_fonction: string;
  sig_autres_gi_tel: string;
  sig_ef1_nom_fonction: string;
  sig_ef1_tel: string;
  sig_ef2_nom_fonction: string;
  sig_ef2_tel: string;
};

/** Photos inline supportées — tagValue = base64. */
export type RciPhotos = {
  /** Schéma succinct (croquis main ou photo importée). */
  schema_succinct?: string;
};

/** Payload entièrement vide, utilisé pour initialiser un brouillon. */
export function emptyPayload(): RciPayload {
  return {
    dossier_numero: "",
    jour_semaine: "",
    date_evenement: "",
    heure_evenement: "",
    nature: "",
    gare_section: "",
    point_km: "",
    numero_voie: "",
    numero_ligne: "",
    numero_dpt: "",
    type_voie: "",
    type_voie_vp: false,
    type_voie_vs: false,
    vp_engagee: null,
    appareil_voie: "",
    signal_repere: "",
    inst_kvb: false,
    inst_kvb_en_service: null,
    inst_tvm: false,
    inst_tvm_300: false,
    inst_tvm_430: false,
    inst_tvm_en_service: null,
    inst_etcs: false,
    inst_etcs_1: false,
    inst_etcs_2: false,
    inst_etcs_en_service: null,
    inst_daat: false,
    inst_daat_en_service: null,
    inst_crocodile: false,
    inst_crocodile_en_service: null,
    inst_detonateur: null,
    inst_cartouche_percutee: null,
    pn_numero: "",
    pn_sal2: false,
    pn_sal4: false,
    pn_autres: false,
    pn_feux_routiers: null,
    autres_installations: "",
    train_numero: "",
    train_ef: "",
    train_locomotive_numero: "",
    train_us: false,
    train_um: false,
    train_rame_numero: "",
    train_engin_travaux_numero: "",
    train_conduite_em_en_tete: null,
    train_sous_traitant: false,
    train_mouvement_manoeuvre_non_guide: "",
    train_evolution_numero: "",
    train_type_ttx: false,
    train_type_tus: false,
    train_type_tsv: false,
    train_type_numero: "",
    train_double_traction: false,
    train_pousse: false,
    train_mouvement_manoeuvre_guide_numero: "",
    cab_kvb_covit: null,
    cab_daat: null,
    cab_rst: null,
    cab_gsm_gfu: null,
    cab_rs: null,
    cab_etcs_1: false,
    cab_etcs_2: false,
    cab_etcs: null,
    cab_tvm_300: false,
    cab_tvm_430: false,
    cab_tvm: null,
    compo_code: "",
    compo_nb_vehicules: "",
    compo_longueur: "",
    compo_masse: "",
    compo_masse_freinee_realisee: "",
    compo_masse_freinee_necessaire: "",
    parcours_de: "",
    parcours_a: "",
    vitesse_evenement: "",
    veh_nombre: "",
    veh_numero: "",
    veh_masse_rail: "",
    veh_masse_freinee_realisee: "",
    veh_position_freinage: "",
    veh_marchandise: false,
    veh_voyageur: false,
    veh_vide: false,
    veh_charge: false,
    veh_code_danger_onu: "",
    veh_tampons_circulaire: false,
    veh_tampons_rectangulaire: false,
    veh_tampons_autres: false,
    veh_serres_refus: null,
    veh_besoin_relevage: null,
    qui_sgc: false,
    qui_maintenance_travaux_mainteneur: false,
    qui_maintenance_travaux_convois_gi: false,
    qui_nb_personnes_cabine: "",
    qui_conducteur_seul_reseau: false,
    qui_conducteur_seul_prestataire: false,
    qui_conducteur_seul_conduite: false,
    qui_conducteur_seul_nom: "",
    qui_pilote_reseau: false,
    qui_pilote_prestataire: false,
    qui_pilote_conduite: false,
    qui_pilote_nom: "",
    qui_pam_reseau: false,
    qui_pam_prestataire: false,
    qui_pam_conduite: false,
    qui_pam_nom: "",
    qui_ops_sol_reseau: false,
    qui_ops_sol_prestataire: false,
    qui_ops_sol_conduite: false,
    qui_ops_sol_nom: "",
    autres_gi_nom: "",
    autres_gi_delegataire: false,
    autres_gi_titulaire: false,
    ef1_nom: "",
    ef1_pour_elle_meme: false,
    ef1_sous_traitant: false,
    ef1_utilisatrice_nom: "",
    ef2_nom: "",
    ef2_pour_elle_meme: false,
    ef2_sous_traitant: false,
    ef2_utilisatrice_nom: "",
    alcool_personne: "",
    alcool_pratique: null,
    alcool_positif: null,
    ap_blesse: null,
    ap_deces: null,
    ap_suicide_presume: null,
    ap_source: "",
    mc_l1_heure: "",
    mc_l1_par_qui: "",
    mc_l1_mesures: "",
    mc_l2_heure: "",
    mc_l2_par_qui: "",
    mc_l2_mesures: "",
    mc_l3_heure: "",
    mc_l3_par_qui: "",
    mc_l3_mesures: "",
    mc_notification_heure: "",
    mc_notification_dpx: false,
    mc_notification_cogc: false,
    consequences_visibles: "",
    recit_chronologique: "",
    acteur_l1_entreprise: "",
    acteur_l1_nom: "",
    acteur_l1_fonction: "",
    acteur_l2_entreprise: "",
    acteur_l2_nom: "",
    acteur_l2_fonction: "",
    acteur_l3_entreprise: "",
    acteur_l3_nom: "",
    acteur_l3_fonction: "",
    po_dpx_heure_avis: "",
    po_dpx_present: null,
    po_dpx_heure_arrivee: "",
    po_utm_heure_avis: "",
    po_utm_present: null,
    po_utm_heure_arrivee: "",
    po_reg_heure_avis: "",
    po_reg_present: null,
    po_reg_heure_arrivee: "",
    po_police_heure_avis: "",
    po_police_present: null,
    po_police_heure_arrivee: "",
    po_pompiers_heure_avis: "",
    po_pompiers_present: null,
    po_pompiers_heure_arrivee: "",
    po_funebres_heure_avis: "",
    po_funebres_present: null,
    po_funebres_heure_arrivee: "",
    po_autres_label: "",
    po_autres_heure_avis: "",
    po_autres_present: null,
    po_autres_heure_arrivee: "",
    po_ef1_heure_avis: "",
    po_ef1_present: null,
    po_ef1_heure_arrivee: "",
    po_ef2_heure_avis: "",
    po_ef2_present: null,
    po_ef2_heure_arrivee: "",
    po_convois_heure_avis: "",
    po_convois_present: null,
    po_convois_heure_arrivee: "",
    po_suge_heure_avis: "",
    po_suge_present: null,
    po_suge_heure_arrivee: "",
    po_titulaire_heure_avis: "",
    po_titulaire_present: null,
    po_titulaire_heure_arrivee: "",
    po_delegataire_heure_avis: "",
    po_delegataire_present: null,
    po_delegataire_heure_arrivee: "",
    franchissement_point_protege_engage: null,
    photos_jointes: null,
    photos_titres_habilitation: null,
    rci_etabli_le: "",
    rci_etabli_par: "",
    sig_eic_nom_fonction: "",
    sig_eic_tel: "",
    sig_autres_gi_nom_fonction: "",
    sig_autres_gi_tel: "",
    sig_ef1_nom_fonction: "",
    sig_ef1_tel: "",
    sig_ef2_nom_fonction: "",
    sig_ef2_tel: "",
  };
}

/** Clés boolean simples (true/false uniquement). Rendues comme 1 placeholder
 *  unique `{check_<key>}` ⇒ ☒ si true, ☐ si false. */
export const CHECK_BOOL_KEYS: ReadonlyArray<keyof RciPayload> = [
  "type_voie_vp",
  "type_voie_vs",
  "inst_kvb",
  "inst_tvm",
  "inst_tvm_300",
  "inst_tvm_430",
  "inst_etcs",
  "inst_etcs_1",
  "inst_etcs_2",
  "inst_daat",
  "inst_crocodile",
  "pn_sal2",
  "pn_sal4",
  "pn_autres",
  "train_us",
  "train_um",
  "train_sous_traitant",
  "train_type_ttx",
  "train_type_tus",
  "train_type_tsv",
  "train_double_traction",
  "train_pousse",
  "cab_etcs_1",
  "cab_etcs_2",
  "cab_tvm_300",
  "cab_tvm_430",
  "veh_marchandise",
  "veh_voyageur",
  "veh_vide",
  "veh_charge",
  "veh_tampons_circulaire",
  "veh_tampons_rectangulaire",
  "veh_tampons_autres",
  "qui_sgc",
  "qui_maintenance_travaux_mainteneur",
  "qui_maintenance_travaux_convois_gi",
  "qui_conducteur_seul_reseau",
  "qui_conducteur_seul_prestataire",
  "qui_conducteur_seul_conduite",
  "qui_pilote_reseau",
  "qui_pilote_prestataire",
  "qui_pilote_conduite",
  "qui_pam_reseau",
  "qui_pam_prestataire",
  "qui_pam_conduite",
  "qui_ops_sol_reseau",
  "qui_ops_sol_prestataire",
  "qui_ops_sol_conduite",
  "autres_gi_delegataire",
  "autres_gi_titulaire",
  "ef1_pour_elle_meme",
  "ef1_sous_traitant",
  "ef2_pour_elle_meme",
  "ef2_sous_traitant",
  "mc_notification_dpx",
  "mc_notification_cogc",
];

/** Clés ternaires (true / false / null). Rendues comme 2 placeholders
 *  `{check_<key>_oui}` (☒ si true) et `{check_<key>_non}` (☒ si false).
 *  null ⇒ aucune des deux cochée. */
export const CHECK_TERNARY_KEYS: ReadonlyArray<keyof RciPayload> = [
  "vp_engagee",
  "inst_kvb_en_service",
  "inst_tvm_en_service",
  "inst_etcs_en_service",
  "inst_daat_en_service",
  "inst_crocodile_en_service",
  "inst_detonateur",
  "inst_cartouche_percutee",
  "pn_feux_routiers",
  "train_conduite_em_en_tete",
  "cab_kvb_covit",
  "cab_daat",
  "cab_rst",
  "cab_gsm_gfu",
  "cab_rs",
  "cab_etcs",
  "cab_tvm",
  "veh_serres_refus",
  "veh_besoin_relevage",
  "alcool_pratique",
  "alcool_positif",
  "ap_blesse",
  "ap_deces",
  "ap_suicide_presume",
  "po_dpx_present",
  "po_utm_present",
  "po_reg_present",
  "po_police_present",
  "po_pompiers_present",
  "po_funebres_present",
  "po_autres_present",
  "po_ef1_present",
  "po_ef2_present",
  "po_convois_present",
  "po_suge_present",
  "po_titulaire_present",
  "po_delegataire_present",
  "franchissement_point_protege_engage",
  "photos_jointes",
  "photos_titres_habilitation",
];
