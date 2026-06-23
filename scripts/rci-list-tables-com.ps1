$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_listtables.docx'
Copy-Item -Path $src -Destination $copy -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

"Total tables: $($doc.Tables.Count)"
for ($t = 1; $t -le $doc.Tables.Count; $t++) {
    try {
        $tbl = $doc.Tables.Item($t)
        $rows = $tbl.Rows.Count
        $firstRow = $tbl.Rows.Item(1)
        $firstCells = $firstRow.Cells.Count
        $firstTxt = $firstRow.Cells.Item(1).Range.Text.Trim() -replace "[`r`n`a]", ' '
        if ($firstTxt.Length -gt 80) { $firstTxt = $firstTxt.Substring(0, 80) + '...' }
        "T$t : $rows rows × $firstCells visible cells in R1 -- R1.V1='$firstTxt'"
    } catch {
        "T$t : KO ($($_.Exception.Message))"
    }
}

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Remove-Item $copy -Force
