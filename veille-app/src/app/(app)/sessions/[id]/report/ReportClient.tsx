"use client";

import { useEffect, useState } from "react";
import { pdfFilename } from "@/lib/pdfFilename";
import {
  firstSentences,
  prefixOf,
  SOURCE_BY_PREFIX,
} from "@/lib/regSources";

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
      helpReference: string | null;
      helpText: string | null;
      photos: { path: string; legend: string | null }[];
    }[];
  }[];
  nonConform: {
    procedure: string;
    item: string;
    status: string;
    comment: string | null;
    gravity: number;
    helpReference: string | null;
    helpText: string | null;
  }[];
};

/**
 * Stats globales calculées sur l'ensemble des items observés.
 * Servent à la fois au bandeau HTML d'aperçu et au PDF (synthèse en
 * haut de page).
 */
function computeStats(data: ReportPayload) {
  let total = 0;
  let conforme = 0;
  let nc = 0;
  let aRevoir = 0;
  let na = 0;
  let nonObserve = 0;
  const ncByGravity: Record<number, number> = { 0: 0, 2: 0, 3: 0, 4: 0 };
  for (const po of data.procedures) {
    for (const it of po.items) {
      total++;
      switch (it.status) {
        case "CONFORME":
          conforme++;
          break;
        case "NON_CONFORME":
          nc++;
          ncByGravity[it.gravity ?? po.procedure.gravity] =
            (ncByGravity[it.gravity ?? po.procedure.gravity] ?? 0) + 1;
          break;
        case "A_REVOIR":
          aRevoir++;
          break;
        case "NON_APPLICABLE":
          na++;
          break;
        default:
          nonObserve++;
      }
    }
  }
  const observed = total - nonObserve - na;
  const rate = observed > 0 ? Math.round((conforme / observed) * 1000) / 10 : null;
  return {
    procedures: data.procedures.length,
    total,
    conforme,
    nc,
    aRevoir,
    na,
    nonObserve,
    rate,
    ncByGravity,
  };
}

/**
 * Liste des documents réglementaires cités dans la session, pour le
 * pied de page "Sources réglementaires" du rapport PDF.
 */
function computeSources(data: ReportPayload): string[] {
  const prefixes = new Set<string>();
  for (const po of data.procedures) {
    for (const it of po.items) {
      const p = prefixOf(it.helpReference);
      if (p && SOURCE_BY_PREFIX[p]) prefixes.add(p);
    }
  }
  return [...prefixes].sort().map((p) => SOURCE_BY_PREFIX[p]);
}

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

      const stats = computeStats(data);
      const sources = computeSources(data);

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

      // ─── Bandeau de synthèse statistique ───────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [
          [
            "Procédures",
            "Items observés",
            "Conformes",
            "NC",
            "À revoir",
            "NA",
            "Taux",
          ],
        ],
        body: [
          [
            String(stats.procedures),
            String(stats.total - stats.nonObserve),
            String(stats.conforme),
            String(stats.nc),
            String(stats.aRevoir),
            String(stats.na),
            stats.rate != null ? `${stats.rate.toFixed(1)} %` : "—",
          ],
        ],
        styles: {
          fontSize: 9,
          cellPadding: 5,
          halign: "center",
          valign: "middle",
        },
        headStyles: { fillColor: [46, 84, 150], textColor: 255 },
        margin: { left: margin, right: margin },
      });
      // @ts-expect-error lastAutoTable
      y = doc.lastAutoTable.finalY + 6;

      // Si NC, détail ventilation par gravité.
      if (stats.nc > 0) {
        const grav = stats.ncByGravity;
        const parts: string[] = [];
        if (grav[4]) parts.push(`${grav[4]} G4`);
        if (grav[3]) parts.push(`${grav[3]} G3`);
        if (grav[2]) parts.push(`${grav[2]} G2`);
        if (grav[0]) parts.push(`${grav[0]} NT`);
        if (parts.length) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(
            `Ventilation des NC par gravité : ${parts.join(", ")}`,
            margin,
            y
          );
          doc.setTextColor(0);
          doc.setFont("helvetica", "normal");
          y += 14;
        }
      }
      y += 6;

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
          i.helpReference ?? "",
          i.comment ?? "",
        ]);
        autoTable(doc, {
          startY: y,
          head: [["Statut", "G", "Point", "Réf.", "Commentaire"]],
          body: rows,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [46, 84, 150] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 24 },
            2: { cellWidth: 200 },
            3: { cellWidth: 86, font: "courier", fontStyle: "normal" },
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
        // Une ligne par NC contient : procédure / point + réf + extrait /
        // statut / commentaire. L'extrait reprend les 3 premières phrases
        // de l'aide réglementaire (helpText) pour que le rapport soit
        // auto-suffisant sans consulter la doc source.
        autoTable(doc, {
          startY: y,
          head: [["Procédure", "Point", "Statut", "Commentaire"]],
          body: data.nonConform.map((nc) => {
            const refLine = nc.helpReference ? `\n[${nc.helpReference}]` : "";
            const extract = nc.helpText
              ? `\n${firstSentences(nc.helpText, 3)}`
              : "";
            return [
              nc.procedure,
              nc.item + refLine + extract,
              shortStatus(nc.status),
              nc.comment ?? "",
            ];
          }),
          styles: { fontSize: 9, cellPadding: 4, valign: "top" },
          headStyles: { fillColor: [192, 21, 47] },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 240 },
            2: { cellWidth: 40, halign: "center" },
          },
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

      // ─── Pied de page "Sources réglementaires" sur la dernière page ───
      // Listées en italique gris, séparateur fin au-dessus pour bien les
      // distinguer du corps du rapport.
      if (sources.length) {
        // @ts-expect-error lastAutoTable
        const yLast = doc.lastAutoTable?.finalY ?? y;
        const pageH = doc.internal.pageSize.getHeight();
        let sy = yLast + 24;
        const blockH = 18 + sources.length * 11;
        if (sy + blockH > pageH - margin) {
          doc.addPage();
          sy = margin;
        }
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.line(margin, sy, doc.internal.pageSize.getWidth() - margin, sy);
        sy += 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text("Sources réglementaires", margin, sy);
        sy += 11;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120);
        for (const src of sources) {
          doc.text(`• ${src}`, margin, sy);
          sy += 11;
        }
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
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
