/**
 * Sparkline SVG native (Sprint 5 C7).
 *
 * Aucune dépendance graphique externe (consigne PO D12). Rend une
 * polyline normalisée 0-1 dans le viewBox, avec un point pour la valeur
 * la plus récente. Vide ou tout-zéro → ligne plate au bas du viewBox.
 */

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "currentColor",
  ariaLabel,
}: Props) {
  const n = data.length;
  if (n === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
      />
    );
  }
  const max = Math.max(...data, 1); // 1 mini pour éviter division par 0
  const stepX = n === 1 ? 0 : width / (n - 1);
  const padY = 2;
  const usableH = Math.max(1, height - padY * 2);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - padY - (v / max) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = data[n - 1];
  const lastX = (n - 1) * stepX;
  const lastY = height - padY - (last / max) * usableH;

  // Polygone fermé pour le fill léger sous la courbe.
  const fillPoints = [
    `0,${height}`,
    ...points,
    `${lastX.toFixed(1)},${height}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polygon points={fillPoints} fill={color} fillOpacity={0.1} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
