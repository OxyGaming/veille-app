$ErrorActionPreference = 'Stop'
$src = 'C:\Users\PC\Downloads\RCI modèle EIC RAL v10 du 15-09-2025 (version numérique).docx'
$copy = 'C:\Users\PC\Desktop\Veille\_rci_audit.docx'
$txtOut = 'C:\Users\PC\Desktop\Veille\_rci_audit.txt'
Copy-Item -Path $src -Destination $copy -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($copy)

# Sauve en .txt avec layout (préserve les colonnes/cellules approximativement)
$txt = New-Object -ComObject Word.Application
$txt = $null
$doc.SaveAs2($txtOut, 7) # 7 = wdFormatUnicodeText (utf-16) ; on convertira en utf-8

$doc.Close($false)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

# Convert UTF-16 → UTF-8 pour grep facile
$content = Get-Content $txtOut -Raw -Encoding Unicode
$utf8Out = 'C:\Users\PC\Desktop\Veille\_rci_audit_utf8.txt'
[System.IO.File]::WriteAllText($utf8Out, $content, [System.Text.UTF8Encoding]::new($false))

(Get-Content $utf8Out -Encoding UTF8).Count.ToString() + ' lines'
