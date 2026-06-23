$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Desktop\Veille\veille-app\public\rci\template.docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_t4.docx'
Copy-Item -Path $src -Destination $copy -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

$tbl = $doc.Tables.Item(4)
"T4 (COM) : $($tbl.Rows.Count) rows"
for ($r = 1; $r -le $tbl.Rows.Count; $r++) {
    try {
        $row = $tbl.Rows.Item($r)
        $cnt = $row.Cells.Count
        $cells = @()
        for ($c = 1; $c -le [Math]::Min($cnt, 5); $c++) {
            $txt = $row.Cells.Item($c).Range.Text.Trim() -replace "[`r`n`a]", ' '
            if ($txt.Length -gt 35) { $txt = $txt.Substring(0, 35) + '...' }
            $cells += "V${c}='$txt'"
        }
        "R$r ($cnt cells) : $($cells -join ' | ')"
    } catch {
        "R$r : KO"
    }
}

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Remove-Item $copy -Force
