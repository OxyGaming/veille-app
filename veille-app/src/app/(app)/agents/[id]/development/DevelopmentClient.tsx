"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/icons";
import type {
  AgentDevelopmentSummary,
  MonthlyObservationCount,
  DomainBreakdown,
  TopProcedure,
  CommentExcerpt,
} from "@/lib/agent-development-aggregator";
import {
  buildDevelopmentPdf,
  developmentPdfFilename,
} from "./developmentPdf";

const STATUS_LABEL: Record<string, string> = {
  CONFORME: "Conforme",
  A_REVOIR: "À revoir",
  NON_CONFORME: "Non conforme",
};

/** Libellé court du mois "YYYY-MM" → "sept. 25" */
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, "MMM yy", { locale: fr });
}

export default function DevelopmentClient({
  summary,
  defaultFrom,
  defaultTo,
}: {
  summary: AgentDevelopmentSummary;
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function exportPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      // 1. On envoie le log côté serveur en parallèle de la génération PDF.
      //    Le serveur revérifie le rôle, le scope agent, et écrit l'audit
      //    avec les compteurs RÉ-calculés (pas ceux du client).
      const logRes = await fetch(
        `/api/agents/${summary.agent.id}/development/pdf-log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodFrom: summary.period.from,
            periodTo: summary.period.to,
          }),
        },
      );
      if (!logRes.ok) {
        const j = await logRes.json().catch(() => ({}));
        toast.error(j.error || "Export refusé");
        return;
      }
      // 2. Génération PDF côté client (pas d'aller-retour réseau lourd).
      const blob = await buildDevelopmentPdf(summary);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = developmentPdfFilename(
        summary.agent.lastName,
        summary.agent.firstName,
        new Date(),
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Libération mémoire après que le navigateur a démarré le téléchargement.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  function applyDates() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/agents/${summary.agent.id}/development?${params.toString()}`);
  }

  const { agent, period, counts, lowSample, trend } = summary;
  const agentName = `${agent.firstName} ${agent.lastName}`;
  const fromLabel = format(new Date(period.from), "PPP", { locale: fr });
  const toLabel = format(new Date(period.to), "PPP", { locale: fr });

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link
          href={`/agents/${agent.id}`}
          className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
        >
          <Icon.ChevronLeft className="w-3 h-3" />
          Retour à la fiche agent
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight mt-2">
          Fiche de développement individuel
        </h1>
        <div className="text-sm text-slate-600 mt-1">
          <span className="font-semibold">{agentName}</span>
          {agent.matricule && (
            <span className="font-mono text-slate-500 ml-2">
              {agent.matricule}
            </span>
          )}
          {agent.teamName && (
            <span className="text-slate-500 ml-2">· {agent.teamName}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Période : du {fromLabel} au {toLabel}
        </p>
      </div>

      {/* Sélecteur de période */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">Du</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input text-xs"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">Au</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input text-xs"
          />
        </label>
        <button
          type="button"
          onClick={applyDates}
          className="btn btn-primary text-xs px-3 py-1.5"
        >
          Appliquer
        </button>
        <span className="text-[11px] text-slate-400 ml-auto">
          Par défaut : 12 mois glissants
        </span>
      </div>

      {/* Avertissement échantillon limité */}
      {lowSample && (
        <div
          role="status"
          className="card mb-4 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="flex items-start gap-2">
            <Icon.AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              <strong>Échantillon limité.</strong> Les éléments ci-dessous
              doivent être interprétés avec prudence et complétés par
              l&apos;échange managérial.
            </p>
          </div>
        </div>
      )}

      {/* Tuiles KPI synthèse */}
      <section className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Synthèse
          </h2>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy}
            className="text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exporter au format PDF (téléchargement immédiat)"
          >
            <Icon.Download className="w-3.5 h-3.5" />
            {pdfBusy ? "Génération…" : "Exporter PDF"}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Kpi label="Sessions de veille" value={counts.sessions} />
          <Kpi label="« Vu en poste »" value={counts.sightings} />
          <Kpi label="Commentaires managériaux" value={counts.notes} />
          <Kpi label="Actions validées" value={counts.validations} />
          <Kpi label="Actions ouvertes" value={counts.openActions} />
          <Kpi label="Procédures observées" value={counts.proceduresObserved} />
          <Kpi
            label="Points observés"
            value={counts.observationsTotal}
          />
          <Kpi label="Conformes" value={counts.conforme} tone="ok" />
          <Kpi label="À revoir" value={counts.aRevoir} tone="warn" />
          <Kpi label="Non conformes" value={counts.nonConforme} tone="bad" />
        </div>
        <div className="mt-3">
          <TrendBadge trend={trend} />
        </div>
      </section>

      {/* Bar chart mensuel */}
      <section className="card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">
          Évolution mensuelle des observations
        </h2>
        <MonthlyChart data={summary.monthly} />
      </section>

      {/* Répartition par domaine */}
      <section className="card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">
          Répartition par domaine
        </h2>
        {summary.byDomain.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucun point observé sur la période.
          </p>
        ) : (
          <DomainChart data={summary.byDomain} />
        )}
      </section>

      {/* À valoriser */}
      <section className="card p-4 mb-4 border-emerald-200">
        <h2 className="text-sm font-semibold text-emerald-800 mb-3">
          À valoriser
        </h2>
        {summary.topConforme.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucune procédure observée en conforme sur la période.
          </p>
        ) : (
          <TopList items={summary.topConforme} tone="ok" />
        )}
        {summary.positiveComments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Éléments observés positifs
            </h3>
            <CommentList items={summary.positiveComments} tone="ok" />
          </div>
        )}
      </section>

      {/* Axes de développement */}
      <section className="card p-4 mb-4 border-rose-200">
        <h2 className="text-sm font-semibold text-rose-800 mb-3">
          Axes de développement
        </h2>
        {summary.topAxes.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucun écart relevé sur la période.
          </p>
        ) : (
          <TopList items={summary.topAxes} tone="bad" />
        )}
        {summary.recurringNCs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Points d&apos;attention récurrents
            </h3>
            <ul className="space-y-1.5">
              {summary.recurringNCs.map((r) => (
                <li
                  key={r.checklistItemId}
                  className="text-xs flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-md px-2.5 py-1.5"
                >
                  <span className="font-mono text-[10px] font-bold text-rose-700 shrink-0 mt-0.5">
                    ×{r.occurrences}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-rose-900">{r.itemLabel}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.procedureTitle}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.attentionComments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Éléments observés à travailler
            </h3>
            <CommentList items={summary.attentionComments} tone="bad" />
          </div>
        )}
        {summary.silentMonths.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Mois sans observation ni passage
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {summary.silentMonths.map((m) => (
                <span
                  key={m}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {monthLabel(m)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Chronologie */}
      <section className="card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Chronologie</h2>
        {summary.timeline.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucune activité enregistrée sur la période.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {summary.timeline.map((t, i) => (
              <li
                key={i}
                className="text-xs flex items-start gap-2 border-l-2 pl-2.5 py-0.5 border-slate-200"
              >
                <span className="font-mono text-[10px] text-slate-500 shrink-0 w-20">
                  {format(new Date(t.at), "dd/MM/yy", { locale: fr })}
                </span>
                <span
                  className={`font-mono text-[9px] uppercase tracking-wider shrink-0 w-16 ${
                    t.type === "session"
                      ? "text-cyan-700"
                      : t.type === "sighting"
                      ? "text-violet-700"
                      : t.type === "note"
                      ? "text-amber-700"
                      : t.type === "validation"
                      ? "text-emerald-700"
                      : "text-slate-500"
                  }`}
                >
                  {t.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-900 truncate">{t.title}</div>
                  {t.detail && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {t.detail}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mention méthodologique */}
      <footer className="text-[11px] text-slate-500 italic border-t border-slate-200 pt-3 mt-6">
        Document d&apos;aide au dialogue managérial. Il ne constitue pas une
        notation automatique et doit être interprété avec le contexte
        opérationnel.
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : tone === "warn"
      ? "text-amber-700 bg-amber-50 border-amber-100"
      : tone === "bad"
      ? "text-rose-700 bg-rose-50 border-rose-100"
      : "text-slate-900 bg-white border-slate-200";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneCls}`}>
      <div className="text-xl lg:text-2xl font-bold leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 mt-1 leading-tight">
        {label}
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: AgentDevelopmentSummary["trend"] }) {
  if (trend === "not-enough-data") {
    return (
      <p className="text-[11px] text-slate-500 italic">
        Tendance non calculable (échantillon trop faible).
      </p>
    );
  }
  if (trend === "stable") {
    return (
      <p className="text-[11px] text-slate-600">
        Tendance globale : <strong>stable</strong> sur la période.
      </p>
    );
  }
  if (trend === "decreasing-nc") {
    return (
      <p className="text-[11px] text-emerald-700">
        Tendance : moins de non-conformités sur la 2<sup>e</sup> moitié de la
        période — <strong>évolution positive</strong>.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-rose-700">
      Tendance : plus de non-conformités sur la 2<sup>e</sup> moitié de la
      période — <strong>point d&apos;attention</strong>.
    </p>
  );
}

function MonthlyChart({ data }: { data: MonthlyObservationCount[] }) {
  const maxStack = Math.max(
    1,
    ...data.map((d) => d.conforme + d.aRevoir + d.nonConforme),
  );
  return (
    <div>
      <div className="flex items-end gap-1 h-32 w-full">
        {data.map((d) => {
          const total = d.conforme + d.aRevoir + d.nonConforme;
          const conformePct = total > 0 ? (d.conforme / maxStack) * 100 : 0;
          const aRevoirPct = total > 0 ? (d.aRevoir / maxStack) * 100 : 0;
          const nonConformePct = total > 0 ? (d.nonConforme / maxStack) * 100 : 0;
          return (
            <div
              key={d.month}
              className="flex-1 flex flex-col justify-end h-full min-w-0"
              title={`${monthLabel(d.month)} — ${d.conforme} conforme, ${d.aRevoir} à revoir, ${d.nonConforme} NC`}
            >
              <div
                className="bg-rose-400 w-full rounded-t-sm"
                style={{ height: `${nonConformePct}%` }}
              />
              <div
                className="bg-amber-400 w-full"
                style={{ height: `${aRevoirPct}%` }}
              />
              <div
                className="bg-emerald-400 w-full rounded-b-sm"
                style={{ height: `${conformePct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500 font-mono">
        {data.map((d) => (
          <div
            key={d.month}
            className="flex-1 text-center min-w-0 truncate"
          >
            {monthLabel(d.month).replace(".", "")}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-3 text-[10px] text-slate-600">
        <Legend color="bg-emerald-400" label="Conforme" />
        <Legend color="bg-amber-400" label="À revoir" />
        <Legend color="bg-rose-400" label="Non conforme" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function DomainChart({ data }: { data: DomainBreakdown[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => {
        const conformePct = (d.conforme / max) * 100;
        const aRevoirPct = (d.aRevoir / max) * 100;
        const nonConformePct = (d.nonConforme / max) * 100;
        return (
          <li key={d.domain} className="text-xs">
            <div className="flex justify-between mb-0.5">
              <span className="font-medium">{d.domain}</span>
              <span className="font-mono text-slate-500">{d.total}</span>
            </div>
            <div className="flex h-4 bg-slate-100 rounded overflow-hidden">
              <div
                className="bg-emerald-400 h-full"
                style={{ width: `${conformePct}%` }}
                title={`Conforme : ${d.conforme}`}
              />
              <div
                className="bg-amber-400 h-full"
                style={{ width: `${aRevoirPct}%` }}
                title={`À revoir : ${d.aRevoir}`}
              />
              <div
                className="bg-rose-400 h-full"
                style={{ width: `${nonConformePct}%` }}
                title={`Non conforme : ${d.nonConforme}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopList({
  items,
  tone,
}: {
  items: TopProcedure[];
  tone: "ok" | "bad";
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((p) => {
        const main =
          tone === "ok"
            ? p.conformeCount
            : p.nonConformeCount + p.aRevoirCount;
        return (
          <li
            key={p.procedureId}
            className={`text-xs flex items-center gap-2 px-2.5 py-1.5 rounded border ${
              tone === "ok"
                ? "bg-emerald-50 border-emerald-100"
                : "bg-rose-50 border-rose-100"
            }`}
          >
            <span
              className={`font-mono text-[10px] font-bold shrink-0 w-6 text-center ${
                tone === "ok" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {main}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 truncate">{p.title}</div>
              <div className="text-[11px] text-slate-500 truncate">
                {p.domain}
                {tone === "bad" &&
                  ` · ${p.aRevoirCount} à revoir, ${p.nonConformeCount} NC`}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CommentList({
  items,
  tone,
}: {
  items: CommentExcerpt[];
  tone: "ok" | "bad";
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li
          key={c.observationItemId}
          className={`text-xs px-2.5 py-1.5 rounded border ${
            tone === "ok"
              ? "bg-emerald-50 border-emerald-100"
              : "bg-rose-50 border-rose-100"
          }`}
        >
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mb-0.5">
            <span>{format(new Date(c.recordedAt), "dd/MM/yy", { locale: fr })}</span>
            <span>· {STATUS_LABEL[c.status] ?? c.status}</span>
            <span className="truncate">· {c.procedureTitle}</span>
          </div>
          <div className="italic text-slate-700">« {c.comment} »</div>
        </li>
      ))}
    </ul>
  );
}
