const W = 320;
const H = 180;
const PAD = { l: 36, r: 12, t: 16, b: 26 };

const dateLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export function LineChart({ points }: { points: { date: number; lb: number }[] }) {
  const lbs = points.map((p) => p.lb);
  let min = Math.min(...lbs);
  let max = Math.max(...lbs);
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const t0 = points[0].date;
  const t1 = points[points.length - 1].date;
  const x = (t: number) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (lb: number) => PAD.t + (1 - (lb - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Рабочий вес по тренировкам">
      {[max, (min + max) / 2, min].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
            {Math.round(v * 10) / 10}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.lb)} r="3.5" fill="var(--accent)" />
      ))}
      <circle cx={x(last.date)} cy={y(last.lb)} r="6" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <text x={PAD.l} y={H - 6} className="chart-label">
        {dateLabel(t0)}
      </text>
      {t1 !== t0 && (
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="chart-label">
          {dateLabel(t1)}
        </text>
      )}
    </svg>
  );
}
