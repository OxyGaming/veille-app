# Balisage RCI — vague 1 (réécriture corrigée avec la VRAIE numérotation COM).
# Reprend depuis le template original officiel pour repartir d'une base propre.
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Downloads\RCI modèle EIC RAL v10 du 15-09-2025 (version numérique).docx'
$dest = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'

Copy-Item -Path $src -Destination $dest -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($dest)

# ───── Mapping audit Python → COM ─────────────────────────────────────────
#   T1 audit  → T1 COM (Header)
#   T2 audit  → T2 COM (Quand/Où/Installations/PN)
#   T3 audit  → T3 COM (Mobiles) + sous-table imbriquée Conduite
#   T4 audit  → sous-table imbriquée dans T3 COM Cell(17, 4)
#   T5 audit  → T4 COM (Alcoolémie/AP/Mesures/Comment/Acteurs/Personnes)
#   T6 audit  → T5 COM (Schéma + cases bas + RCI établi)
#   T7 audit  → T6 COM (Signatures)

function Set-CellText {
    param([object]$Table, [int]$Ri, [int]$Ci, [string]$Txt)
    try {
        $cell = $Table.Cell($Ri, $Ci)
        $r = $cell.Range
        $r.End = $r.End - 1
        $r.Text = $Txt
    } catch {
        Write-Host "[KO] R$Ri.C$Ci : $($_.Exception.Message)"
    }
}

function Find-Replace {
    param([string]$Find, [string]$Replace)
    $sel = $word.Selection
    $sel.HomeKey(6) | Out-Null
    $f = $sel.Find
    $f.ClearFormatting()
    $f.Replacement.ClearFormatting()
    $f.Text = $Find
    $f.Replacement.Text = $Replace
    $f.Forward = $true
    $f.Wrap = 1
    $f.MatchCase = $false
    $f.MatchWholeWord = $false
    $f.MatchWildcards = $false
    if ($f.Execute([ref]$Find, $false, $false, $false, $false, $false, $true, 1, $false, [ref]$Replace, 2)) {
        Write-Host "[OK] FR '$($Find.Substring(0, [Math]::Min(40, $Find.Length)))…'"
    } else {
        Write-Host "[KO] FR '$Find' introuvable"
    }
}

$T1 = $doc.Tables.Item(1) # Header
$T2 = $doc.Tables.Item(2) # Quand/Où/Installations
$T3 = $doc.Tables.Item(3) # Mobiles
$T4 = $doc.Tables.Item(4) # Alcoolémie...
$T5 = $doc.Tables.Item(5) # Schéma
$T6 = $doc.Tables.Item(6) # Signatures

# ───── Header (audit T1 → COM T1) ──────────────────────────────────────────
Set-CellText $T1 1 1 'EIC Rhône-Alpes Lyon, 78 rue de la Villette 69003 LYON  Dossier enregistré au COGC Rhône-Alpes Lyon sous le numéro {txt_dossier_numero} (JJMMAAHHMM - lieu)'

# ───── Quand (audit T2 R3-5 → COM T2 R3-5) ─────────────────────────────────
Set-CellText $T2 3 2 '{txt_jour_semaine}'
Set-CellText $T2 3 3 '{txt_nature}'
Set-CellText $T2 4 2 '{txt_date_evenement}'
Set-CellText $T2 5 2 '{txt_heure_evenement}'

# ───── Où (audit T2 R7-9) ──────────────────────────────────────────────────
Set-CellText $T2 7 2 '{txt_gare_section}'
Set-CellText $T2 8 1 'Point Kilométrique {txt_point_km}'
Set-CellText $T2 8 2 'Numéro de Voie : {txt_numero_voie}'
Set-CellText $T2 8 3 "N° ligne : {txt_numero_ligne}"
Set-CellText $T2 8 4 "N° Dpt : {txt_numero_dpt}"
Set-CellText $T2 9 1 'Type de voie : {txt_type_voie}'
Set-CellText $T2 9 2 'VP {check_type_voie_vp}    VS {check_type_voie_vs}'
Set-CellText $T2 9 3 '{check_vp_engagee_oui}  Avec VP engagée            {check_vp_engagee_non} Sans VP engagée'

