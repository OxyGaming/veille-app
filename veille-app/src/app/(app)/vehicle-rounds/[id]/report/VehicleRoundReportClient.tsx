"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { pdfFilename } from "@/lib/pdfFilename";
import {
  RESPONSE_FORMAT_LABELS,
  vehicleTypeLabel,
  type ResponseFormat,
} from "@/lib/vehicle-types";

type Observation = {
  id: string;
  itemId: string;
  sectionId: string;
  status: string;
  comment: string | null;
};
type Item = {
  id: string;
  label: string;
  applicableTypes: string;
  responseFormat: string;
};
type Section = {
  id: string;
  title: string;
  items: Item[];
};
type Round = {
  id: string;
  roundDate: string;
  finishedAt: string | null;
  generalComment: string | null;
  immatriculation: string;
  vehicleType: string;
  vehicle: {
    immatriculation: string;
    label: string | null;
    team: { name: string } | null;
  };
  template: { name: string; sections: Section[] };
  observer: { name: string };
  observations: Observation[];
};

type Row = {
  sectionTitle: string;
  label: string;
  status: string;
  responseLabel: string;
  comment: string | null;
};

function isResponseFormat(value: string): value is ResponseFormat {
  return value in RESPONSE_FORMAT_LABELS;
}

function statusToText(status: string, format: string): string {
  const fmt = isResponseFormat(format)
    ? RESPONSE_FORMAT_LABELS[format]
    : RESPONSE_FORMAT_LABELS.PRESENT_ABSENT;
  if (status === "OUI") return fmt.oui;
  if (status === "NON") return fmt.non;
  if (status === "SANS_OBJET") return fmt.sansObjet ?? "Sans objet";
  return "Non saisi";
}

