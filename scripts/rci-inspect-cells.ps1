$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Downloads\RCI modèle EIC RAL v10 du 15-09-2025 (version numérique).docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_inspect.docx'
Copy-Item -Path $src -Destination $copy -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

# Rangées problématiques (Ti, Ri) — affiche le nombre de cellules visibles + contenu de chaque.
$targets = @(
  @{T=4; R=4}, @{T=4; R=5}, @{T=4; R=6}, @{T=4; R=7},
  @{T=5; R=6}, @{T=5; R=9}, @{T=5; R=10}, @{T=5; R=11},
  @{T=5; R=18},
  @{T=5; R=21}, @{T=5; R=22}, @{T=5; R=23},
  @{T=7; R=2}, @{T=7; R=5}, @{T=7; R=6}, @{T=7; R=7}
)

"Total tables: $($doc.Tables.Count)"
foreach ($t in $targets) {
  try {
    $row = $doc.Tables.Item($t.T).Rows.Item($t.R)
    $cells = $row.Cells
    $cnt = $cells.Count
    "T$($t.T).R$($t.R) = $cnt cells"
    for ($i = 1; $i -le $cnt; $i++) {
      $txt = $cells.Item($i).Range.Text.Trim() -replace "`r`a", ' / ' -replace "[`r`n`a]", ''
      $txt = if ($txt.Length -gt 60) { $txt.Substring(0, 60) + '...' } else { $txt }
      "  V$i = '$txt'"
    }
  } catch {
    "T$($t.T).R$($t.R) = KO ($($_.Exception.Message))"
  }
}

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Remove-Item $copy -Force
