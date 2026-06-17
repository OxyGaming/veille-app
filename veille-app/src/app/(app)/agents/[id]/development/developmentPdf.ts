/**
 * Génération du PDF « Fiche de développement individuel ».
 *
 * Pure helper côté client : prend un `AgentDevelopmentSummary` (déjà calculé
 * par C1) et produit un document jsPDF de 4 pages.
 *
 * - Pas de notation, pas de score : le vocabulaire de surface est
 *   « à valoriser », « axes de développement », « points d'attention ».
 * - Pied de page sur chaque page avec la mention méthodologique.
 * - Encadré « Échantillon limité » conditionnel si `summary.lowSample`.
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type {
  AgentDevelopmentSummary,
  MonthlyObservationCount,
} from "@/lib/agent-development-aggregator";

type Doc = import("jspdf").jsPDF;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoTable = (doc: Doc, opts: any) => void;

const MARGIN = 40;
const PAGE_W = 595; // A4 portrait en pt
const PAGE_H = 842;
const USABLE_W = PAGE_W - MARGIN * 2;

const FOOTER_TEXT =
  "Document d'aide au dialogue managérial. Il ne constitue pas une notation automatique et doit être interprété avec le contexte opérationnel.";

const LOW_SAMPLE_TEXT =
  "Échantillon limité : les éléments ci-dessous doivent être interprétés avec prudence et complétés par l'échange managérial.";

function slug(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nom de fichier normalisé :
 *   Fiche-Developpement-NOM-PRENOM-YYYY-MM-DD.pdf
 * (date = jour de génération, comme demandé par la spec).
 */
export function developmentPdfFilename(
  agentLastName: string,
  agentFirstName: string,
  generatedAt: Date,
): string {
  const stamp = format(generatedAt, "yyyy-MM-dd");
  const name = [slug(agentLastName), slug(agentFirstName)]
    .filter(Boolean)
    .join("-");
  return `Fiche-Developpement-${name || "Agent"}-${stamp}.pdf`;
}

/**
 * Génère le PDF et retourne un blob téléchargeable. La construction est
 * 100 % côté client — pas d'appel réseau ici. Le caller doit logger
 * l'événement séparément via /api/agents/[id]/development/pdf-log.
 */
export async function buildDevelopmentPdf(
  summary: AgentDevelopmentSummary,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod.default ?? autoTableMod) as AutoTable;

  const doc: Doc = new jsPDF({ unit: "pt", format: "a4" });

  // Page 1 — Synthèse
  renderHeader(doc, summary);
  let y = MARGIN + 110;
  if (summary.lowSample) {
    y = renderLowSampleBox(doc, y);
  }
  y = renderKpis(doc, summary, y);
  y = renderMonthlyChart(doc, summary.monthly, y);

  // Page 2 — À valoriser
  doc.addPage();
  renderSectionHeader(doc, "À valoriser");
  let y2 = MARGIN + 50;
  y2 = renderTopProcedures(
    doc,
    autoTable,
    "Procédures observées en conformité",
    summary.topConforme.map((p) => [
      String(p.conformeCount),
      p.title,
      p.domain,
    ]),
    [40, 167, 69],
    y2,
  );
  y2 = renderDomainCoverage(doc, autoTable, summary, y2);
  y2 = renderCommentList(
    doc,
    autoTable,
    "Éléments observés positifs",
    summary.positiveComments.slice(0, 5),
    [40, 167, 69],
    y2,
  );

  // Page 3 — Axes de développement
  doc.addPage();
  renderSectionHeader(doc, "Axes de développement");
  let y3 = MARGIN + 50;
  y3 = renderTopProcedures(
    doc,
    autoTable,
    "Procédures avec écarts ou points à revoir",
    summary.topAxes.map((p) => [
      String(p.nonConformeCount + p.aRevoirCount),
      p.title,
      `${p.domain} · ${p.aRevoirCount} à revoir · ${p.nonConformeCount} NC`,
    ]),
    [192, 21, 47],
    y3,
  );
  y3 = renderRecurring(doc, autoTable, summary, y3);
  y3 = renderCommentList(
    doc,
    autoTable,
    "Éléments observés à travailler",
    summary.attentionComments.slice(0, 5),
    [192, 21, 47],
    y3,
  );
  y3 = renderSilentMonths(doc, summary, y3);

  // Page 4 — Chronologie
  doc.addPage();
  renderSectionHeader(doc, "Chronologie");
  renderTimeline(doc, autoTable, summary, MARGIN + 50);

  // Pied de page sur toutes les pages.
  stampFooter(doc);

  return doc.output("blob");
}