# ───── Installations (audit T2 R11-18) ─────────────────────────────────────
Set-CellText $T2 11 2 '{txt_appareil_voie}'
Set-CellText $T2 12 1 'Signal / Repère n°…/ EOA Km {txt_signal_repere}'
Set-CellText $T2 13 2 '{check_inst_kvb}    KVB, KCVP, KVBP'
Set-CellText $T2 13 3 '{check_inst_kvb_en_service_oui}  oui    {check_inst_kvb_en_service_non}  non'
Set-CellText $T2 13 4 '{check_inst_daat}    DAAT'
Set-CellText $T2 13 5 '{check_inst_daat_en_service_oui}  oui    {check_inst_daat_en_service_non}  non'
Set-CellText $T2 14 2 '{check_inst_tvm}  TVM    {check_inst_tvm_300}     300  {check_inst_tvm_430}    430'
Set-CellText $T2 14 3 '{check_inst_tvm_en_service_oui}  oui    {check_inst_tvm_en_service_non}  non'
Set-CellText $T2 14 4 '{check_inst_crocodile}  Crocodile'
Set-CellText $T2 14 5 '{check_inst_crocodile_en_service_oui}  oui    {check_inst_crocodile_en_service_non}  non'
Set-CellText $T2 15 2 '{check_inst_etcs}    ETCS  {check_inst_etcs_1}    1   {check_inst_etcs_2}    2'
Set-CellText $T2 15 3 '{check_inst_etcs_en_service_oui}  oui    {check_inst_etcs_en_service_non}  non'
Set-CellText $T2 16 2 "Équipé d’un détonateur         {check_inst_detonateur_oui}  oui    {check_inst_detonateur_non}  non"
Set-CellText $T2 16 3 'Cartouche percutée            {check_inst_cartouche_percutee_oui}  oui    {check_inst_cartouche_percutee_non}  non'

# ───── PN (audit T2 R17) ───────────────────────────────────────────────────
Set-CellText $T2 17 1 'PN n° : {txt_pn_numero}'
Set-CellText $T2 17 2 'SAL 2   {check_pn_sal2}     SAL4   {check_pn_sal4}     Autres  {check_pn_autres}'
Set-CellText $T2 17 3 'Feux routiers fonctionnent :  {check_pn_feux_routiers_oui}  oui    {check_pn_feux_routiers_non}  non'

# ───── Autres installations (audit T2 R18) ─────────────────────────────────
Set-CellText $T2 18 2 '{txt_autres_installations}'

