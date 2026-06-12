"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CumulativeArea,
  Donut,
  Heatmap,
  Histogram,
  HorizontalBars,
  MultiLine,
  SERIES_COLORS,
  StackedHorizontalBars,
} from "@/components/charts";

type FilterMeta = {
  users: { id: string; name: string }[];
  agents: { id: string; lastName: string; firstName: string; matricule: string }[];
  sites: { id: string; name: string; code: string | null }[];
};

type Overview = {
  range: { from: string; to: string; granularity: "day" | "week" };
  totalsByType: { type: string; count: number }[];
  byCreator: { name: string; count: number }[];
  bySubject: { name: string; count: number }[];
  timeline: { date: string; counts: Record<string, number> }[];
  totalCount: number;
};
type Quality = {
  conformityRate: {
    title: string;
    conform: number;
    nonConform: number;
    sansObjet: number;
    total: number;
    rate: number;
  }[];
  ncPerTemplate: { name: string; visits: number; nc: number; avg: number }[];
  photoCoverage: {
    notes: { with: number; total: number };
    sightings: { with: number; total: number };
  };
  ncRecurrence: { siteName: string; description: string; occurrences: number }[];
};
type Activity = {
  heatmap: number[][];
  loadPerUser: {
    name: string;
    total: number;
    visit: number;
    session: number;
    validation: number;
    sighting: number;
    note: number;
  }[];
  topProcedures: { title: string; count: number }[];
  vuVsSession: {
    name: string;
    sessions: number;
    sightings: number;
    notes: number;
    total: number;
    surfaceRatio: number;
  }[];
  sessionDuration: { label: string; count: number }[];
};
type Actions = {
  overdue: {
    total: number;
    byAgent: { name: string; count: number }[];
    bySite: { name: string; count: number }[];
  };
  soon: {
    total: number;
    byAgent: { name: string; count: number }[];
    bySite: { name: string; count: number }[];
  };
  validationDelay: {
    avgDays: number | null;
    medianDays: number | null;
    sampleCount: number;
    earliest: number | null;
    latest: number | null;
  };
  actionsActiveAging: { label: string; count: number }[];
  monthlyValidations: { month: string; count: number; cumulative: number }[];
  photoSync: { local: number; synced: number; total: number };
};

