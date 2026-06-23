$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Downloads\RCI modèle EIC RAL v10 du 15-09-2025 (version numérique).docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_t3.docx'
Copy-Item -Path $src -Destination $copy -Force
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

$tbl = $doc.Tables.Item(3)
"T3 COM : $($tbl.Rows.Count) rows total"
# Itérer par Cell index plat (puisque Rows peut être bloqué par fusions verticales)
$totalCells = 0
try {
    for ($i = 1; $i -le 200; $i++) {
        try {
            $cell = $tbl.Range.Cells.Item($i)
            $txt = $cell.Range.Text.Trim() -replace "[`r`n`a]", ' '
            if ($txt.Length -gt 50) { $txt = $txt.Substring(0, 50) + '...' }
            "Cell #$i (R$($cell.RowIndex).C$($cell.ColumnIndex)) : '$txt'"
            $totalCells = $i
        } catch {
            break
        }
    }
} catch {}
"Total cells parcourues : $totalCells"

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Remove-Item $copy -Force
