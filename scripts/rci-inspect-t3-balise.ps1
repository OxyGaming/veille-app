$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_t3b.docx'
Copy-Item -Path $src -Destination $copy -Force
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

$tbl = $doc.Tables.Item(3)
"T3 COM (template balisé) : $($tbl.Rows.Count) rows"
for ($i = 1; $i -le 70; $i++) {
    try {
        $cell = $tbl.Range.Cells.Item($i)
        $txt = $cell.Range.Text.Trim() -replace "[`r`n`a]", ' '
        if ($txt.Length -gt 80) { $txt = $txt.Substring(0, 80) + '...' }
        "Cell #$i (R$($cell.RowIndex).C$($cell.ColumnIndex)) : '$txt'"
    } catch {
        break
    }
}

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Remove-Item $copy -Force