# ───── Mobiles (audit T3 → COM T3) ─────────────────────────────────────────
Set-CellText $T3 2 1 'Train n° {txt_train_numero}'
Set-CellText $T3 2 3 'Entreprise Ferroviaire {txt_train_ef}'
Set-CellText $T3 2 4 "Locomotive ou Automoteur n° : {txt_train_locomotive_numero}     US  {check_train_us}     UM …  {check_train_um}       Rame n° : {txt_train_rame_numero} Engin travaux n° : {txt_train_engin_travaux_numero}"
Set-CellText $T3 2 5 "Conduite depuis engin moteur en tête du mouvement : {check_train_conduite_em_en_tete_oui}  oui    {check_train_conduite_em_en_tete_non}  non"
Set-CellText $T3 4 1 'Mouvement de manœuvre non guidé n° {txt_train_mouvement_manoeuvre_non_guide}'
Set-CellText $T3 4 3 '{check_train_sous_traitant} Sous-traitant'
Set-CellText $T3 4 5 "KVB ou COVIT`r`nDAAT`r`nRST`r`nGSM / GFU`r`nRS (répétition signaux)`r`nETCS {check_cab_etcs_1}   1   {check_cab_etcs_2} 2`r`nTVM   {check_cab_tvm_300}  300  {check_cab_tvm_430} 430"
Set-CellText $T3 4 6 "{check_cab_kvb_covit_oui}  oui`r`n{check_cab_daat_oui}  oui`r`n{check_cab_rst_oui}  oui`r`n{check_cab_gsm_gfu_oui}  oui`r`n{check_cab_rs_oui}  oui`r`n{check_cab_etcs_oui}  oui`r`n{check_cab_tvm_oui}  oui"
Set-CellText $T3 4 7 "{check_cab_kvb_covit_non}  non`r`n{check_cab_daat_non}  non`r`n{check_cab_rst_non}  non`r`n{check_cab_gsm_gfu_non}  non`r`n{check_cab_rs_non}  non`r`n{check_cab_etcs_non}  non`r`n{check_cab_tvm_non}  non"
Set-CellText $T3 6 1 ("{check_train_type_ttx} TTx n° {txt_train_type_numero}" + [char]0x000B + "{check_train_type_tus} TUS n°" + [char]0x000B + "{check_train_type_tsv} TSV n°")
Set-CellText $T3 6 3 ("Particularités Traction" + [char]0x000B + "{check_train_double_traction} Double Traction" + [char]0x000B + "{check_train_pousse} Pousse")
Set-CellText $T3 7 1 'Mouvement de manœuvre guidé n° {txt_train_mouvement_manoeuvre_guide_numero}'
Set-CellText $T3 8 2 'Code ou indice compo : {txt_compo_code}'
Set-CellText $T3 8 3 'Nombre véhicule : {txt_compo_nb_vehicules}'
Set-CellText $T3 8 4 'Longueur : {txt_compo_longueur}'
Set-CellText $T3 8 5 'Masse : {txt_compo_masse}'
Set-CellText $T3 8 6 'Masse freinée réalisée : {txt_compo_masse_freinee_realisee}'
Set-CellText $T3 8 7 'Masse freinée nécessaire : {txt_compo_masse_freinee_necessaire}'
Set-CellText $T3 9 2 "De (voie, gare…) : {txt_parcours_de}`r`nÀ (voie, gare…) : {txt_parcours_a}"
Set-CellText $T3 9 3 "Vitesse au moment de l’événement (selon la déclaration du conducteur) : {txt_vitesse_evenement}"
Set-CellText $T3 10 1 "Véhicules accidentés concernés`r`nNombre : {txt_veh_nombre}"
Set-CellText $T3 10 2 'Numéro : {txt_veh_numero}'
Set-CellText $T3 11 2 'Masse sur rail : {txt_veh_masse_rail}'
Set-CellText $T3 11 4 'Masse freinée réalisée : {txt_veh_masse_freinee_realisee}'
Set-CellText $T3 12 2 'Position dispositif freinage : {txt_veh_position_freinage}'
Set-CellText $T3 12 3 '{check_veh_marchandise}  Marchandise   {check_veh_voyageur}  Voyageur      {check_veh_vide} Vide      {check_veh_charge} Chargé'
Set-CellText $T3 13 2 'Code Danger / Code ONU : {txt_veh_code_danger_onu}'
Set-CellText $T3 14 3 '{check_veh_tampons_circulaire}  circulaire  {check_veh_tampons_rectangulaire} rectangulaire    {check_veh_tampons_autres}  Autres'
Set-CellText $T3 14 4 'Serrés à refus    {check_veh_serres_refus_oui} oui    {check_veh_serres_refus_non} non'
Set-CellText $T3 15 2 '{check_veh_besoin_relevage_oui} oui    {check_veh_besoin_relevage_non} non'
Set-CellText $T3 17 2 'SGC {check_qui_sgc}'
Set-CellText $T3 17 3 'Maintenance et Travaux {check_qui_maintenance_travaux_mainteneur} (Activité mainteneur)'
Set-CellText $T3 18 2 'Nom : {txt_autres_gi_nom}'
Set-CellText $T3 18 3 "Délégataire titulaire d’une convention pour le compte de SNCF Réseau {check_autres_gi_delegataire}"
Set-CellText $T3 18 4 "Titulaire d’un contrat/marché de partenariat ou d’un contrat de concession/concession de travaux publics ou d’une convention de délégation de service public {check_autres_gi_titulaire}"
Set-CellText $T3 19 2 'Nom : {txt_ef1_nom}'
Set-CellText $T3 19 3 'Travaille pour elle-même  {check_ef1_pour_elle_meme}'
Set-CellText $T3 19 4 "Travaille en tant que sous-traitant  {check_ef1_sous_traitant} Nom de l’EF utilisatrice : {txt_ef1_utilisatrice_nom}"

