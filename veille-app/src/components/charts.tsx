"use client";

/**
 * Graphiques SVG natifs — sans dépendance externe (pas de recharts, pas de
 * chart.js). Volontairement simples, dimensionnés pour la page /stats.
 *
 * Palette pensée pour rester lisible mobile + desktop, avec un focus
 * indigo/cyan/emerald/rose/amber.
 */

export const SERIES_COLORS = [
  "#4F46E5", // indigo
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#8B5CF6", // violet
  "#14B8A6", // teal
  "#EAB308", // yellow
  "#EC4899", // pink
];

/**
 * Bar chart horizontal — meilleur pour des libellés textes longs (noms,
 * matricules, sites). Affiche valeur à droite, libellé à gauche.
 */
export function HorizontalBars({
  data,
  maxItems = 10,
  emptyLabel = "Aucune donnée",
}: {
  data: { name: string; count: number; color?: string }[];
  maxItems?: number;
  emptyLabel?: string;
}) {
  if (!data.length)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const top = data.slice(0, maxItems);
  const max = Math.max(...top.map((d) => d.count), 1);
  return (
    <ul className="space-y-1.5">
      {top.map((d, i) => {
        const pct = (d.count / max) * 100;
        const color = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span
              className="truncate text-slate-700 shrink-0 max-w-[40%]"
              title={d.name}
            >
              {d.name}
            </span>
            <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="text-slate-700 font-mono w-10 text-right shrink-0">
              {d.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Donut chart — bon pour des répartitions catégorielles (types d'événements).
 * Affiche la légende avec compteur sur le côté ou en dessous.
 */
export function Donut({
  data,
  size = 180,
  thickness = 26,
  emptyLabel = "Aucune donnée",
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  emptyLabel?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  if (total === 0)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle
            r={r}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={thickness}
          />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * c;
            const color = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
            const seg = (
              <circle
                key={d.label + i}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900"
          style={{ fontSize: 22, fontWeight: 700 }}
        >
          {total}
        </text>
      </svg>
      <ul className="text-xs space-y-1 flex-1 min-w-[140px]">
        {data.map((d, i) => {
          const color = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={d.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: color }}
              />
              <span className="flex-1 truncate text-slate-700">{d.label}</span>
              <span className="font-mono text-slate-500">
                {d.value}{" "}
                <span className="text-slate-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Heatmap 7×24 (jour × heure). Couleur progressive selon intensité.
 * Sert à voir quand les agents saisissent vraiment leurs événements.
 */
export function Heatmap({
  matrix,
  emptyLabel = "Aucune donnée",
}: {
  /** Lignes = jours (lundi..dimanche), colonnes = heures (0..23). */
  matrix: number[][];
  emptyLabel?: string;
}) {
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const total = flat.reduce((n, v) => n + v, 0);
  if (total === 0)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  // Couleur de fond progressive : du blanc-bleuté au indigo profond.
  const colorOf = (v: number) => {
    if (v === 0) return "#F8FAFC";
    const t = Math.min(1, v / max);
    // Interpole indigo-100 → indigo-700.
    const start = [224, 231, 255]; // indigo-100
    const end = [67, 56, 202]; // indigo-700
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * t));
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] font-mono border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-slate-400 px-1"></th>
            {Array.from({ length: 24 }, (_, h) => (
              <th
                key={h}
                className="text-slate-400 font-normal px-1"
                title={`${h}h`}
              >
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, d) => (
            <tr key={d}>
              <td className="text-slate-500 pr-1 text-right">{DAYS[d]}</td>
              {row.map((v, h) => (
                <td
                  key={h}
                  title={`${DAYS[d]} ${h}h : ${v}`}
                  style={{
                    width: 16,
                    height: 16,
                    background: colorOf(v),
                    borderRadius: 3,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span className="sr-only">{v}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        <span>0</span>
        <div className="flex">
          {[0.1, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              style={{
                width: 14,
                height: 8,
                background: colorOf(Math.round(max * t)),
                borderRadius: 2,
                marginRight: 1,
              }}
            />
          ))}
        </div>
        <span>{max}</span>
      </div>
    </div>
  );
}

/**
 * Histogramme vertical compact pour distributions (buckets).
 */
export function Histogram({
  data,
  emptyLabel = "Aucune donnée",
}: {
  data: { label: string; count: number; color?: string }[];
  emptyLabel?: string;
}) {
  const total = data.reduce((n, d) => n + d.count, 0);
  if (total === 0)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-32 px-1">
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        const color = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <div
            key={d.label}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <div className="text-[10px] font-mono text-slate-500 mb-0.5">
              {d.count}
            </div>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(2, h)}%`,
                background: color,
              }}
              title={`${d.label} : ${d.count}`}
            />
            <div className="text-[9px] text-slate-500 mt-1 text-center">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Barres horizontales empilées multi-séries. Utile pour le mix Vu/Notes vs Sessions.
 */
export function StackedHorizontalBars({
  data,
  series,
  emptyLabel = "Aucune donnée",
  maxItems = 10,
}: {
  data: { name: string; values: Record<string, number> }[];
  series: { key: string; label: string; color?: string }[];
  emptyLabel?: string;
  maxItems?: number;
}) {
  const totals = data.map((d) => ({
    name: d.name,
    values: d.values,
    total: series.reduce((s, k) => s + (d.values[k.key] ?? 0), 0),
  }));
  const top = totals
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, maxItems);
  if (top.length === 0)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const maxTotal = Math.max(...top.map((d) => d.total), 1);
  return (
    <div>
      <ul className="space-y-1.5">
        {top.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span
              className="truncate text-slate-700 shrink-0 max-w-[40%]"
              title={d.name}
            >
              {d.name}
            </span>
            <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden flex">
              {series.map((s, i) => {
                const v = d.values[s.key] ?? 0;
                const w = (v / maxTotal) * 100;
                return (
                  <span
                    key={s.key}
                    title={`${s.label} : ${v}`}
                    style={{
                      width: `${w}%`,
                      background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
                    }}
                  />
                );
              })}
            </div>
            <span className="text-slate-700 font-mono w-10 text-right shrink-0">
              {d.total}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
        {series.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm"
              style={{
                background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
            <span className="text-slate-600">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Aire cumulative (mensuelle / hebdo) — bon pour les bilans.
 */
export function CumulativeArea({
  data,
  emptyLabel = "Aucune donnée",
}: {
  data: { label: string; value: number; cumulative: number }[];
  emptyLabel?: string;
}) {
  if (!data.length || data.every((d) => d.value === 0))
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const W = 600;
  const H = 180;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxCum = Math.max(...data.map((d) => d.cumulative), 1);
  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const xAt = (i: number) => padL + i * xStep;
  const yAt = (v: number) => padT + innerH - (v / maxCum) * innerH;
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.cumulative)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${xAt(data.length - 1)},${padT + innerH} L${xAt(0)},${
      padT + innerH
    } Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = Math.round(maxCum * t);
          const y = yAt(v);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="2 3"
                strokeWidth={0.6}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                className="fill-slate-400"
              >
                {v}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#4F46E5" strokeWidth={2} />
        {data.map((d, i) => {
          const step = Math.ceil(data.length / 8) || 1;
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={xAt(i)}
              y={H - 8}
              textAnchor="middle"
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
              className="fill-slate-500"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Mini-sparkline pour bout de ligne dans un tableau.
 */
export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = "#4F46E5",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const yAt = (v: number) => 2 + (height - 4) - (v / max) * (height - 4);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${yAt(v)}`)
    .join(" ");
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${total} évén. sur ${values.length} j`}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={path} fill="none" stroke={color} strokeWidth={1.2} />
      </svg>
    </span>
  );
}

/**
 * Line chart multi-séries (timeline). Auto-scale sur Y, dates en X.
 * On garde la lisibilité maximale au lieu d'un look "Power BI" : pas de zoom,
 * pas de légende interactive — c'est juste un aperçu d'évolution.
 */
export function MultiLine({
  series,
  xLabels,
  height = 200,
  emptyLabel = "Aucune donnée",
}: {
  series: { name: string; values: number[]; color?: string }[];
  xLabels: string[];
  height?: number;
  emptyLabel?: string;
}) {
  const hasData = series.some((s) => s.values.some((v) => v > 0));
  if (!hasData || xLabels.length === 0)
    return (
      <div className="text-xs text-slate-500 text-center py-6">{emptyLabel}</div>
    );
  const W = 600;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allValues = series.flatMap((s) => s.values);
  const maxY = Math.max(...allValues, 1);
  const niceMax = Math.ceil(maxY / 5) * 5 || 5;
  const xStep = xLabels.length > 1 ? innerW / (xLabels.length - 1) : innerW;
  const xAt = (i: number) => padL + i * xStep;
  const yAt = (v: number) => padT + innerH - (v / niceMax) * innerH;
  // Tracé des séries.
  const ticks = 4;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        preserveAspectRatio="none"
      >
        {/* Grille horizontale */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = Math.round((niceMax * i) / ticks);
          const y = yAt(v);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="2 3"
                strokeWidth={0.6}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
              >
                {v}
              </text>
            </g>
          );
        })}
        {/* Lignes */}
        {series.map((s, idx) => {
          const color = s.color ?? SERIES_COLORS[idx % SERIES_COLORS.length];
          const path = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} />
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={2.5}
                  fill={color}
                />
              ))}
            </g>
          );
        })}
        {/* Labels X (max 12 affichés pour éviter chevauchement) */}
        {xLabels.map((lbl, i) => {
          const step = Math.ceil(xLabels.length / 12);
          if (i % step !== 0 && i !== xLabels.length - 1) return null;
          return (
            <text
              key={i}
              x={xAt(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            >
              {lbl.slice(-5)}
            </text>
          );
        })}
      </svg>
      {/* Légende */}
      <div className="flex flex-wrap gap-3 mt-1 text-[10px]">
        {series.map((s, i) => {
          const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
          const total = s.values.reduce((n, v) => n + v, 0);
          return (
            <span key={s.name} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-sm"
                style={{ background: color }}
              />
              <span className="font-mono text-slate-600">
                {s.name}{" "}
                <span className="text-slate-400">({total})</span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
