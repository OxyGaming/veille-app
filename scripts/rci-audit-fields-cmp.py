#!/usr/bin/env python
"""Audit comparatif : extrait les cellules avec ☐/☒ et contenu non vide
des deux .docx fournis sur la ligne de commande."""
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def cell_text(cell):
    parts = []
    for t in cell.iter(W + "t"):
        if t.text:
            parts.append(t.text)
    return "".join(parts).strip()


def walk(src, out):
    with zipfile.ZipFile(src) as z:
        xml = z.read("word/document.xml")
    tree = ET.fromstring(xml)
    body = tree.find(W + "body")
    out.write(f"\n# {src}\n")
    table_idx = 0
    for tbl in body.iter(W + "tbl"):
        table_idx += 1
        out.write(f"\n===== TABLE {table_idx} =====\n")
        for row_idx, row in enumerate(tbl.findall(W + "tr"), 1):
            for col_idx, cell in enumerate(row.findall(W + "tc"), 1):
                txt = cell_text(cell)
                if not txt:
                    continue
                marker = ""
                if "☐" in txt or "☒" in txt:
                    marker = f" [☐×{txt.count('☐')} ☒×{txt.count('☒')}]"
                short = txt[:120].replace("\n", " ¶ ")
                if len(txt) > 120:
                    short += "..."
                out.write(f"T{table_idx}.R{row_idx}.C{col_idx}{marker}: {short}\n")


with open(r"C:\Users\PC\Desktop\Veille\_cmp_generated.txt", "w", encoding="utf-8") as o:
    walk(sys.argv[1], o)
with open(r"C:\Users\PC\Desktop\Veille\_cmp_template.txt", "w", encoding="utf-8") as o:
    walk(sys.argv[2], o)
print("OK")
