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
    photos: string[];
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
        // Filtre des items non observés ET non applicables : ils n'ont pas
        // leur place dans le compte rendu — un item "?" n'a pas été évalué,
        // un "NA" est explicitement hors-périmètre. Les stats du bandeau
        // en haut du PDF les comptabilisent toujours (transparence).
        const observed = po.items.filter(
          (i) => i.status !== "NON_OBSERVE" && i.status !== "NON_APPLICABLE"
        );
        if (observed.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text("Aucun point observé sur cette procédure.", margin, y);
          doc.setTextColor(0);
          doc.setFont("helvetica", "normal");
          y += 18;
          continue;
        }
        // Cellule "Point" : libellé en gras + aide réglementaire (3
        // premières phrases) en italique sous le libellé. Le tout est
        // traité comme un seul bloc texte par autoTable qui le wrap.
        const rows = observed.map((i) => {
          const labelBlock = i.helpText
            ? `${i.label}\n${firstSentences(i.helpText, 3)}`
            : i.label;
          return [
            longStatus(i.status),
            i.gravity != null ? `G${i.gravity}` : "",
            labelBlock,
            i.helpReference ?? "",
            i.comment ?? "",
          ];
        });
        autoTable(doc, {
          startY: y,
          head: [["Statut", "G", "Point", "Réf.", "Commentaire"]],
          body: rows,
          styles: {
            fontSize: 9,
            cellPadding: 4,
            // overflow: linebreak fait grandir la ligne automatiquement
            // selon le contenu — pas de troncature sur commentaires longs.
            overflow: "linebreak",
            valign: "top",
          },
          headStyles: { fillColor: [46, 84, 150], valign: "middle" },
          columnStyles: {
            0: { cellWidth: 70, halign: "center" },
            1: { cellWidth: 24, halign: "center" },
            2: { cellWidth: 180 },
            3: { cellWidth: 80, font: "courier", fontStyle: "normal" },
            // colonne 4 (Commentaire) : largeur restante (auto)
          },
          margin: { left: margin, right: margin },
        });
        // @ts-expect-error lastAutoTable est ajouté par autoTable.
        y = doc.lastAutoTable.finalY + 16;
      }

      // ─── Curseur vertical unifié pour les blocs suivants ───────────────
      // Toutes les sections ci-après s'enchaînent en utilisant `y` comme
      // unique référence. Un helper `ensureSpace(h)` ajoute une nouvelle
      // page si la hauteur requise dépasse la zone utile. Plus de
      // `lastAutoTable.finalY` qui peut pointer ailleurs après images.
      const pageH = doc.internal.pageSize.getHeight();
      const pageW = doc.internal.pageSize.getWidth();
      const bottomMargin = margin;
      function ensureSpace(h: number) {
        if (y + h > pageH - bottomMargin) {
          doc.addPage();
          y = margin;
        }
      }

      // ─── Synthèse des points non conformes / à revoir ─────────────────
      if (data.nonConform.length) {
        ensureSpace(50);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Synthèse des points non conformes / à revoir", margin, y);
        y += 16;
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
              longStatus(nc.status),
              nc.comment ?? "",
            ];
          }),
          styles: {
            fontSize: 9,
            cellPadding: 4,
            valign: "top",
            overflow: "linebreak",
          },
          headStyles: { fillColor: [192, 21, 47] },
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 230 },
            2: { cellWidth: 70, halign: "center" },
          },
          margin: { left: margin, right: margin },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 24;
      }

      // ─── Commentaire général ──────────────────────────────────────────
      if (data.session.generalComment) {
        const lines = doc.splitTextToSize(
          data.session.generalComment,
          pageW - 2 * margin
        );
        ensureSpace(18 + lines.length * 12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Commentaire général", margin, y);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(lines, margin, y);
        y += lines.length * 12 + 16;
      }

      // ─── Photos jointes aux NC (page dédiée systématique) ─────────────
      const ncWithPhotos = data.nonConform.filter(
        (nc) => nc.photos && nc.photos.length > 0
      );
      if (ncWithPhotos.length > 0) {
        // Démarre toujours sur une nouvelle page pour éviter tout
        // chevauchement avec les blocs précédents.
        doc.addPage();
        y = margin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Photos jointes aux non-conformités", margin, y);
        y += 18;
        for (const nc of ncWithPhotos) {
          const ncIdx = data.nonConform.indexOf(nc) + 1;
          ensureSpace(120);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(80);
          const titleLines = doc.splitTextToSize(
            `NC #${ncIdx} — ${nc.procedure} — ${nc.item}`,
            pageW - 2 * margin
          );
          doc.text(titleLines, margin, y);
          y += titleLines.length * 11 + 4;
          doc.setTextColor(0);
          doc.setFont("helvetica", "normal");
          // Charge les images en parallèle.
          const dataUrls = await Promise.all(
            nc.photos.map(async (path) => {
              try {
                const r = await fetch(path);
                if (!r.ok) return null;
                const blob = await r.blob();
                return await new Promise<string>((resolve) => {
                  const fr = new FileReader();
                  fr.onload = () => resolve(fr.result as string);
                  fr.readAsDataURL(blob);
                });
              } catch {
                return null;
              }
            })
          );
          const valid = dataUrls.filter((u): u is string => !!u);
          const thumbW = 140;
          const thumbH = 100;
          const gap = 10;
          let x = margin;
          for (const url of valid) {
            if (x + thumbW > pageW - margin) {
              x = margin;
              y += thumbH + gap;
              ensureSpace(thumbH + gap);
            }
            try {
              doc.addImage(url, "JPEG", x, y, thumbW, thumbH);
            } catch {
              /* skip silencieusement */
            }
            x += thumbW + gap;
          }
          y += thumbH + 24;
        }
      }

      // ─── Pied "Sources réglementaires" (toujours sur sa propre fin) ───
      if (sources.length) {
        const blockH = 22 + sources.length * 11;
        ensureSpace(blockH + 12);
        y += 8;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageW - margin, y);
        y += 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text("Sources réglementaires", margin, y);
        y += 11;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120);
        for (const src of sources) {
          doc.text(`• ${src}`, margin, y);
          y += 11;
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
        {data.procedures.map((po) => {
          // Aperçu HTML aligné sur le PDF : on n'affiche que les items
          // effectivement observés. NON_OBSERVE ("?") et NON_APPLICABLE
          // sont exclus du détail (les stats du bandeau les comptent).
          const observed = po.items.filter(
            (i) => i.status !== "NON_OBSERVE" && i.status !== "NON_APPLICABLE"
          );
          return (
            <section
              key={po.id}
              className="bg-white border border-[var(--line)] rounded-xl p-3"
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted-2)]">
                {po.procedure.domain}
                {po.procedure.theme && ` · ${po.procedure.theme}`}
              </div>
              <h2 className="text-sm font-bold">{po.procedure.title}</h2>
              {observed.length === 0 ? (
                <div className="text-xs italic text-[var(--muted)] mt-2">
                  Aucun point observé sur cette procédure.
                </div>
              ) : (
                <ul className="mt-2 grid gap-1">
                  {observed.map((i, idx) => (
                    <li key={idx} className="text-sm flex gap-2">
                      <span className="text-[10px] font-mono w-7 text-center rounded bg-slate-100 px-1 py-0.5">
                        {shortStatus(i.status)}
                      </span>
                      <span className="flex-1">
                        {i.label}
                        {i.helpReference && (
                          <span className="ml-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5 align-middle">
                            {i.helpReference}
                          </span>
                        )}
                        {i.helpText && (
                          <div className="text-[11px] italic text-slate-500 mt-0.5">
                            {firstSentences(i.helpText, 3)}
                          </div>
                        )}
                        {i.comment && (
                          <div className="text-xs text-[var(--muted)] mt-0.5">
                            « {i.comment} »
                          </div>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
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

/** Libellé long du statut — utilisé dans le PDF pour la lisibilité. */
function longStatus(s: string): string {
  switch (s) {
    case "CONFORME":
      return "Conforme";
    case "NON_CONFORME":
      return "Non conforme";
    case "A_REVOIR":
      return "À revoir";
    case "NON_APPLICABLE":
      return "Non applicable";
    default:
      return "—";
  }
}
