"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import { pdfFilename } from "@/lib/pdfFilename";

type Item = { id: string; label: string };
type Section = {
  id: string;
  title: string;
  icon: string | null;
  evalMode: "PER_ITEM" | "PER_SECTION";
  category: string | null;
  precisions: string | null;
  items: Item[];
};
type Observation = {
  sectionId: string;
  itemId: string | null;
  status: string;
  comment: string | null;
};
type NC = {
  description: string;
  riskIdentified: string | null;
  evrpCotation: string | null;
  proposedMeasures: string | null;
  responsible: string | null;
  plannedDate: string | null;
  redressedDate: string | null;
  closedDate: string | null;
};
type Visit = {
  id: string;
  visitDate: string;
  generalComment: string | null;
  template: {
    slug: string;
    name: string;
    pdfLayout: string;
    kind: string;
    sections: Section[];
  };
  site: {
    name: string;
    code: string | null;
    type: string | null;
    address: string | null;
    hasGreasingArea: boolean;
  };
  observer: { name: string };
  participants: { fullName: string; function: string | null }[];
  observations: Observation[];
  nonConformities: NC[];
};

type Equipment = {
  id: string;
  label: string;
  category: string;
  expectedQuantity: number | null;
  isPerishable: boolean;
  expirationDate: string | null;
};

// Libellé de la colonne Date selon la catégorie d'équipement.
// Extincteur → échéance de prochaine visite (toujours pré-renseignée).
// Reste → date de péremption (à remplir au stylo ou laissée vide).
function dateColumnLabel(category: string): string {
  if (/extincteur/i.test(category)) return "Échéance prochaine visite";
  return "Date de péremption";
}

/**
 * Mappe une catégorie de section à son numéro de chapitre SNCF.
 * "Poste de travail" → "1", "Incendie"/"Électrique" → "2", etc.
 * Les sections de même chapitre sont regroupées sous un seul bandeau.
 */
const CHAPTER_BY_CATEGORY: Record<string, { num: number; title: string }> = {
  "Poste de travail": { num: 1, title: "Poste de travail" },
  Incendie: { num: 2, title: "Locaux - Incendie / Électrique" },
  Électrique: { num: 2, title: "Locaux - Incendie / Électrique" },
  Prévention: { num: 2, title: "Locaux - Prévention" },
  Coactivité: { num: 2, title: "Locaux - Coactivité" },
  Hygiène: { num: 2, title: "Locaux - Hygiène" },
  Graissage: { num: 3, title: "Locaux de graissage" },
  Véhicules: { num: 4, title: "Véhicules de service" },
  EPI: { num: 5, title: "EPI" },
  Environnement: { num: 6, title: "Environnement" },
};

const STATUS_LABEL: Record<string, string> = {
  OUI: "Oui",
  NON: "Non",
  CONFORME: "Conforme",
  NON_CONFORME: "Non conforme",
  SANS_OBJET: "Sans objet",
  PENDING: "—",
};

