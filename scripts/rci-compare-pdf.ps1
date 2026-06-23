$ErrorActionPreference = 'Stop'
# Génère un .docx via l'API serveur en remplissant un brouillon, puis le
# convertit en PDF pour comparaison visuelle avec le modèle officiel.
$tplOriginal = 'C:\Users\PC\Downloads\RCI modèle EIC RAL v10 du 15-09-2025 (version numérique).docx'
$tplBalise = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

function ToPdf($src, $dst) {
    $copy = "$env:TEMP\rci_cmp_" + (Get-Random) + ".docx"
    Copy-Item $src $copy -Force
    $doc = $word.Documents.Open($copy)
    $doc.SaveAs2($dst, 17) # 17 = wdFormatPDF
    $doc.Close($false)
    Remove-Item $copy -Force
}

$out1 = 'C:\Users\PC\Desktop\Veille\_rci_template_original.pdf'
$out2 = 'C:\Users\PC\Desktop\Veille\_rci_template_balise.pdf'
ToPdf $tplOriginal $out1
ToPdf $tplBalise $out2

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

"OK : $out1 et $out2"