// ── Rendus ──────────────────────────────────────────────────────────────────

function renderHeader(doc: Doc, summary: AgentDevelopmentSummary): void {
  const { agent, period } = summary;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Fiche de développement individuel", MARGIN, MARGIN + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const name = `${agent.lastName} ${agent.firstName}`.trim();
  doc.text(name, MARGIN, MARGIN + 32);

  doc.setFontSize(9);
  doc.setTextColor(110);
  const idLine = [
    agent.matricule,
    agent.teamName,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (idLine) doc.text(idLine, MARGIN, MARGIN + 48);

  const fromLabel = format(new Date(period.from), "PPP", { locale: fr });
  const toLabel = format(new Date(period.to), "PPP", { locale: fr });
  doc.text(
    `Période analysée : du ${fromLabel} au ${toLabel}`,
    MARGIN,
    MARGIN + 64,
  );
  doc.setTextColor(0);

  // Trait de séparation
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, MARGIN + 86, PAGE_W - MARGIN, MARGIN + 86);
}

function renderSectionHeader(doc: Doc, title: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, MARGIN, MARGIN + 18);
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, MARGIN + 30, PAGE_W - MARGIN, MARGIN + 30);
  doc.setFont("helvetica", "normal");
}

function renderLowSampleBox(doc: Doc, y: number): number {
  const h = 38;
  doc.setFillColor(255, 244, 224);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, y, USABLE_W, h, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text("Échantillon limité", MARGIN + 10, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const wrapped = doc.splitTextToSize(LOW_SAMPLE_TEXT, USABLE_W - 20);
  doc.text(wrapped, MARGIN + 10, y + 26);
  doc.setTextColor(0);
  return y + h + 14;
}

function renderKpis(
  doc: Doc,
  summary: AgentDevelopmentSummary,
  y: number,
): number {
  const { counts } = summary;
  const tiles: { label: string; value: number }[] = [
    { label: "Sessions de veille", value: counts.sessions },
    { label: "« Vu en poste »", value: counts.sightings },
    { label: "Actions validées", value: counts.validations },
    { label: "Procédures observées", value: counts.proceduresObserved },
  ];
  const gap = 10;
  const tileW = (USABLE_W - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 56;
  tiles.forEach((t, i) => {
    const x = MARGIN + i * (tileW + gap);
    doc.setFillColor(247, 247, 250);
    doc.setDrawColor(220);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, tileW, tileH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text(String(t.value), x + 10, y + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    const lines = doc.splitTextToSize(t.label, tileW - 20);
    doc.text(lines, x + 10, y + 44);
  });
  doc.setTextColor(0);
  return y + tileH + 18;
}

function renderMonthlyChart(
  doc: Doc,
  monthly: MonthlyObservationCount[],
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Évolution mensuelle des observations", MARGIN, y);
  doc.setFont("helvetica", "normal");

  const chartTop = y + 12;
  const chartH = 120;
  const chartBottom = chartTop + chartH;

  // Borne max pour normaliser la hauteur des barres.
  const maxStack = Math.max(
    1,
    ...monthly.map((m) => m.conforme + m.aRevoir + m.nonConforme),
  );
  const n = monthly.length;
  const gap = 4;
  const barW = (USABLE_W - gap * (n - 1)) / n;

  // Axe
  doc.setDrawColor(220);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, chartBottom, MARGIN + USABLE_W, chartBottom);

  monthly.forEach((m, i) => {
    const x = MARGIN + i * (barW + gap);
    const total = m.conforme + m.aRevoir + m.nonConforme;
    if (total === 0) return;

    const ratio = (v: number) => (v / maxStack) * chartH;
    const hConforme = ratio(m.conforme);
    const hARevoir = ratio(m.aRevoir);
    const hNonConforme = ratio(m.nonConforme);

    let stackY = chartBottom;
    // Conforme (vert) en bas.
    if (hConforme > 0) {
      stackY -= hConforme;
      doc.setFillColor(52, 168, 83);
      doc.rect(x, stackY, barW, hConforme, "F");
    }
    if (hARevoir > 0) {
      stackY -= hARevoir;
      doc.setFillColor(251, 188, 5);
      doc.rect(x, stackY, barW, hARevoir, "F");
    }
    if (hNonConforme > 0) {
      stackY -= hNonConforme;
      doc.setFillColor(217, 48, 37);
      doc.rect(x, stackY, barW, hNonConforme, "F");
    }
  });

  // Labels mois
  doc.setFontSize(6.5);
  doc.setTextColor(110);
  monthly.forEach((m, i) => {
    const x = MARGIN + i * (barW + gap) + barW / 2;
    const [yy, mm] = m.month.split("-");
    const label = format(new Date(Number(yy), Number(mm) - 1, 1), "MMM yy", {
      locale: fr,
    }).replace(".", "");
    doc.text(label, x, chartBottom + 10, { align: "center" });
  });
  doc.setTextColor(0);

  // Légende
  const legendY = chartBottom + 26;
  drawLegend(doc, MARGIN, legendY, [
    { color: [52, 168, 83], label: "Conforme" },
    { color: [251, 188, 5], label: "À revoir" },
    { color: [217, 48, 37], label: "Non conforme" },
  ]);

  return chartBottom + 50;
}

function drawLegend(
  doc: Doc,
  x: number,
  y: number,
  items: { color: [number, number, number]; label: string }[],
): void {
  doc.setFontSize(8);
  let cursorX = x;
  for (const it of items) {
    doc.setFillColor(it.color[0], it.color[1], it.color[2]);
    doc.rect(cursorX, y - 6, 8, 8, "F");
    doc.setTextColor(70);
    doc.text(it.label, cursorX + 12, y);
    const w = doc.getTextWidth(it.label) + 26;
    cursorX += w;
  }
  doc.setTextColor(0);
}

function renderTopProcedures(
  doc: Doc,
  autoTable: AutoTable,
  title: string,
  rows: string[][],
  accent: [number, number, number],
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, MARGIN, y);
  doc.setFont("helvetica", "normal");
  const startY = y + 8;
  if (rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Aucun élément sur la période.", MARGIN, startY + 12);
    doc.setTextColor(0);
    return startY + 28;
  }
  autoTable(doc, {
    startY,
    head: [
      [
        { content: "#", styles: { halign: "center" } },
        { content: "Procédure" },
        { content: "Contexte" },
      ],
    ],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [accent[0], accent[1], accent[2]],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      1: { cellWidth: USABLE_W * 0.4 },
      2: { cellWidth: USABLE_W * 0.5 },
    },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 18;
}

function renderDomainCoverage(
  doc: Doc,
  autoTable: AutoTable,
  summary: AgentDevelopmentSummary,
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Domaines couverts", MARGIN, y);
  doc.setFont("helvetica", "normal");
  const startY = y + 8;
  if (summary.byDomain.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Aucun domaine couvert sur la période.", MARGIN, startY + 12);
    doc.setTextColor(0);
    return startY + 28;
  }
  autoTable(doc, {
    startY,
    head: [
      [
        { content: "Domaine" },
        { content: "Observés", styles: { halign: "center" } },
        { content: "Conformes", styles: { halign: "center" } },
        { content: "À revoir", styles: { halign: "center" } },
        { content: "NC", styles: { halign: "center" } },
      ],
    ],
    body: summary.byDomain.map((d) => [
      d.domain,
      String(d.total),
      String(d.conforme),
      String(d.aRevoir),
      String(d.nonConforme),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [70, 90, 130],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: USABLE_W * 0.4 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 18;
}

function renderCommentList(
  doc: Doc,
  autoTable: AutoTable,
  title: string,
  comments: AgentDevelopmentSummary["positiveComments"],
  accent: [number, number, number],
  y: number,
): number {
  if (comments.length === 0) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, MARGIN, y);
  doc.setFont("helvetica", "normal");
  const startY = y + 8;
  autoTable(doc, {
    startY,
    head: [
      [
        { content: "Date", styles: { halign: "center" } },
        { content: "Procédure" },
        { content: "Commentaire" },
      ],
    ],
    body: comments.map((c) => [
      format(new Date(c.recordedAt), "dd/MM/yyyy"),
      c.procedureTitle,
      `« ${c.comment} »`,
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
      valign: "top",
    },
    headStyles: {
      fillColor: [accent[0], accent[1], accent[2]],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 60, halign: "center" },
      1: { cellWidth: USABLE_W * 0.32 },
      2: { cellWidth: USABLE_W - 60 - USABLE_W * 0.32, fontStyle: "italic" },
    },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 18;
}

function renderRecurring(
  doc: Doc,
  autoTable: AutoTable,
  summary: AgentDevelopmentSummary,
  y: number,
): number {
  if (summary.recurringNCs.length === 0) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Points d'attention récurrents", MARGIN, y);
  doc.setFont("helvetica", "normal");
  const startY = y + 8;
  autoTable(doc, {
    startY,
    head: [
      [
        { content: "Occ.", styles: { halign: "center" } },
        { content: "Point de checklist" },
        { content: "Procédure" },
        { content: "Dernier", styles: { halign: "center" } },
      ],
    ],
    body: summary.recurringNCs.map((r) => [
      String(r.occurrences),
      r.itemLabel,
      r.procedureTitle,
      format(new Date(r.lastSeenAt), "dd/MM/yyyy"),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [192, 21, 47],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 40, halign: "center", fontStyle: "bold" },
      1: { cellWidth: USABLE_W * 0.35 },
      2: { cellWidth: USABLE_W * 0.35 },
      3: { cellWidth: 70, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 18;
}

function renderSilentMonths(
  doc: Doc,
  summary: AgentDevelopmentSummary,
  y: number,
): number {
  if (summary.silentMonths.length === 0) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Mois sans observation ni passage", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const labels = summary.silentMonths
    .map((m) => {
      const [yy, mm] = m.split("-");
      return format(new Date(Number(yy), Number(mm) - 1, 1), "MMM yy", {
        locale: fr,
      });
    })
    .join("  ·  ");
  const wrapped = doc.splitTextToSize(labels, USABLE_W);
  doc.text(wrapped, MARGIN, y + 14);
  doc.setTextColor(0);
  return y + 14 + wrapped.length * 12 + 8;
}

function renderTimeline(
  doc: Doc,
  autoTable: AutoTable,
  summary: AgentDevelopmentSummary,
  y: number,
): void {
  if (summary.timeline.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Aucune activité enregistrée sur la période.", MARGIN, y + 12);
    doc.setTextColor(0);
    return;
  }
  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: "Date", styles: { halign: "center" } },
        { content: "Type", styles: { halign: "center" } },
        { content: "Libellé" },
        { content: "Détail" },
      ],
    ],
    body: summary.timeline.map((t) => [
      format(new Date(t.at), "dd/MM/yyyy"),
      t.type,
      t.title,
      t.detail ?? "",
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
      valign: "top",
    },
    headStyles: {
      fillColor: [70, 90, 130],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 60, halign: "center" },
      1: {
        cellWidth: 60,
        halign: "center",
        fontStyle: "bold",
        textColor: [70, 90, 130],
      },
      2: { cellWidth: USABLE_W * 0.32 },
      3: { cellWidth: USABLE_W - 60 - 60 - USABLE_W * 0.32 },
    },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
}

function stampFooter(doc: Doc): void {
  const total = doc.getNumberOfPages();
  const wrapped = doc.splitTextToSize(FOOTER_TEXT, USABLE_W - 60);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, PAGE_H - 50, PAGE_W - MARGIN, PAGE_H - 50);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(wrapped, MARGIN, PAGE_H - 38);
    doc.setFont("helvetica", "normal");
    doc.text(`${i} / ${total}`, PAGE_W - MARGIN, PAGE_H - 20, {
      align: "right",
    });
  }
  doc.setTextColor(0);
}