const TYPE_FILTERS = [
  { v: "visit", label: "Visites", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { v: "session", label: "Sessions", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { v: "validation", label: "Validations", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { v: "sighting", label: "Vu", color: "bg-slate-50 text-slate-700 border-slate-200" },
  { v: "note", label: "Notes", color: "bg-violet-50 text-violet-700 border-violet-200" },
];

const TYPE_LABEL: Record<string, string> = {
  visit: "Visites",
  session: "Sessions",
  validation: "Validations",
  sighting: "Vu",
  note: "Notes",
};

const TYPE_COLOR: Record<string, string> = {
  visit: SERIES_COLORS[0],
  session: SERIES_COLORS[1],
  validation: SERIES_COLORS[2],
  sighting: SERIES_COLORS[7],
  note: SERIES_COLORS[5],
};

const TABS = [
  { v: "overview", label: "Vue d'ensemble" },
  { v: "quality", label: "Qualité de saisie" },
  { v: "activity", label: "Activité" },
  { v: "actions", label: "Actions" },
  { v: "veille-site", label: "Veille de site" },
] as const;

type VeilleSite = {
  dashboard: {
    siteId: string;
    siteName: string;
    siteCode: string | null;
    lastVisitId: string | null;
    lastVisitDate: string | null;
    total: number;
    conformes: number;
    ecarts: number;
    rate: number | null;
    openActions: number;
  }[];
  renouveler: {
    equipmentId: string;
    siteId: string;
    siteName: string;
    siteCode: string | null;
    category: string;
    label: string;
    expectedQuantity: number | null;
    expirationDate: string | null;
    status: "EXPIRED" | "SOON";
    daysToExpiry: number | null;
  }[];
};

export default function StatsClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["v"]>("overview");
  const [types, setTypes] = useState<Set<string>>(
    new Set(["visit", "session", "validation", "sighting", "note"])
  );
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observerId, setObserverId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [actions, setActions] = useState<Actions | null>(null);
  const [veilleSite, setVeilleSite] = useState<VeilleSite | null>(null);

  useEffect(() => {
    fetch("/api/history/filters")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta({ users: [], agents: [], sites: [] }));
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", from);
    p.set("to", to);
    if (observerId) p.set("observerId", observerId);
    if (agentId) p.set("agentId", agentId);
    if (siteId) p.set("siteId", siteId);
    return p;
  }, [from, to, observerId, agentId, siteId]);

  // Lazy fetch par onglet : on charge à la première activation, on rafraîchit
  // si les filtres changent.
  useEffect(() => {
    const p = new URLSearchParams(params);
    p.set("types", [...types].join(","));
    fetch(`/api/stats?${p}`)
      .then((r) => r.json())
      .then(setOverview);
  }, [params, types]);
  useEffect(() => {
    if (tab !== "quality") return;
    fetch(`/api/stats/quality?${params}`)
      .then((r) => r.json())
      .then(setQuality);
  }, [tab, params]);
  useEffect(() => {
    if (tab !== "activity") return;
    fetch(`/api/stats/activity?${params}`)
      .then((r) => r.json())
      .then(setActivity);
  }, [tab, params]);
  useEffect(() => {
    if (tab !== "actions") return;
    fetch(`/api/stats/actions?${params}`)
      .then((r) => r.json())
      .then(setActions);
  }, [tab, params]);
  useEffect(() => {
    if (tab !== "veille-site") return;
    // Pas de filtres date/agent/site sur cet onglet : le tableau est un
    // instantané (dernière visite par site, péremption à 30 j).
    fetch(`/api/stats/veille-site`)
      .then((r) => r.json())
      .then(setVeilleSite);
  }, [tab]);

  function toggleType(t: string) {
    setTypes((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function resetRange(days: number) {
    setFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  }

  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
          Statistiques
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          4 onglets — vue d&apos;ensemble, qualité de saisie, activité, actions.
        </p>
      </div>

      {/* Filtres globaux (s'appliquent à tous les onglets) */}
      <section className="card p-3 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {TYPE_FILTERS.map((f) => {
            const sel = types.has(f.v);
            return (
              <button
                key={f.v}
                onClick={() => toggleType(f.v)}
                className={`text-xs font-mono px-3 py-1.5 rounded-md border transition-colors ${
                  sel
                    ? f.color + " border-current"
                    : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <div className="ml-auto flex gap-2 items-center text-xs flex-wrap">
            <span className="text-slate-500">Du</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input max-w-[140px] text-xs"
            />
            <span className="text-slate-500">au</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input max-w-[140px] text-xs"
            />
            <div className="flex gap-1 ml-2">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => resetRange(d)}
                  className="text-[10px] font-mono px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-300 text-slate-600"
                >
                  {d}j
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Créateur</span>
            <select
              value={observerId}
              onChange={(e) => setObserverId(e.target.value)}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Agent</span>
            <select
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                if (e.target.value) setSiteId("");
              }}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.lastName} {a.firstName} ({a.matricule})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0 w-20">Site</span>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                if (e.target.value) setAgentId("");
              }}
              className="input text-xs flex-1"
            >
              <option value="">— Tous —</option>
              {meta?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.v
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={overview} types={types} />}
      {tab === "quality" && <QualityTab data={quality} />}
      {tab === "activity" && <ActivityTab data={activity} />}
      {tab === "actions" && <ActionsTab data={actions} />}
      {tab === "veille-site" && <VeilleSiteTab data={veilleSite} />}
    </div>
  );
}

/* ============================================================================
 *  Vue d'ensemble — donut, top créateur, top sujet, timeline
 * ========================================================================== */
function OverviewTab({
  data,
  types,
}: {
  data: Overview | null;
  types: Set<string>;
}) {
  if (!data)
    return <div className="text-sm text-slate-500 py-8 text-center">Chargement…</div>;
  const donutData = data.totalsByType.map((t) => ({
    label: TYPE_LABEL[t.type] ?? t.type,
    value: t.count,
    color: TYPE_COLOR[t.type],
  }));
  const xLabels = data.timeline.map((p) => p.date);
  const presentTypes = [...types].filter((t) =>
    data.timeline.some((p) => (p.counts[t] ?? 0) > 0)
  );
  const series = presentTypes.map((t) => ({
    name: TYPE_LABEL[t] ?? t,
    values: data.timeline.map((p) => p.counts[t] ?? 0),
    color: TYPE_COLOR[t],
  }));
  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
        <Tile label="Total" value={data.totalCount} />
        {TYPE_FILTERS.map((f) => {
          const v = data.totalsByType.find((t) => t.type === f.v)?.count ?? 0;
          return <Tile key={f.v} label={f.label} value={v} typeKey={f.v} />;
        })}
      </section>
      <div className="grid gap-4 lg:grid-cols-3 mb-5">
        <Card title="Répartition par type">
          <Donut data={donutData} />
        </Card>
        <Card title="Par créateur (top 10)">
          <HorizontalBars data={data.byCreator} maxItems={10} />
        </Card>
        <Card title="Agents / sites (top 10)">
          <HorizontalBars data={data.bySubject} maxItems={10} />
        </Card>
      </div>
      <Card
        title="Évolution"
        subtitle={`${
          data.range.granularity === "day" ? "par jour" : "par semaine"
        } · ${format(new Date(data.range.from), "P", { locale: fr })} → ${format(
          new Date(data.range.to),
          "P",
          { locale: fr }
        )}`}
      >
        <MultiLine xLabels={xLabels} series={series} height={220} />
      </Card>
    </>
  );
}

/* ============================================================================
 *  Qualité de saisie — conformité, NC par template, couverture photo, récidive NC
 * ========================================================================== */
function QualityTab({ data }: { data: Quality | null }) {
  if (!data)
    return <div className="text-sm text-slate-500 py-8 text-center">Chargement…</div>;
  const ncTplBars = data.ncPerTemplate.map((t) => ({
    name: t.name,
    count: Math.round(t.avg * 10),
  }));
  const pct = (a: number, b: number) =>
    b > 0 ? Math.round((a / b) * 100) : 0;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card
          title="Taux de conformité par section"
          subtitle="Sur l'ensemble des observations PER_ITEM et PER_SECTION"
        >
          {data.conformityRate.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1.5">
              {data.conformityRate.map((c) => (
                <li
                  key={c.title}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center text-xs"
                >
                  <span className="font-semibold truncate" title={c.title}>
                    {c.title}
                  </span>
                  <span className="font-mono text-slate-700">
                    {c.rate}% conformes · {c.total} obs.
                  </span>
                  <div className="col-span-2 h-2.5 bg-slate-100 rounded overflow-hidden flex">
                    <span
                      style={{ width: `${pct(c.conform, c.total)}%`, background: "#10B981" }}
                    />
                    <span
                      style={{ width: `${pct(c.nonConform, c.total)}%`, background: "#F43F5E" }}
                    />
                    <span
                      style={{ width: `${pct(c.sansObjet, c.total)}%`, background: "#94A3B8" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="NC moyennes par template (×10)">
          {ncTplBars.length === 0 ? (
            <Empty />
          ) : (
            <>
              <HorizontalBars data={ncTplBars} />
              <ul className="text-[11px] text-slate-500 mt-3 space-y-0.5">
                {data.ncPerTemplate.map((t) => (
                  <li key={t.name}>
                    <b>{t.name}</b> — {t.avg} NC/visite ({t.nc} sur{" "}
                    {t.visits} visite{t.visits > 1 ? "s" : ""})
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title="Couverture en photos">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <PhotoCoverageCard
              label="Commentaires (Notes)"
              with={data.photoCoverage.notes.with}
              total={data.photoCoverage.notes.total}
            />
            <PhotoCoverageCard
              label="Vu"
              with={data.photoCoverage.sightings.with}
              total={data.photoCoverage.sightings.total}
            />
          </div>
        </Card>
        <Card
          title="Non-conformités récurrentes"
          subtitle="Mêmes constats sur visites successives d'un site"
        >
          {data.ncRecurrence.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">
              Pas encore de récidive détectée.
            </div>
          ) : (
            <ul className="text-xs space-y-1.5">
              {data.ncRecurrence.map((r, i) => (
                <li key={i} className="border-l-2 border-rose-400 pl-2">
                  <div className="font-semibold">{r.siteName}</div>
                  <div className="text-slate-600 line-clamp-1">
                    {r.description}
                  </div>
                  <span className="text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200 rounded px-1.5 py-0.5">
                    ×{r.occurrences}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* ============================================================================
 *  Activité — heatmap, charge par user, top procédures, vu/sessions, durée
 * ========================================================================== */
function ActivityTab({ data }: { data: Activity | null }) {
  if (!data)
    return <div className="text-sm text-slate-500 py-8 text-center">Chargement…</div>;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title="Heatmap : jour de la semaine × heure">
          <Heatmap matrix={data.heatmap} />
        </Card>
        <Card title="Charge par utilisateur (tous types)">
          <StackedHorizontalBars
            data={data.loadPerUser.map((u) => ({
              name: u.name,
              values: {
                visit: u.visit,
                session: u.session,
                validation: u.validation,
                sighting: u.sighting,
                note: u.note,
              },
            }))}
            series={[
              { key: "visit", label: "Visites", color: TYPE_COLOR.visit },
              { key: "session", label: "Sessions", color: TYPE_COLOR.session },
              { key: "validation", label: "Validations", color: TYPE_COLOR.validation },
              { key: "sighting", label: "Vu", color: TYPE_COLOR.sighting },
              { key: "note", label: "Notes", color: TYPE_COLOR.note },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title="Procédures les plus observées">
          <HorizontalBars
            data={data.topProcedures.map((p) => ({
              name: p.title,
              count: p.count,
            }))}
          />
        </Card>
        <Card title="Mix Vu/Notes vs Sessions par agent">
          <StackedHorizontalBars
            data={data.vuVsSession.map((v) => ({
              name: v.name,
              values: {
                sessions: v.sessions,
                sightings: v.sightings,
                notes: v.notes,
              },
            }))}
            series={[
              { key: "sessions", label: "Sessions", color: TYPE_COLOR.session },
              { key: "sightings", label: "Vu", color: TYPE_COLOR.sighting },
              { key: "notes", label: "Notes", color: TYPE_COLOR.note },
            ]}
          />
          <div className="text-[10px] text-slate-500 mt-2">
            Ratio "surface" = (Vu+Notes) / total. Élevé = agent peu veillé en
            profondeur.
          </div>
        </Card>
      </div>

      <Card title="Distribution des durées de session">
        <Histogram data={data.sessionDuration} />
      </Card>
    </>
  );
}

/* ============================================================================
 *  Actions — overdue/soon, délai validation, aging, cumul mensuel
 * ========================================================================== */
function ActionsTab({ data }: { data: Actions | null }) {
  if (!data)
    return <div className="text-sm text-slate-500 py-8 text-center">Chargement…</div>;
  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Tile
          label="Actions en retard"
          value={data.overdue.total}
          color="#F43F5E"
        />
        <Tile
          label="Actions < 7 jours"
          value={data.soon.total}
          color="#F59E0B"
        />
        <Tile
          label="Écart moy. / échéance"
          value={data.validationDelay.avgDays ?? 0}
          color="#06B6D4"
          unit="j"
          hint="négatif = validé en avance"
        />
        <Tile
          label="Écart médian / échéance"
          value={data.validationDelay.medianDays ?? 0}
          color="#10B981"
          unit="j"
          hint={`${data.validationDelay.sampleCount} validation(s)`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title="En retard : top agents">
          <HorizontalBars data={data.overdue.byAgent} />
        </Card>
        <Card title="En retard : top sites">
          <HorizontalBars data={data.overdue.bySite} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title="Aging des actions actives">
          <Histogram
            data={data.actionsActiveAging.map((b, i) => ({
              ...b,
              color:
                i === 0
                  ? "#10B981"
                  : i === 1
                  ? "#06B6D4"
                  : i === 2
                  ? "#F59E0B"
                  : i === 3
                  ? "#F43F5E"
                  : "#7F1D1D",
            }))}
          />
        </Card>
        <Card title="Statut sync des photos">
          <Donut
            data={[
              {
                label: "Synchronisées",
                value: data.photoSync.synced,
                color: "#10B981",
              },
              {
                label: "Locales (offline)",
                value: data.photoSync.local,
                color: "#F59E0B",
              },
            ]}
          />
        </Card>
      </div>

      <Card
        title="Cumul des validations par mois"
        subtitle={`Total ${data.monthlyValidations.reduce(
          (n, m) => n + m.count,
          0
        )} validation(s) cumulée(s)`}
      >
        <CumulativeArea
          data={data.monthlyValidations.map((m) => ({
            label: m.month.slice(2),
            value: m.count,
            cumulative: m.cumulative,
          }))}
        />
      </Card>
    </>
  );
}

/* ============================================================================
 *  Helpers UI
 * ========================================================================== */
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      {subtitle && (
        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
          {subtitle}
        </div>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  typeKey,
  color,
  unit,
  hint,
}: {
  label: string;
  value: number;
  typeKey?: string;
  color?: string;
  unit?: string;
  hint?: string;
}) {
  const c = color ?? (typeKey ? TYPE_COLOR[typeKey] : "#0F172A");
  return (
    <div
      className="border border-slate-200 rounded-xl p-3 bg-white"
      style={{ borderLeftWidth: 4, borderLeftColor: c }}
    >
      <div className="text-2xl font-mono font-bold leading-none text-slate-900">
        {value}
        {unit && (
          <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1.5 font-semibold">
        {label}
      </div>
      {hint && (
        <div className="text-[10px] text-slate-400 mt-0.5 normal-case">
          {hint}
        </div>
      )}
    </div>
  );
}

function PhotoCoverageCard({
  label,
  with: withP,
  total,
}: {
  label: string;
  with: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((withP / total) * 100) : 0;
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-mono font-bold mt-0.5">
        {pct}
        <span className="text-sm text-slate-500">%</span>
      </div>
      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
        {withP} / {total}
      </div>
      <div className="h-1.5 bg-slate-100 rounded overflow-hidden mt-1.5">
        <div
          className="h-full bg-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="text-xs text-slate-500 text-center py-4">
      Pas de données pour cette période.
    </div>
  );
}

/* ============================================================================
 *  Veille de site — conformité par site + liste "à renouveler"
 *  Onglet indépendant des filtres globaux (instantané).
 * ========================================================================== */
function VeilleSiteTab({ data }: { data: VeilleSite | null }) {
  if (!data)
    return (
      <div className="text-sm text-slate-500 py-12 text-center">Chargement…</div>
    );

  return (
    <div className="space-y-4">
      {/* (a) Tableau de bord conformité par site */}
      <section className="card p-4">
        <h2 className="font-bold mb-1 text-sm">Conformité par site</h2>
        <p className="text-xs text-slate-500 mb-3">
          Dernière visite « Veille de site » terminée par site —{" "}
          <span className="font-mono">{data.dashboard.length}</span> site(s).
        </p>
        {data.dashboard.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            Aucun site visible.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left font-mono font-normal py-1.5">Site</th>
                  <th className="text-left font-mono font-normal py-1.5">
                    Dernière vérif.
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Total
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Conformes
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Écarts
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Taux
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Actions ouvertes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.dashboard.map((row) => (
                  <tr
                    key={row.siteId}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-1.5">
                      <div className="font-medium">{row.siteName}</div>
                      {row.siteCode && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {row.siteCode}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 font-mono">
                      {row.lastVisitDate ? (
                        <a
                          href={`/visits/${row.lastVisitId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {format(new Date(row.lastVisitDate), "dd/MM/yyyy", {
                            locale: fr,
                          })}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {row.total || "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono text-emerald-700">
                      {row.total ? row.conformes : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono text-rose-700">
                      {row.total ? row.ecarts : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold">
                      {row.rate != null ? (
                        <span
                          className={
                            row.rate >= 95
                              ? "text-emerald-700"
                              : row.rate >= 80
                                ? "text-amber-700"
                                : "text-rose-700"
                          }
                        >
                          {row.rate.toFixed(1)} %
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {row.openActions > 0 ? (
                        <a
                          href={`/sites/${row.siteId}`}
                          className="text-rose-700 hover:underline font-bold"
                        >
                          {row.openActions}
                        </a>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* (b) Liste "à renouveler" — périssables < 30 j ou dépassés */}
      <section className="card p-4">
        <h2 className="font-bold mb-1 text-sm">À renouveler (≤ 30 jours)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Éléments périssables dont la date de péremption est dépassée ou
          arrive à échéance — tous sites confondus.
        </p>
        {data.renouveler.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            Rien à renouveler dans les 30 jours.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left font-mono font-normal py-1.5">Site</th>
                  <th className="text-left font-mono font-normal py-1.5">
                    Catégorie
                  </th>
                  <th className="text-left font-mono font-normal py-1.5">
                    Élément
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">Qté</th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Péremption
                  </th>
                  <th className="text-right font-mono font-normal py-1.5">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.renouveler.map((e) => (
                  <tr
                    key={e.equipmentId}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-1.5">
                      <a
                        href={`/sites/${e.siteId}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {e.siteName}
                      </a>
                    </td>
                    <td className="py-1.5 text-slate-500">{e.category}</td>
                    <td className="py-1.5">{e.label}</td>
                    <td className="py-1.5 text-right font-mono text-slate-500">
                      {e.expectedQuantity ?? "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {e.expirationDate
                        ? format(new Date(e.expirationDate), "dd/MM/yyyy")
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {e.status === "EXPIRED" ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Périmé{e.daysToExpiry != null && e.daysToExpiry < 0
                            ? ` (J${e.daysToExpiry})`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Bientôt
                          {e.daysToExpiry != null
                            ? ` (J+${e.daysToExpiry})`
                            : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