# EF n°2 sur T3 R20 (si la ligne existe).
try {
    if ($T3.Rows.Count -ge 20) {
        Set-CellText $T3 20 2 'Nom : {txt_ef2_nom}'
        Set-CellText $T3 20 3 'Travaille pour elle-même  {check_ef2_pour_elle_meme}'
        Set-CellText $T3 20 4 "Travaille en tant que sous-traitant  {check_ef2_sous_traitant} Nom de l’EF utilisatrice : {txt_ef2_utilisatrice_nom}"
    }
} catch {}

# ───── Conduite (audit T4 → sous-table imbriquée dans T3 Cell(17, 4)) ──────
# IMPORTANT : `$T3.Cell(17, 4).Range.Tables.Item(1)` renvoie en pratique T3
# lui-même (la table parent), PAS la sous-table imbriquée. Le balisage via
# Set-CellText sur ce "$nested" écrasait T3 R2/R4-R7 (Train n°, Mouvement de
# manœuvre, etc.) — confirmé par inspection visuelle.
#
# Solution : on baliser uniquement le champ « Nombre de personnes en cabine »
# de la sous-table via Find/Replace contextuel (chaîne unique dans le doc).
# Les 12 cases Réseau/Prestataire/Conduite et 4 noms Pilote/PAM/Ops sol/
# Conducteur seul restent non balisés (limitation acceptée vague 1) — l'auteur
# les coche/remplit manuellement dans Word après génération.
Find-Replace 'Nombre de personnes en cabine de conduite : ' 'Nombre de personnes en cabine de conduite : {txt_qui_nb_personnes_cabine}'

