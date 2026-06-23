#!/usr/bin/env python
"""Audit du template RCI : extraire toutes les cellules de tableau avec leur texte,
identifier les cases à cocher (☐) et les champs « valeur » candidats au balisage.

Sortie : C:/Users/PC/Desktop/Veille/_rci_audit_fields.txt — une ligne par cellule
avec contexte (ligne tableau / colonne / texte).
"""
import sys
import zipfile
import xml.etree.ElementTree as ET
import io

SRC = r"C:\Users\PC\Desktop\Veille\veille-app\public\rci\template-poc.docx"
OUT = r"C:\Users\PC\Desktop\Veille\_rci_audit_fields.txt"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def cell_text(cell):
    parts = []
    for t in cell.iter(W + "t"):
        if t.text:
            parts.append(t.text)
    return "".join(parts).strip()


def walk(root, out):
    # Track table nesting depth so we can group cells per row
    table_idx = 0
    for tbl in root.iter(W + "tbl"):
        table_idx += 1
        out.write(f"\n===== TABLE {table_idx} =====\n")
        for row_idx, row in enumerate(tbl.findall(W + "tr"), 1):
            cells = row.findall(W + "tc")
            for col_idx, cell in enumerate(cells, 1):
                txt = cell_text(cell)
                # Highlight cells containing ☐ / ☒ or short typical-value cells
                marker = ""
                if "☐" in txt or "☒" in txt:
                    cnt = txt.count("☐") + txt.count("☒")
                    marker = f" [CHECK x{cnt}]"
                out.write(f"  T{table_idx}.R{row_idx}.C{col_idx}{marker}: {txt[:140]}\n")


def main():
    with zipfile.ZipFile(SRC) as z:
        xml = z.read("word/document.xml")
    tree = ET.fromstring(xml)
    body = tree.find(W + "body")
    with open(OUT, "w", encoding="utf-8") as out:
        out.write(f"# Audit RCI template — {SRC}\n")
        walk(body, out)
    print(f"OK -> {OUT}")


if __name__ == "__main__":
    main()