export default function VisitReportClient({
  visit,
  equipments = [],
}: {
  visit: Visit;
  equipments?: Equipment[];
}) {
  const [layout, setLayout] = useState<"VEILLE" | "SNCF">(
    (visit.template.pdfLayout as "VEILLE" | "SNCF") ?? "VEILLE"
  );
  const [generating, setGenerating] = useState(false);
  const isInventory = visit.template.kind === "INVENTORY";

  function findObs(sectionId: string, itemId: string | null) {
    return visit.observations.find(
      (o) =>
        o.sectionId === sectionId && (o.itemId ?? null) === (itemId ?? null)
    );
  }

  async function generatePDF() {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();
      const margin = 40;
      const usableW = PAGE_W - margin * 2;

      if (isInventory) {
        renderInventory(doc, autoTable, visit, equipments, margin, usableW, PAGE_H);
      } else if (layout === "SNCF" && visit.template.slug === "trimestrielle-incendie") {
        renderTrimestrielle(doc, autoTable, visit, findObs, margin, usableW, PAGE_H);
      } else if (
        layout === "SNCF" &&
        visit.template.slug === "planifiee-eic-ra"
      ) {
        renderPlanifiee(doc, autoTable, visit, findObs, margin, usableW, PAGE_H);
      } else {
        renderVeille(doc, autoTable, visit, findObs, margin, usableW, PAGE_H);
      }

      doc.save(
        pdfFilename({
          type: visit.template.name,
          subject: visit.site.name,
          date: visit.visitDate,
          suffix: layout,
        })
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto pb-32">
      <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
        Compte rendu — {visit.site.name}
      </h1>
      <div className="text-xs text-slate-500 mt-1">
        {visit.template.name} ·{" "}
        {format(new Date(visit.visitDate), "PPPP", { locale: fr })}
      </div>

      <div className="card mt-4 p-4 flex flex-wrap items-center gap-3">
        {!isInventory && (
          <>
            <span className="text-xs font-medium text-slate-600">
              Layout PDF :
            </span>
            <div className="flex gap-1">
              {(["VEILLE", "SNCF"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-md border ${
                    layout === l
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {l === "VEILLE" ? "Design Veille" : "Fidèle (original)"}
                </button>
              ))}
            </div>
          </>
        )}
        {isInventory && (
          <span className="text-xs font-medium text-slate-600">
            Fiche de suivi papier — composition théorique uniquement, date
            à remplir au stylo.
          </span>
        )}
        <button
          onClick={generatePDF}
          disabled={generating}
          className="btn btn-primary ml-auto"
        >
          <Icon.Download className="w-4 h-4" />
          {generating ? "Génération…" : "Télécharger le PDF"}
        </button>
      </div>

      {/* Aperçu compact mode INVENTORY : catalogue groupé par catégorie */}
      {isInventory && (
        <div className="grid gap-4 md:grid-cols-2 mt-6 items-start">
          {[...new Set(equipments.map((e) => e.category))].sort().map((cat) => {
            const eqs = equipments.filter((e) => e.category === cat);
            return (
              <section key={cat} className="card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-bold">{cat}</div>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">
                    {eqs.length} élément(s)
                  </span>
                </div>
                <ul className="text-xs space-y-0.5">
                  {eqs.map((e) => (
                    <li key={e.id} className="flex gap-2 items-center">
                      <span className="font-mono text-slate-400 w-10 text-right shrink-0">
                        {e.expectedQuantity ?? "—"}
                      </span>
                      <span className="flex-1">{e.label}</span>
                      {e.expirationDate ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                          {format(new Date(e.expirationDate), "dd/MM/yyyy")}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            e.isPerishable
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-900 text-slate-100"
                          }`}
                        >
                          {e.isPerishable ? "Périssable" : "Non périssable"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Aperçu CHECKLIST : sections + items historiques */}
      {!isInventory && (
      <div className="grid gap-4 md:grid-cols-2 mt-6 items-start">
        {visit.template.sections.map((s) => {
          const obs = s.items.map((it) => findObs(s.id, it.id)).filter(Boolean);
          const globalObs = findObs(s.id, null);
          const koCount =
            s.evalMode === "PER_ITEM"
              ? obs.filter((o) => o?.status === "NON").length
              : globalObs?.status === "NON_CONFORME"
              ? 1
              : 0;
          return (
            <section key={s.id} className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                {s.icon && <span>{s.icon}</span>}
                <div className="text-sm font-bold">{s.title}</div>
                {koCount > 0 && (
                  <span className="ml-auto text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200 rounded px-1.5 py-0.5">
                    {koCount} NC
                  </span>
                )}
              </div>
              {s.evalMode === "PER_SECTION" ? (
                <div className="text-xs text-slate-600">
                  Statut :{" "}
                  <b>
                    {globalObs?.status
                      ? STATUS_LABEL[globalObs.status] ?? globalObs.status
                      : "—"}
                  </b>
                  {globalObs?.comment && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      « {globalObs.comment} »
                    </div>
                  )}
                </div>
              ) : (
                <ul className="text-xs space-y-0.5">
                  {s.items.map((it) => {
                    const o = findObs(s.id, it.id);
                    return (
                      <li key={it.id} className="flex gap-2">
                        <span
                          className={`text-[10px] font-mono w-12 text-center px-1 rounded ${
                            o?.status === "NON"
                              ? "bg-rose-100 text-rose-700"
                              : o?.status === "OUI"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {o?.status
                            ? STATUS_LABEL[o.status] ?? o.status
                            : "?"}
                        </span>
                        <span className="flex-1">{it.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}

      {!isInventory && visit.nonConformities.length > 0 && (
        <section className="card mt-6 p-4">
          <h2 className="text-sm font-bold mb-2">
            {visit.nonConformities.length} non-conformité(s)
          </h2>
          <ul className="space-y-1.5">
            {visit.nonConformities.map((nc, i) => (
              <li key={i} className="text-xs border-l-2 border-rose-500 pl-2">
                <b>{nc.description}</b>
                {nc.proposedMeasures && (
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    → {nc.proposedMeasures}
                  </div>
                )}
                {nc.responsible && (
                  <div className="text-[10px] text-slate-500">
                    Responsable : {nc.responsible}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ============================================================================
 *  PDF — Layout VEILLE (design Veille moderne)
 * ========================================================================== */

type AutoTable = (
  doc: import("jspdf").jsPDF,
  opts: Record<string, unknown>
) => void;
type FindObs = (
  sectionId: string,
  itemId: string | null
) => Observation | undefined;

function renderVeille(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTable,
  visit: Visit,
  findObs: FindObs,
  margin: number,
  usableW: number,
  pageH: number
) {
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(visit.template.name, margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Site : ${visit.site.name}${visit.site.code ? ` (${visit.site.code})` : ""}`,
    margin,
    y
  );
  y += 13;
  doc.text(
    `Date : ${format(new Date(visit.visitDate), "PPP", { locale: fr })}`,
    margin,
    y
  );
  y += 13;
  doc.text(`Observateur : ${visit.observer.name}`, margin, y);
  y += 18;

  // Une seule grande table compacte par section.
  for (const s of visit.template.sections) {
    if (y > pageH - 120) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${s.icon ?? ""} ${s.title}`.trim(), margin, y);
    y += 12;
    if (s.evalMode === "PER_ITEM") {
      autoTable(doc, {
        startY: y,
        head: [["Point", "Statut", "Observations"]],
        body: s.items.map((it) => {
          const o = findObs(s.id, it.id);
          return [
            it.label,
            o?.status ? STATUS_LABEL[o.status] ?? o.status : "—",
            o?.comment ?? "",
          ];
        }),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [46, 84, 150] },
        columnStyles: {
          0: { cellWidth: usableW * 0.45 },
          1: { cellWidth: 60, halign: "center" },
        },
        margin: { left: margin, right: margin },
      });
    } else {
      const obs = findObs(s.id, null);
      const checks = s.items.map((it) => {
        const o = findObs(s.id, it.id);
        const mark =
          o?.status === "OUI"
            ? "[X]"
            : o?.status === "NON"
            ? "[/]"
            : o?.status === "SANS_OBJET"
            ? "[-]"
            : "[  ]";
        return `${mark} ${it.label}`;
      });
      autoTable(doc, {
        startY: y,
        head: [["Checkpoints", "Statut global", "Observations"]],
        body: [
          [
            checks.join("\n"),
            obs?.status ? STATUS_LABEL[obs.status] ?? obs.status : "—",
            obs?.comment ?? "",
          ],
        ],
        styles: { fontSize: 8, cellPadding: 4, valign: "top" },
        headStyles: { fillColor: [25, 150, 165] },
        columnStyles: {
          0: { cellWidth: usableW * 0.45 },
          1: { cellWidth: 80, halign: "center" },
        },
        margin: { left: margin, right: margin },
      });
    }
    // @ts-expect-error lastAutoTable
    y = doc.lastAutoTable.finalY + 14;
  }

  renderNCRecap(doc, autoTable, visit, margin, usableW, pageH, y);
}

/* ============================================================================
 *  PDF — Visite trimestrielle incendie (mise en page fidèle au document)
 * ========================================================================== */

function renderTrimestrielle(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTable,
  visit: Visit,
  findObs: FindObs,
  margin: number,
  usableW: number,
  pageH: number
) {
  let y = margin;

  // Tableau d'en-tête : ligne titre + grille de métadonnées 2 colonnes.
  autoTable(doc, {
    startY: y,
    body: [
      [
        {
          content: "RAPPORT DE VISITE TRIMESTRIELLE INCENDIE",
          colSpan: 4,
          styles: {
            halign: "center",
            fontStyle: "bold",
            fillColor: [220, 230, 240],
            fontSize: 11,
          },
        },
      ],
      [
        { content: "Nom RSI / RSID", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
        { content: "Nom COSI", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
      ],
      [
        { content: "Nom CLSI", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
        { content: "Bâtiment", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        visit.site.name,
      ],
      [
        { content: "N° UT", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
        { content: "Étage / couloir / aile", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
      ],
      [
        { content: "Visite effectuée par", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        visit.observer.name,
        { content: "Date de la visite", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        format(new Date(visit.visitDate), "P", { locale: fr }),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 4, lineColor: [180, 180, 180], lineWidth: 0.4 },
    columnStyles: {
      0: { cellWidth: usableW * 0.22 },
      1: { cellWidth: usableW * 0.28 },
      2: { cellWidth: usableW * 0.22 },
      3: { cellWidth: usableW * 0.28 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 4;

  // Bande "POINTS À VÉRIFIER"
  autoTable(doc, {
    startY: y,
    body: [
      [
        {
          content: "POINTS À VÉRIFIER",
          colSpan: 1,
          styles: {
            halign: "center",
            fontStyle: "bold",
            fillColor: [180, 200, 220],
            fontSize: 10,
          },
        },
      ],
    ],
    styles: { cellPadding: 4 },
    columnStyles: { 0: { cellWidth: usableW } },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 8;

  // Pour chaque section : titre puis tableau Point/Oui/Non/SO/Observations.
  for (const s of visit.template.sections) {
    if (y > pageH - 100) {
      doc.addPage();
      y = margin;
    }
    autoTable(doc, {
      startY: y,
      head: [
        [
          {
            content: s.title,
            colSpan: 5,
            styles: {
              halign: "center",
              fontStyle: "bold",
              fillColor: [210, 220, 230],
            },
          },
        ],
        ["Point à vérifier", "Oui", "Non", "Sans objet", "Observations"],
      ],
      body: s.items.map((it) => {
        const o = findObs(s.id, it.id);
        return [
          it.label,
          o?.status === "OUI" ? "X" : "",
          o?.status === "NON" ? "X" : "",
          o?.status === "SANS_OBJET" ? "X" : "",
          o?.comment ?? "",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3, lineColor: [180, 180, 180], lineWidth: 0.4 },
      headStyles: { fillColor: [230, 235, 240], textColor: 0, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: usableW * 0.43 },
        1: { cellWidth: usableW * 0.07, halign: "center" },
        2: { cellWidth: usableW * 0.07, halign: "center" },
        3: { cellWidth: usableW * 0.1, halign: "center" },
        4: { cellWidth: usableW * 0.33 },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 6;
  }

  // Tableau ACTIONS CORRECTIVES — 8 lignes minimum, complété par les NC saisies.
  if (y > pageH - 200) {
    doc.addPage();
    y = margin;
  }
  const ncRows = visit.nonConformities.map((nc, i) => [
    String(i + 1),
    nc.description,
    nc.responsible ?? "",
    nc.plannedDate
      ? format(new Date(nc.plannedDate), "P", { locale: fr })
      : "",
    nc.redressedDate
      ? format(new Date(nc.redressedDate), "P", { locale: fr })
      : "",
  ]);
  while (ncRows.length < 8) {
    ncRows.push([String(ncRows.length + 1), "", "", "", ""]);
  }
  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: "ACTIONS CORRECTIVES",
          colSpan: 5,
          styles: {
            halign: "left",
            fontStyle: "bold",
            fillColor: [200, 60, 60],
            textColor: 255,
          },
        },
      ],
      ["N°", "Nature", "Pilote", "Prévue", "Réalisée"],
    ],
    body: ncRows,
    styles: { fontSize: 8, cellPadding: 4, lineColor: [180, 180, 180], lineWidth: 0.4 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      1: { cellWidth: usableW * 0.5 },
      2: { cellWidth: usableW * 0.18 },
      3: { cellWidth: usableW * 0.12, halign: "center" },
      4: { cellWidth: usableW * 0.12, halign: "center" },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  // Pied de page interne
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Document interne — généré par l'application Veille",
    margin,
    pageH - 20
  );
}

/* ============================================================================
 *  PDF — Visite planifiée (mise en page fidèle au document EIC)
 * ========================================================================== */

function renderPlanifiee(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTable,
  visit: Visit,
  findObs: FindObs,
  margin: number,
  usableW: number,
  pageH: number
) {
  let y = margin;

  // En-tête : EIC Rhône-Alpes Lyon + UO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EIC Rhône-Alpes Lyon", margin, y);
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text("UO", margin, y);
  y += 28;

  // Cadre teal "Visite Planifiée"
  const tealR = 25,
    tealG = 150,
    tealB = 165;
  const bannerW = 240;
  const bannerH = 28;
  const bannerX = margin + (usableW - bannerW) / 2;
  doc.setFillColor(tealR, tealG, tealB);
  doc.rect(bannerX, y, bannerW, bannerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255);
  doc.text("Visite Planifiée", bannerX + bannerW / 2, y + 19, {
    align: "center",
  });
  doc.setTextColor(0);
  y += bannerH + 18;

  // Table Date / Lieu
  autoTable(doc, {
    startY: y,
    body: [
      [
        {
          content: `Date : ${format(new Date(visit.visitDate), "dd/MM/yyyy", {
            locale: fr,
          })}`,
          styles: { fontStyle: "bold" },
        },
      ],
      [
        {
          content: `Lieu (Secteur/chantier) : ${visit.site.name}`,
          styles: { fontStyle: "bold" },
        },
      ],
    ],
    styles: { fontSize: 10, cellPadding: 6, lineColor: [120, 120, 120], lineWidth: 0.5 },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 10;

  // Table Participants : 4 colonnes, lignes Prénom Nom / Fonction / Signature
  const slots = Array.from({ length: 4 }).map(
    (_, i) => visit.participants[i] ?? null
  );
  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: "Participants",
          colSpan: 5,
          styles: { fillColor: [tealR, tealG, tealB], textColor: 255, fontStyle: "bold" },
        },
      ],
    ],
    body: [
      [
        { content: "Prénom Nom", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        ...slots.map((p) => p?.fullName ?? ""),
      ],
      [
        { content: "Fonction", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        ...slots.map((p) => p?.function ?? ""),
      ],
      [
        { content: "Signature", styles: { fillColor: [240, 244, 248], fontStyle: "bold" } },
        "",
        "",
        "",
        "",
      ],
    ],
    styles: { fontSize: 9, cellPadding: 6, lineColor: [120, 120, 120], lineWidth: 0.5, minCellHeight: 32 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: (usableW - 100) / 4 },
      2: { cellWidth: (usableW - 100) / 4 },
      3: { cellWidth: (usableW - 100) / 4 },
      4: { cellWidth: (usableW - 100) / 4 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 14;

  // Distribution du Compte rendu + Traçabilité (2 mini-tables côte à côte).
  // Cases vides à cocher manuellement après impression : on dessine de vrais
  // rectangles via didDrawCell pour avoir un rendu net (le glyphe ☐ n'existe
  // pas dans Helvetica et est remplacé par un caractère de fallback).
  const halfW = (usableW - 14) / 2;
  const drawCheckbox = (data: {
    section: "head" | "body" | "foot";
    cell: { x: number; y: number; height: number };
    column: { index: number };
  }) => {
    // Ne dessine la case QUE dans le corps du tableau (pas dans la bande
    // d'en-tête colorée "Distribution du Compte rendu" / "Traçabilité",
    // sinon on superpose une boîte au-dessus du titre — d'où l'effet bizarre.
    if (data.section !== "body") return;
    if (data.column.index !== 0) return;
    const box = 8;
    const cx = data.cell.x + 6;
    const cy = data.cell.y + (data.cell.height - box) / 2;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.6);
    doc.rect(cx, cy, box, box);
  };

  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: "Distribution du Compte rendu",
          colSpan: 2,
          styles: {
            fillColor: [tealR, tealG, tealB],
            textColor: 255,
            fontStyle: "bold",
          },
        },
      ],
    ],
    body: [["", "DUO"], ["", "COSEC"], ["", "Autres"]],
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: halfW - 22 },
    },
    margin: { left: margin },
    tableWidth: halfW,
    theme: "grid",
    didDrawCell: drawCheckbox,
  });
  // @ts-expect-error
  const yLeftEnd = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head: [
      [
        {
          content: "Traçabilité",
          colSpan: 2,
          styles: {
            fillColor: [tealR, tealG, tealB],
            textColor: 255,
            fontStyle: "bold",
          },
        },
      ],
    ],
    body: [
      ["", "Saisie ICARE / Veille de Site"],
      ["", "Alimentation des EVRp"],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: halfW - 22 },
    },
    margin: { left: margin + halfW + 14 },
    tableWidth: halfW,
    theme: "grid",
    didDrawCell: drawCheckbox,
  });
  // @ts-expect-error
  const yRightEnd = doc.lastAutoTable.finalY;
  y = Math.max(yLeftEnd, yRightEnd) + 20;

  // Nouvelle page pour le détail
  doc.addPage();
  y = margin;

  // Filtre les sections "Graissage" si le site n'a pas de local de graissage.
  const filteredSections = visit.template.sections.filter((s) => {
    if (s.category === "Graissage" && !visit.site.hasGreasingArea) return false;
    return true;
  });

  // Sections : pour chaque section, table 5 colonnes :
  // [Catégorie | Checkpoints | Statut (3 cases) | Précisions | Observations]
  let currentChapter = -1;
  for (const s of filteredSections) {
    if (y > pageH - 120) {
      doc.addPage();
      y = margin;
    }

    // Bandeau de chapitre quand la catégorie change de numéro de chapitre.
    const chap = s.category ? CHAPTER_BY_CATEGORY[s.category] : undefined;
    if (chap && chap.num !== currentChapter) {
      autoTable(doc, {
        startY: y,
        body: [
          [
            {
              content: `${chap.num} - ${chap.title}`,
              styles: {
                fillColor: [180, 200, 220],
                textColor: [10, 30, 60],
                fontStyle: "bold",
                halign: "left",
                fontSize: 11,
              },
            },
          ],
        ],
        styles: { cellPadding: 5 },
        columnStyles: { 0: { cellWidth: usableW } },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      // @ts-expect-error
      y = doc.lastAutoTable.finalY + 4;
      currentChapter = chap.num;
    }

    const obs = findObs(s.id, null);
    const STATUS_KEYS = ["CONFORME", "NON_CONFORME", "SANS_OBJET"] as const;
    const items = s.items;

    // 6 colonnes : Catégorie | Case item | Label item | Statut (3 cases) | Précisions | Observations.
    // Les colonnes 0, 3, 4, 5 sont rowSpan = nb d'items, ne sont déclarées
    // qu'à la première row, et reproduisent les blocs monolithiques du PDF
    // SNCF d'origine. Les colonnes 1 et 2 sont par item — une row = un item,
    // ce qui permet à `didDrawCell` de dessiner exactement une case par ligne
    // (résout le problème de wrapping de la concaténation multiline).
    const body = items.map((it, i) => {
      const row: object[] = [];
      if (i === 0) {
        row.push({
          content: s.category ?? "",
          rowSpan: items.length,
          styles: {
            fontStyle: "italic",
            fillColor: [248, 248, 248],
            valign: "top",
          },
        });
      }
      row.push({ content: "", styles: { cellPadding: 0 } });
      row.push({ content: it.label, styles: { valign: "middle" } });
      if (i === 0) {
        row.push({
          content: ["Conforme", "Non conforme", "Sans objet"].join("\n"),
          rowSpan: items.length,
          styles: {
            valign: "top",
            halign: "left",
            fontStyle: "bold",
            cellPadding: { top: 4, right: 4, bottom: 4, left: 14 },
            fillColor:
              obs?.status === "CONFORME"
                ? [232, 248, 232]
                : obs?.status === "NON_CONFORME"
                ? [252, 232, 232]
                : obs?.status === "SANS_OBJET"
                ? [240, 240, 240]
                : [255, 255, 255],
          },
        });
        row.push({
          content: s.precisions ?? "",
          rowSpan: items.length,
          styles: {
            valign: "top",
            fontStyle: "italic",
            textColor: [80, 80, 80],
          },
        });
        row.push({
          content: obs?.comment ?? "",
          rowSpan: items.length,
          styles: { valign: "top" },
        });
      }
      return row;
    });

    autoTable(doc, {
      startY: y,
      head: [
        [
          {
            content: s.title,
            colSpan: 6,
            styles: {
              fillColor: [235, 235, 235],
              textColor: [30, 30, 30],
              fontStyle: "bold",
              halign: "left",
            },
          },
        ],
      ],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: [120, 120, 120],
        lineWidth: 0.4,
      },
      columnStyles: {
        0: { cellWidth: usableW * 0.12 },
        1: { cellWidth: usableW * 0.03 },
        2: { cellWidth: usableW * 0.33 },
        3: { cellWidth: usableW * 0.16 },
        4: { cellWidth: usableW * 0.18 },
        5: { cellWidth: usableW * 0.18 },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
      didDrawCell: (data: {
        section: "head" | "body" | "foot";
        cell: { x: number; y: number; width: number; height: number };
        column: { index: number };
        row: { index: number };
      }) => {
        if (data.section !== "body") return;

        // Colonne 1 : case par item, centrée dans la cellule.
        if (data.column.index === 1) {
          const it = items[data.row.index];
          const o = it ? findObs(s.id, it.id) : undefined;
          const box = 6.5;
          const cx = data.cell.x + (data.cell.width - box) / 2;
          const cy = data.cell.y + (data.cell.height - box) / 2;
          doc.setDrawColor(60, 60, 60);
          doc.setLineWidth(0.5);
          doc.rect(cx, cy, box, box);
          if (o?.status === "OUI") {
            // Croix : item conforme.
            doc.setLineWidth(0.9);
            doc.line(cx + 1.4, cy + 1.4, cx + box - 1.4, cy + box - 1.4);
            doc.line(cx + 1.4, cy + box - 1.4, cx + box - 1.4, cy + 1.4);
          } else if (o?.status === "NON") {
            // Barre oblique : item non conforme.
            doc.setLineWidth(0.9);
            doc.line(cx + 0.6, cy + box - 0.6, cx + box - 0.6, cy + 0.6);
          } else if (o?.status === "SANS_OBJET") {
            // Trait horizontal : sans objet.
            doc.setLineWidth(0.9);
            doc.line(cx + 1.4, cy + box / 2, cx + box - 1.4, cy + box / 2);
          }
          return;
        }

        // Colonne 3 : 3 cases de statut global (rowSpan = items.length).
        if (data.column.index === 3) {
          const box = 6.5;
          const lineH = 9.2;
          const topPad = 4;
          for (let i = 0; i < 3; i++) {
            const cx = data.cell.x + 4;
            const cy =
              data.cell.y + topPad + i * lineH + (lineH - box) / 2 - 1;
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.5);
            doc.rect(cx, cy, box, box);
            if (obs?.status === STATUS_KEYS[i]) {
              doc.setLineWidth(0.9);
              doc.line(cx + 1.4, cy + 1.4, cx + box - 1.4, cy + box - 1.4);
              doc.line(cx + 1.4, cy + box - 1.4, cx + box - 1.4, cy + 1.4);
            }
          }
        }
      },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 8;
  }

  // Récap NC sur nouvelle page (table 8 colonnes comme dans le doc d'origine).
  doc.addPage();
  let yNC = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    "Récapitulatif des non-conformités relevées / mesures de redressement et suivi",
    margin,
    yNC
  );
  yNC += 16;
  const ncBody = visit.nonConformities.map((nc) => [
    nc.description,
    nc.riskIdentified ?? "",
    nc.evrpCotation ?? "",
    nc.proposedMeasures ?? "",
    nc.responsible ?? "",
    nc.plannedDate
      ? format(new Date(nc.plannedDate), "P", { locale: fr })
      : "",
    nc.redressedDate
      ? format(new Date(nc.redressedDate), "P", { locale: fr })
      : "",
    nc.closedDate
      ? format(new Date(nc.closedDate), "P", { locale: fr })
      : "",
  ]);
  // Compléter à 10 lignes minimum.
  while (ncBody.length < 10) {
    ncBody.push(["", "", "", "", "", "", "", ""]);
  }
  autoTable(doc, {
    startY: yNC,
    head: [
      [
        "Non-conformité",
        "Risque identifié",
        "Cotation nouvelle EVRp",
        "Mesures proposées",
        "Responsable",
        "Date prévue",
        "Date redressement",
        "Clôture",
      ],
    ],
    body: ncBody,
    styles: { fontSize: 7, cellPadding: 3, lineColor: [150, 150, 150], lineWidth: 0.4, minCellHeight: 24 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  // Pied de page "Interne SNCF Réseau" sur chaque page (comme l'original SNCF).
  stampSncfFooter(doc, pageH, margin);
}

/**
 * Imprime sur chaque page le pied "Interne SNCF Réseau" — identique à
 * l'original. Doit être appelé en toute fin de rendu, une fois que toutes
 * les pages ont été ajoutées.
 */
function stampSncfFooter(
  doc: import("jspdf").jsPDF,
  pageH: number,
  margin: number
) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("Interne SNCF Réseau", margin, pageH - 14);
    doc.text(`${i} / ${total}`, doc.internal.pageSize.getWidth() - margin, pageH - 14, {
      align: "right",
    });
  }
  doc.setTextColor(0);
}

/* ============================================================================
 *  Récap NC commun au layout VEILLE
 * ========================================================================== */

function renderNCRecap(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTable,
  visit: Visit,
  margin: number,
  usableW: number,
  pageH: number,
  y: number
) {
  if (visit.nonConformities.length === 0) return;
  if (y > pageH - 180) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Non-conformités", margin, y);
  y += 14;
  autoTable(doc, {
    startY: y,
    head: [
      [
        "Description",
        "Risque",
        "EVRp",
        "Mesures",
        "Responsable",
        "Prévue",
        "Redressée",
      ],
    ],
    body: visit.nonConformities.map((nc) => [
      nc.description,
      nc.riskIdentified ?? "",
      nc.evrpCotation ?? "",
      nc.proposedMeasures ?? "",
      nc.responsible ?? "",
      nc.plannedDate
        ? format(new Date(nc.plannedDate), "P", { locale: fr })
        : "",
      nc.redressedDate
        ? format(new Date(nc.redressedDate), "P", { locale: fr })
        : "",
    ]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [192, 21, 47] },
    margin: { left: margin, right: margin },
  });
}

/* ============================================================================
 *  PDF — Veille de site (INVENTORY) : fiche de suivi papier
 *
 *  Volontairement austère : composition théorique + colonne Date manuelle.
 *  Ne montre NI les écarts, NI les commentaires, NI les NC. Le PDF est
 *  imprimé puis annoté au stylo lors des contrôles suivants.
 *
 *  - Périssable     : colonne Date vide (à remplir au stylo)
 *  - Non périssable : colonne Date barrée en diagonale
 * ========================================================================== */

function renderInventory(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTable,
  visit: Visit,
  equipments: Equipment[],
  margin: number,
  usableW: number,
  pageH: number
) {
  // En-tête
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(visit.template.name, margin, margin + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Site : ${visit.site.name}${
      visit.site.code ? ` (${visit.site.code})` : ""
    }`,
    margin,
    margin + 22
  );
  doc.text(
    `Date de dernière vérification : ${format(new Date(visit.visitDate), "PPP", { locale: fr })}`,
    margin,
    margin + 36
  );
  doc.text(`Vérifié par : ${visit.observer.name}`, margin, margin + 50);

  let y = margin + 70;

  // Groupage par catégorie + tri stable (la liste arrive déjà triée).
  const byCat = new Map<string, Equipment[]>();
  for (const e of equipments) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e);
    byCat.set(e.category, arr);
  }
  const cats = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));

  for (const [cat, eqs] of cats) {
    if (y > pageH - 100) {
      doc.addPage();
      y = margin;
    }
    autoTable(doc, {
      startY: y,
      head: [
        [
          {
            content: cat,
            colSpan: 3,
            styles: {
              fillColor: [235, 235, 235],
              textColor: [30, 30, 30],
              fontStyle: "bold",
              halign: "left",
            },
          },
        ],
        [
          {
            content: "Désignation",
            styles: { fontStyle: "bold" },
          },
          { content: "Qté", styles: { fontStyle: "bold", halign: "center" } },
          {
            content: dateColumnLabel(cat),
            styles: { fontStyle: "bold", halign: "center" },
          },
        ],
      ],
      body: eqs.map((e) => [
        e.label,
        e.expectedQuantity != null ? String(e.expectedQuantity) : "",
        // 3 cas :
        //   - date renseignée au catalogue (ex. échéance prochaine visite
        //     d'extincteur) → affichée telle quelle ;
        //   - périssable sans date → cellule vide (à remplir au stylo) ;
        //   - non périssable sans date → noircie par didDrawCell.
        e.expirationDate
          ? format(new Date(e.expirationDate), "dd/MM/yyyy")
          : "",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
        lineColor: [120, 120, 120],
        lineWidth: 0.4,
        valign: "middle",
        minCellHeight: 22,
      },
      headStyles: {
        fillColor: [248, 248, 248],
        textColor: [30, 30, 30],
        lineWidth: 0.4,
      },
      columnStyles: {
        0: { cellWidth: usableW * 0.62 },
        1: { cellWidth: usableW * 0.13, halign: "center" },
        2: { cellWidth: usableW * 0.25, halign: "center" },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
      didDrawCell: (data: {
        section: "head" | "body" | "foot";
        cell: { x: number; y: number; width: number; height: number };
        column: { index: number };
        row: { index: number };
      }) => {
        // Case Date "non périssable" sans date pré-renseignée → noircie.
        // On retrouve l'item via row.index (rows alignées sur `eqs`).
        // Si une date est renseignée au catalogue (cas extincteur =
        // échéance prochaine visite), elle est déjà imprimée — on ne
        // noircit pas.
        if (data.section !== "body") return;
        if (data.column.index !== 2) return;
        const eq = eqs[data.row.index];
        if (!eq || eq.isPerishable || eq.expirationDate) return;
        const pad = 0.6;
        doc.setFillColor(0, 0, 0);
        doc.rect(
          data.cell.x + pad,
          data.cell.y + pad,
          data.cell.width - 2 * pad,
          data.cell.height - 2 * pad,
          "F"
        );
      },
    });
    // @ts-expect-error lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  }

  // Pied de page sur chaque page (cohérent avec visite planifiée).
  stampSimpleFooter(doc, pageH, margin);
}

function stampSimpleFooter(
  doc: import("jspdf").jsPDF,
  pageH: number,
  margin: number
) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("Interne SNCF Réseau", margin, pageH - 14);
    doc.text(
      `${i} / ${total}`,
      doc.internal.pageSize.getWidth() - margin,
      pageH - 14,
      { align: "right" }
    );
  }
  doc.setTextColor(0);
}