# ───── Alcoolémie / AP / Mesures / Comment / Acteurs (audit T5 → COM T4) ───
Set-CellText $T4 2 1 "Personne concernée : {txt_alcool_personne}"
Set-CellText $T4 3 1 'Pratiqué : {check_alcool_pratique_oui} Oui   {check_alcool_pratique_non} Non'
Set-CellText $T4 3 2 'Positif : {check_alcool_positif_oui} Oui   {check_alcool_positif_non} Non'
Set-CellText $T4 5 1 'Blessé :    {check_ap_blesse_oui} Oui   {check_ap_blesse_non} Non'
Set-CellText $T4 5 2 'Décès :  {check_ap_deces_oui} Oui   {check_ap_deces_non} Non'
Set-CellText $T4 6 1 'Suicide présumé :  {check_ap_suicide_presume_oui} Oui   {check_ap_suicide_presume_non} Non'
Set-CellText $T4 6 2 'Source : {txt_ap_source}'
# Mesures conservatoires lignes 1-3
Set-CellText $T4 9 1 '{txt_mc_l1_heure}'
Set-CellText $T4 9 2 '{txt_mc_l1_par_qui}'
Set-CellText $T4 9 3 '{txt_mc_l1_mesures}'
Set-CellText $T4 10 1 '{txt_mc_l2_heure}'
Set-CellText $T4 10 2 '{txt_mc_l2_par_qui}'
Set-CellText $T4 10 3 '{txt_mc_l2_mesures}'
Set-CellText $T4 11 1 '{txt_mc_l3_heure}'
Set-CellText $T4 11 2 '{txt_mc_l3_par_qui}'
Set-CellText $T4 11 3 '{txt_mc_l3_mesures}'
Set-CellText $T4 12 1 ("Notification à par écrit des mesures conservatoires à {txt_mc_notification_heure} h" + [char]0x000B + "Réalisé par : le dirigeant d’enquête {check_mc_notification_dpx} ou COGC (DRC) {check_mc_notification_cogc}" + [char]0x000B + "(sauf si le représentant de l’EF est sur place)")
Set-CellText $T4 14 1 '{txt_consequences_visibles}'
Set-CellText $T4 18 2 '{txt_recit_chronologique}'
# Acteurs principaux 3 lignes
Set-CellText $T4 21 1 '{txt_acteur_l1_entreprise}'
Set-CellText $T4 21 2 '{txt_acteur_l1_nom}'
Set-CellText $T4 21 3 '{txt_acteur_l1_fonction}'
Set-CellText $T4 22 1 '{txt_acteur_l2_entreprise}'
Set-CellText $T4 22 2 '{txt_acteur_l2_nom}'
Set-CellText $T4 22 3 '{txt_acteur_l2_fonction}'
Set-CellText $T4 23 1 '{txt_acteur_l3_entreprise}'
Set-CellText $T4 23 2 '{txt_acteur_l3_nom}'
Set-CellText $T4 23 3 '{txt_acteur_l3_fonction}'

# ───── Personnes/Organismes appelés - présents sur place (T4 R26-R41) ─────
# 13 rôles × 3 colonnes (heure_avis, présent oui/non, heure_arrivée).
# Les entêtes de section (R25 R29 R34 R39) sont laissées telles quelles.
$po = @(
    @{ row = 26; key = 'dpx' },
    @{ row = 27; key = 'utm' },
    @{ row = 28; key = 'reg' },
    @{ row = 30; key = 'police' },
    @{ row = 31; key = 'pompiers' },
    @{ row = 32; key = 'funebres' },
    @{ row = 33; key = 'autres' },
    @{ row = 35; key = 'ef1' },
    @{ row = 36; key = 'ef2' },
    @{ row = 37; key = 'convois' },
    @{ row = 38; key = 'suge' },
    @{ row = 40; key = 'titulaire' },
    @{ row = 41; key = 'delegataire' }
)
foreach ($r in $po) {
    $k = $r.key
    $row = $r.row
    Set-CellText $T4 $row 2 ('{txt_po_' + $k + '_heure_avis}')
    Set-CellText $T4 $row 3 ('{check_po_' + $k + '_present_oui} oui / {check_po_' + $k + '_present_non} non')
    Set-CellText $T4 $row 4 ('{txt_po_' + $k + '_heure_arrivee}')
}
# Rôle « Autres » : ajouter un champ libre pour préciser le rôle.
Set-CellText $T4 33 1 'Autres (à préciser) : {txt_po_autres_label}'

# ───── Schéma + cases bas + RCI établi (audit T6 → COM T5) ─────────────────
Set-CellText $T5 1 1 'Schéma succinct{%photo_schema_succinct}'
Set-CellText $T5 3 2 'oui {check_franchissement_point_protege_engage_oui}'
Set-CellText $T5 3 3 '{check_franchissement_point_protege_engage_non} non'
Set-CellText $T5 4 2 'oui {check_photos_jointes_oui}'
Set-CellText $T5 4 3 '{check_photos_jointes_non} non'
Set-CellText $T5 5 2 'oui {check_photos_titres_habilitation_oui}'
Set-CellText $T5 5 3 '{check_photos_titres_habilitation_non} non'
Set-CellText $T5 6 1 "RCI établi le {txt_rci_etabli_le} par M {txt_rci_etabli_par}     Ce document doit être cosigné par l’ensemble des participants (si refus, le mentionner sur la dernière page)."

