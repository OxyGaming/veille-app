# Passe 2 — Find/Replace pour les cellules ratées par la passe 1 (tables imbriquées).
$ErrorActionPreference = 'Stop'
$dest = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($dest)

function Find-Replace {
    param([string]$Find, [string]$Replace, [int]$Wrap = 1)
    $sel = $word.Selection
    $sel.HomeKey(6) | Out-Null
    $f = $sel.Find
    $f.ClearFormatting()
    $f.Replacement.ClearFormatting()
    $f.Text = $Find
    $f.Replacement.Text = $Replace
    $f.Forward = $true
    $f.Wrap = $Wrap
    $f.MatchCase = $false
    $f.MatchWholeWord = $false
    $f.MatchWildcards = $false
    $f.Execute([ref]$Find, $false, $false, $false, $false, $false, $true, 1, $false, [ref]$Replace, 2) | Out-Null
}

# T5.R18.C2 — Récit chronologique
# Le texte « Peu après 7h00 ce jeudi » introduit le récit RCI exemple.
# On va d'abord positionner sur ce paragraphe, sélectionner jusqu'à la fin de la
# cellule, supprimer et insérer le placeholder. Plus simple en multi-passe Find.
$sel = $word.Selection
$sel.HomeKey(6) | Out-Null
$f = $sel.Find
$f.ClearFormatting()
$f.Text = "Peu après 7h00 ce jeudi"
if ($f.Execute()) {
    # Sélectionne la cellule courante puis remplace.
    $cell = $sel.Cells.Item(1)
    $r = $cell.Range
    $r.End = $r.End - 1
    $r.Text = '{txt_recit_chronologique}'
    Write-Host "[OK] Récit chronologique"
} else {
    Write-Host "[KO] Récit chronologique introuvable"
}

# T5.R6.C2 — Source AP
Find-Replace 'Pompiers + personne elle-même' '{txt_ap_source}'
# Si la valeur résiduelle contient juste 'Pompiers' (split), on assure
# qu'aucun reliquat ne traîne :
Find-Replace 'personne elle-même' ''

# T5.R9.C3 — Mesures conservatoires ligne 1 (seul contenu non vide dans l'exemple)
Find-Replace 'CRC : arrêt des circulations V1+2' '{txt_mc_l1_mesures}'

# T7 signatures établies (cellules vides — on insère après les ancres uniques).
# Pour préserver la structure, on cible le contenu d'une rangée via le label
# unique « EIC RA » puis on injecte juste après dans la rangée suivante.
# La rangée T7.R2 contient déjà 'EIC RA' (cellule 3) — on insère les placeholders
# dans les paragraphes suivants en utilisant Find sur 'EIC RA' :
function Append-AfterAnchor {
    param([string]$Anchor, [string]$Insert)
    $sel = $word.Selection
    $sel.HomeKey(6) | Out-Null
    $f = $sel.Find
    $f.ClearFormatting()
    $f.Text = $Anchor
    if ($f.Execute()) {
        # Se positionner en fin de cellule pour insérer dans la cellule courante.
        try {
            $cell = $sel.Cells.Item(1)
            $cell.Range.InsertAfter(" $Insert")
            Write-Host "[OK] anchor '$Anchor'"
        } catch {
            Write-Host "[KO] anchor '$Anchor' : $($_.Exception.Message)"
        }
    } else {
        Write-Host "[KO] anchor '$Anchor' introuvable"
    }
}

# Note : nous ne touchons pas aux signatures (T7) pour cette passe — l'auteur
# pourra remplir le PDF/Word à la main si nécessaire ; les noms/téléphones sont
# par nature non sériables proprement sans une zone dédiée par cellule.

$doc.Save()
$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

"Done. File size: $((Get-Item $dest).Length)"
