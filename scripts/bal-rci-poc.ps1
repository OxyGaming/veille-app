$ErrorActionPreference = 'Stop'
$path = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template-poc.docx'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$doc = $word.Documents.Open($path)

function Replace-All($find, $replace) {
    $sel = $word.Selection
    $sel.HomeKey(6) | Out-Null
    $f = $sel.Find
    $f.ClearFormatting()
    $f.Replacement.ClearFormatting()
    $f.Text = $find
    $f.Replacement.Text = $replace
    $f.Forward = $true
    $f.Wrap = 1
    $f.MatchCase = $true
    $f.MatchWholeWord = $false
    $f.MatchWildcards = $false
    $null = $f.Execute([ref]$find, $false, $false, $false, $false, $false, $true, 1, $false, [ref]$replace, 2)
}

Replace-All '08/01/2026' '{date_rci}'
Replace-All '08012026 St Romain en Gier' '{dossier_numero}'
Replace-All '435.700' '{pk}'
Replace-All '750000' '{ligne_numero}'
Replace-All '109.98' '{longueur_train}'

$range = $doc.Content
$f = $range.Find
$f.ClearFormatting()
$f.Text = 'Schéma succinct'
if ($f.Execute()) {
    $insertRange = $range.Duplicate
    $insertRange.SetRange($range.End, $range.End)
    $insertRange.InsertParagraphAfter()
    $insertRange.SetRange($insertRange.End, $insertRange.End)
    $insertRange.Text = '{%photo}'
    'Placeholder photo inserted after Schéma succinct'
} else {
    'Schéma succinct not found'
}

$doc.Save()
$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
'Done. File size: ' + (Get-Item $path).Length