export default function VehicleRoundReportClient({ round }: { round: Round }) {
  const [exporting, setExporting] = useState(false);

  const rows: Row[] = useMemo(() => {
    const obsByItem = new Map(
      round.observations.map((o) => [o.itemId, o])
    );
    return round.template.sections.flatMap((s) =>
      s.items
        .filter((it) => {
          let types: string[];
          try {
            types = JSON.parse(it.applicableTypes);
          } catch {
            types = [];
          }
          return types.length === 0 || types.includes(round.vehicleType);
        })
        .map((it) => {
          const obs = obsByItem.get(it.id);
          const status = obs?.status ?? "PENDING";
          return {
            sectionTitle: s.title,
            label: it.label,
            status,
            responseLabel: statusToText(status, it.responseFormat),
            comment: obs?.comment ?? null,
          };
        })
    );
  }, [round]);

  const total = rows.length;
  const evaluated = rows.filter((r) => r.status !== "PENDING").length;
  const ko = rows.filter((r) => r.status === "NON").length;
  const conformity =
    evaluated > 0 ? Math.round(((evaluated - ko) / evaluated) * 100) : null;
  const koRows = rows.filter((r) => r.status === "NON");

  async function exportPdf() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;

      // En-tête.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Compte rendu — Tournée Véhicule de Service", margin, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(round.template.name, margin, 66);

      // Bloc identification véhicule.
      doc.setDrawColor(220);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, 82, pageWidth - margin * 2, 84, 6, 6, "FD");
      doc.setTextColor(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Immatriculation", margin + 14, 102);
      doc.text("Type de VS", margin + 220, 102);
      doc.text("Date", margin + 380, 102);
      doc.setFont("courier", "bold");
      doc.setFontSize(14);
      doc.text(round.immatriculation, margin + 14, 122);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(vehicleTypeLabel(round.vehicleType), margin + 220, 122);
      doc.text(
        format(new Date(round.roundDate), "PPP", { locale: fr }),
        margin + 380,
        122
      );

      doc.setFontSize(9);
      doc.setTextColor(90);
      const obsLine = `Observateur : ${round.observer.name}`;
      const teamLine = round.vehicle.team?.name
        ? ` · Équipe : ${round.vehicle.team.name}`
        : "";
      const labelLine = round.vehicle.label
        ? ` · ${round.vehicle.label}`
        : "";
      doc.text(`${obsLine}${teamLine}${labelLine}`, margin + 14, 152);

      // Encart conformité.
      const yBox = 184;
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(199, 210, 254);
      doc.roundedRect(margin, yBox, pageWidth - margin * 2, 46, 6, 6, "FD");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 48, 163);
      doc.setFontSize(11);
      doc.text("Synthèse", margin + 14, yBox + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const synth = `Items évalués : ${evaluated} / ${total}   ·   Non conformes : ${ko}   ·   Taux de conformité : ${
        conformity === null ? "—" : `${conformity} %`
      }`;
      doc.text(synth, margin + 14, yBox + 34);

      // Tableau des items.
      autoTable(doc, {
        startY: yBox + 60,
        head: [["Section", "Item", "Réponse", "Commentaire"]],
        body: rows.map((r) => [
          r.sectionTitle,
          r.label,
          r.responseLabel,
          r.comment ?? "",
        ]),
        styles: { fontSize: 9, cellPadding: 5, valign: "top" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 90 },
          2: { cellWidth: 70, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const status = rows[data.row.index].status;
            if (status === "NON") {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [153, 27, 27];
              data.cell.styles.fontStyle = "bold";
            } else if (status === "OUI") {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [22, 101, 52];
            } else if (status === "PENDING") {
              data.cell.styles.textColor = [148, 163, 184];
              data.cell.styles.fontStyle = "italic";
            }
          }
        },
        margin: { left: margin, right: margin },
      });

      // Liste des non-conformités (si présentes).
      const finalY =
        (doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY ?? yBox + 60;
      if (koRows.length > 0) {
        let y = finalY + 24;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(153, 27, 27);
        doc.text(
          `Points de non conformité (${koRows.length})`,
          margin,
          y
        );
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(40);
        for (const r of koRows) {
          const txt = `• ${r.label}${r.comment ? ` — ${r.comment}` : ""}`;
          const lines = doc.splitTextToSize(txt, pageWidth - margin * 2);
          for (const line of lines) {
            if (y > 780) {
              doc.addPage();
              y = 50;
            }
            doc.text(line, margin, y);
            y += 12;
          }
        }
      }

      // Commentaire général (si présent).
      if (round.generalComment) {
        const startY =
          koRows.length > 0
            ? finalY + 24 + 14 + koRows.length * 12 + 12
            : finalY + 24;
        let y = startY;
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.text("Commentaire général", margin, y);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(
          round.generalComment,
          pageWidth - margin * 2
        );
        for (const line of lines) {
          if (y > 780) {
            doc.addPage();
            y = 50;
          }
          doc.text(line, margin, y);
          y += 12;
        }
      }

      // Pied de page sur chaque page.
      const total_pages = doc.getNumberOfPages();
      for (let i = 1; i <= total_pages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Généré le ${format(new Date(), "PPpp", { locale: fr })}   ·   Page ${i} / ${total_pages}`,
          margin,
          820
        );
      }

      doc.save(
        pdfFilename({
          type: "Tournee-VS",
          subject: round.immatriculation,
          date: round.roundDate,
        })
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-4xl mx-auto">
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link
            href={`/vehicle-rounds/${round.id}`}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            <Icon.ChevronLeft className="w-3 h-3" /> Retour à la tournée
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold mt-2">
            Rapport — {round.immatriculation}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {vehicleTypeLabel(round.vehicleType)} ·{" "}
            {format(new Date(round.roundDate), "PPP", { locale: fr })}
          </p>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          <Icon.Download className="w-4 h-4" />
          {exporting ? "Génération…" : "Télécharger le PDF"}
        </button>
      </div>

      {/* Aperçu écran */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Items évalués
            </div>
            <div className="text-2xl font-bold mt-1">
              {evaluated} / {total}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Non conformes
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${ko > 0 ? "text-rose-700" : "text-slate-700"}`}
            >
              {ko}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Conformité
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                conformity === null
                  ? "text-slate-400"
                  : conformity === 100
                    ? "text-emerald-700"
                    : conformity >= 80
                      ? "text-amber-700"
                      : "text-rose-700"
              }`}
            >
              {conformity === null ? "—" : `${conformity}%`}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-800 mb-2">
            Détail des items
          </h2>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-center px-3 py-2">Réponse</th>
                <th className="text-left px-3 py-2">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{r.label}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                        r.status === "OUI"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.status === "NON"
                            ? "bg-rose-50 text-rose-700"
                            : r.status === "SANS_OBJET"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-slate-50 text-slate-400 italic"
                      }`}
                    >
                      {r.responseLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.comment ?? <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {round.generalComment && (
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-2">
              Commentaire général
            </h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {round.generalComment}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
