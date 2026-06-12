"use client";

import { useEffect, useState } from "react";
import { pdfFilename } from "@/lib/pdfFilename";

type ReportPayload = {
  session: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    generalComment: string | null;
  };
  team: { name: string } | null;
  agent: { firstName: string; lastName: string; matricule: string } | null;
  observer: { name: string };
  poste: { name: string } | null;
  secteur: { name: string } | null;
  procedures: {
    id: string;
    generalComment: string | null;
    procedure: {
      title: string;
      domain: string;
      theme: string | null;
      gravity: number;
      documents: string[];
      risk: string | null;
    };
    items: {
      label: string;
      status: string;
      comment: string | null;
      gravity: number | null;
      photos: { path: string; legend: string | null }[];
    }[];
  }[];
  nonConform: {
    procedure: string;
    item: string;
    status: string;
    comment: string | null;
    gravity: number;
  }[];
};

export default function ReportClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/report`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      });
  }, [sessionId]);

  async function generatePDF() {
    if (!data) return;
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40;
      let y = margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Compte rendu de veille", margin, y);
      y += 22;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date : ${new Date(data.session.startedAt).toLocaleString("fr-FR")}`, margin, y);
      y += 14;
      doc.text(`Observateur : ${data.observer.name}`, margin, y);
      y += 14;
      if (data.agent) {
        doc.text(
          `Agent : ${data.agent.lastName} ${data.agent.firstName} (${data.agent.matricule})`,
          margin,
          y
        );
        y += 14;
      }
      if (data.team) {
        doc.text(`Équipe : ${data.team.name}`, margin, y);
        y += 14;
      }
      if (data.poste || data.secteur) {
        doc.text(
          `Poste/secteur : ${[data.poste?.name, data.secteur?.name]
            .filter(Boolean)
            .join(" — ")}`,
          margin,
          y
        );
        y += 14;
      }
      y += 8;

      for (const po of data.procedures) {
        if (y > 720) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`${po.procedure.title}`, margin, y);
        y += 14;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(
          `${po.procedure.domain}${
            po.procedure.theme ? " · " + po.procedure.theme : ""
          } — Gravité G${po.procedure.gravity}`,
          margin,
          y
        );
        y += 12;
        if (po.procedure.risk) {
          doc.setTextColor(180, 30, 30);
          doc.text(`Risque : ${po.procedure.risk}`, margin, y);
          y += 12;
        }
        doc.setTextColor(0);
        const rows = po.items.map((i) => [
          shortStatus(i.status),
          i.gravity != null ? `G${i.gravity}` : "",
          i.label,
          i.comment ?? "",
        ]);
        autoTable(doc, {
          startY: y,
          head: [["Statut", "G", "Point", "Commentaire"]],
          body: rows,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [46, 84, 150] },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 28 },
            2: { cellWidth: 260 },
          },
          margin: { left: margin, right: margin },
        });
        // @ts-expect-error lastAutoTable est ajouté par autoTable.
        y = doc.lastAutoTable.finalY + 16;
      }

      if (data.nonConform.length) {
        if (y > 720) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Synthèse des points non conformes / à revoir", margin, y);
        y += 14;
        autoTable(doc, {
          startY: y,
          head: [["Procédure", "Point", "Statut", "Commentaire"]],
          body: data.nonConform.map((nc) => [
            nc.procedure,
            nc.item,
            shortStatus(nc.status),
            nc.comment ?? "",
          ]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [192, 21, 47] },
          margin: { left: margin, right: margin },
        });
      }

      if (data.session.generalComment) {
        // @ts-expect-error idem
        let cy = (doc.lastAutoTable?.finalY ?? y) + 20;
        if (cy > 720) {
          doc.addPage();
          cy = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Commentaire général", margin, cy);
        cy += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(data.session.generalComment, 515);
        doc.text(lines, margin, cy);
      }

      doc.save(
        pdfFilename({
          type: "Session veille",
          subject: data.agent
            ? `${data.agent.lastName} ${data.agent.firstName}`
            : "sans-agent",
          date: data.session.startedAt,
        })
      );
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <div className="p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-[var(--muted)]">Chargement…</div>;
  return (
    <div className="p-4 pb-32">
      <button
        onClick={generatePDF}
        disabled={generating}
        className="bg-[var(--steel)] text-white font-semibold py-3 px-4 rounded-xl w-full sticky top-2 z-10"
      >
        {generating ? "Génération…" : "📄 Télécharger le PDF"}
      </button>
      <h1 className="text-xl font-bold mt-4">Compte rendu</h1>
      <div className="text-xs text-[var(--muted)] mt-1">
        Démarrée le {new Date(data.session.startedAt).toLocaleString("fr-FR")}
      </div>
      {data.agent && (
        <div className="text-sm mt-1">
          Agent : <b>{data.agent.lastName} {data.agent.firstName}</b> ({data.agent.matricule})
        </div>
      )}
      <div className="text-sm">Observateur : <b>{data.observer.name}</b></div>

      <div className="grid gap-3 mt-4">
        {data.procedures.map((po) => (
          <section key={po.id} className="bg-white border border-[var(--line)] rounded-xl p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted-2)]">
              {po.procedure.domain}
              {po.procedure.theme && ` · ${po.procedure.theme}`}
            </div>
            <h2 className="text-sm font-bold">{po.procedure.title}</h2>
            <ul className="mt-2 grid gap-1">
              {po.items.map((i, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-[10px] font-mono w-7 text-center rounded bg-slate-100 px-1 py-0.5">
                    {shortStatus(i.status)}
                  </span>
                  <span className="flex-1">
                    {i.label}
                    {i.comment && (
                      <div className="text-xs text-[var(--muted)]">
                        « {i.comment} »
                      </div>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {data.nonConform.length > 0 && (
        <section className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <h2 className="text-sm font-bold text-red-800">
            {data.nonConform.length} point(s) non conforme(s) / à revoir
          </h2>
          <ul className="mt-2 grid gap-1.5">
            {data.nonConform.map((nc, idx) => (
              <li key={idx} className="text-xs">
                <b>{nc.procedure}</b> — {nc.item}{" "}
                <span className="font-mono">[{shortStatus(nc.status)}]</span>
                {nc.comment && (
                  <div className="text-[11px] text-red-900/80">
                    « {nc.comment} »
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.session.generalComment && (
        <section className="mt-4 bg-white border border-[var(--line)] rounded-xl p-3">
          <h2 className="text-sm font-bold">Commentaire général</h2>
          <p className="text-sm mt-2 whitespace-pre-wrap">
            {data.session.generalComment}
          </p>
        </section>
      )}
    </div>
  );
}

function shortStatus(s: string): string {
  switch (s) {
    case "CONFORME":
      return "C";
    case "NON_CONFORME":
      return "NC";
    case "A_REVOIR":
      return "AR";
    case "NON_APPLICABLE":
      return "NA";
    default:
      return "?";
  }
}