# ───── Signatures (audit T7 → COM T6) ─────────────────────────────────────
# T6 COM signale 'Impossible d'accéder à des lignes individuelles' via Rows,
# mais Cell(r,c) peut quand même fonctionner sur les cellules logiques non
# fusionnées verticalement. On essaie.
Set-CellText $T6 2 4 '{txt_sig_eic_nom_fonction}'
Set-CellText $T6 2 5 '{txt_sig_eic_tel}'
Set-CellText $T6 5 3 '{txt_sig_autres_gi_nom_fonction}'
Set-CellText $T6 5 4 '{txt_sig_autres_gi_tel}'
Set-CellText $T6 6 3 '{txt_sig_ef1_nom_fonction}'
Set-CellText $T6 6 4 '{txt_sig_ef1_tel}'
Set-CellText $T6 7 3 '{txt_sig_ef2_nom_fonction}'
Set-CellText $T6 7 4 '{txt_sig_ef2_tel}'

# ───── Re-balisage des 4 cellules « ☐Nom » de la sous-table Conduite ───────
# Set-CellText sur les cellules fusionnées de la sous-table imbriquée a
# partiellement raté (R5.C5, R6.C5, R7.C4 KO et le format texte avait sauté
# sur R4.C5). On reprend par Find/Replace contextuel : les 4 « ☐Nom » sont
# alignées dans le bon ordre (Conducteur seul, Pilote, PAM, Ops sol).
function FindReplaceNext {
    param([string]$Anchor, [string]$Find, [string]$Replace)
    $sel = $word.Selection
    # Reset position
    $sel.HomeKey(6) | Out-Null
    # Positionnement sur l'ancre (label Conducteur seul / etc.)
    $f1 = $sel.Find
    $f1.ClearFormatting()
    $f1.Text = $Anchor
    $f1.Wrap = 1
    $f1.Forward = $true
    if (-not $f1.Execute()) {
        Write-Host "[KO] Anchor '$Anchor' introuvable"
        return
    }
    # Find suivant à partir du curseur (☐Nom dans la cellule voisine)
    $f2 = $sel.Find
    $f2.ClearFormatting()
    $f2.Replacement.ClearFormatting()
    $f2.Text = $Find
    $f2.Replacement.Text = $Replace
    $f2.Forward = $true
    $f2.Wrap = 0
    if ($f2.Execute([ref]$Find, $false, $false, $false, $false, $false, $true, 1, $false, [ref]$Replace, 2)) {
        Write-Host "[OK] $Anchor -> '$Find' remplacé"
    } else {
        Write-Host "[KO] '$Find' après '$Anchor' introuvable"
    }
}

# NOTE : les 4 cellules « ☐Nom » de la sous-table Conduite (Conducteur seul,
# Pilote, PAM, Opérations au sol) NE SONT PAS BALISÉES — Word COM les rejette
# (fusions verticales) et les Find/Replace en série se corrompent mutuellement
# (chaque placeholder inséré contient "_nom}" qui devient cible du Find suivant).
# Limitation acceptée pour vague 1 : ces 4 noms sont à compléter manuellement
# dans Word après génération.

# Pour les cellules KO de la sous-table Conduite (R5.C4, R6.C4, etc.), il
# faut aussi placer les check_qui_*_reseau et check_qui_*_prestataire qui
# n'ont pas atterri. Approche similaire : on cible le « ☐ » seul qui suit
# l'ancre. Comme « ☐ » est très commun, on enchaîne 3 fois.
function FindReplaceCheckAfter {
    param([string]$Anchor, [string[]]$Replacements)
    $sel = $word.Selection
    $sel.HomeKey(6) | Out-Null
    $f1 = $sel.Find
    $f1.ClearFormatting()
    $f1.Text = $Anchor
    $f1.Wrap = 1
    $f1.Forward = $true
    if (-not $f1.Execute()) {
        Write-Host "[KO] Anchor '$Anchor' introuvable (checks)"
        return
    }
    foreach ($repl in $Replacements) {
        $f2 = $sel.Find
        $f2.ClearFormatting()
        $f2.Replacement.ClearFormatting()
        $f2.Text = '☐'
        $f2.Replacement.Text = $repl
        $f2.Forward = $true
        $f2.Wrap = 0
        # Replace une seule occurrence (Replace=1 : wdReplaceOne)
        if (-not $f2.Execute([ref]'☐', $false, $false, $false, $false, $false, $true, 1, $false, [ref]$repl, 1)) {
            Write-Host "[KO] ☐ après '$Anchor' introuvable"
            break
        }
    }
    Write-Host "[OK] $Anchor : 3 checks placés"
}

# Note : pour Conducteur seul on a déjà R4.C3 réseau OK via Set-CellText (donc
# il reste R4.C4 prestataire à placer). Approche prudente : on saute Conducteur
# seul puisque le 1er ☐ après son ancre est déjà placé (réseau bien balisé).
# Pour Pilote/PAM/Ops sol, R5/R6/R7 cellules C3/C4 sont VIDES (KO), donc on
# pose les 2 cases (réseau + prestataire) après l'ancre. Le 3e ☐ (conduite)
# précède le placeholder Nom et a déjà été placé par le bloc précédent.

# DÉSACTIVÉ tant que la convention des Replacements n'est pas vérifiée -
# le risque de pourrir d'autres ☐ aléatoires en aval est trop grand sans test
# unitaire. La vague 2 (Personnes/organismes) sera l'occasion de revoir.
# FindReplaceCheckAfter "Présence d'un pilote" @('{check_qui_pilote_reseau}', '{check_qui_pilote_prestataire}')

# ───── Suppression Phase 2 + Annexes (T8 → T20+ en COM) ───────────────────
# Notre module RCI ne couvre que la partie 1 « Avis immédiat ». Les tables
# suivantes (feuillet suppl., constatations SGC/maintenance/EF, déclarations
# opérateurs, distribution finale, annexes 1-8) sont supprimées du template
# pour ne pas livrer un .docx avec ~15 pages de cases parasites à l'auteur.
# On garde T1..T6 (Header, Quand/Où, Mobiles, Alcoolémie+Comment+Acteurs+
# Personnes/Organismes, Schéma, Signatures). T7 = Feuillet supplémentaire =
# phase 2, à supprimer comme tout le reste.
$beforeCount = $doc.Tables.Count
$loops = 0
while ($doc.Tables.Count -gt 6 -and $loops -lt 50) {
    try {
        $doc.Tables.Item($doc.Tables.Count).Delete()
    } catch {
        break
    }
    $loops++
}
"[OK] Tables phase 2 supprimées : $beforeCount → $($doc.Tables.Count)"

# Supprimer aussi les paragraphes/sauts de page restants en queue de document,
# qui referencent encore les feuillets supprimés.
try {
    $endRange = $doc.Content
    $endRange.End = $endRange.End
    # On supprime depuis la fin du dernier tableau jusqu'à la fin du doc
    if ($doc.Tables.Count -gt 0) {
        $lastTbl = $doc.Tables.Item($doc.Tables.Count)
        $tailRange = $doc.Range($lastTbl.Range.End, $doc.Content.End)
        $tailText = $tailRange.Text.Trim()
        if ($tailText.Length -gt 0) {
            $tailRange.Delete() | Out-Null
            "[OK] Tail nettoyée ($($tailText.Length) chars)"
        }
    }
} catch {
    "[WARN] Tail cleanup : $($_.Exception.Message)"
}

$doc.Save()
$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

"Done. File size: $((Get-Item $dest).Length)"
