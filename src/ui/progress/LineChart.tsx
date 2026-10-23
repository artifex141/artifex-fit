const W = 300;
const H = 150;
const PAD = { l: 30, r: 10, t: 22, b: 22 };

const dateLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

/** Площадной график с подписью последней точки — как «Вес» на макете. Пустой — только сетка. */
export function LineChart({ points, unit, empty = 'Нет данных' }: { points: { date: number; lb: number }[]; unit: string; empty?: string }) {
  if (points.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        {[0, 1, 2, 3].map((i) => {
          const y = PAD.t + (i / 3) * (H - PAD.t - PAD.b);
          return <line key={i} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="chart-grid" />;
        })}
        <text x={(PAD.l + W) / 2} y={H / 2 + 4} textAnchor="middle" className="chart-empty">
          {empty}
        </text>
      </svg>
    );
  }
  const lbs = points.map((p) => p.lb);
  let min = Math.min(...lbs);
  let max = Math.max(...lbs);
  const padV = Math.max(2.5, (max - min) * 0.2);
  min -= padV;
  max += padV;
  const t0 = points[0].date;
  const t1 = points[points.length - 1].date;
  const x = (t: number) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${H - PAD.b} L${x(t0).toFixed(1)},${H - PAD.b} Z`;
  const last = points[points.length - 1];
  const lx = x(last.date);
  const ly = y(last.lb);
  const label = `${Math.round(last.lb * 10) / 10} ${unit}`;
  const lw = label.length * 6.5 + 14;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="График">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd60a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[max, (min + max) / 2, min].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PAD.l - 5} y={y(v) + 4} textAnchor="end" className="chart-label">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={area} fill="url(#area)" />}
      <path d={line} fill="none" stroke="#ffd60a" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="6" fill="#0b0d10" stroke="#ffd60a" strokeWidth="2.5" />
      <circle cx={lx} cy={ly} r="2.5" fill="#fff" />
      <g transform={`translate(${Math.min(Math.max(lx - lw / 2, PAD.l), W - lw)}, ${Math.max(ly - 30, 0)})`}>
        <rect width={lw} height="20" rx="10" className="chart-pill" />
        <text x={lw / 2} y="14" textAnchor="middle" className="chart-pill-text">
          {label}
        </text>
      </g>
      <text x={PAD.l} y={H - 5} className="chart-label">
        {dateLabel(t0)}
      </text>
      {t1 !== t0 && (
        <text x={W - PAD.r} y={H - 5} textAnchor="end" className="chart-label">
          {dateLabel(t1)}
        </text>
      )}
    </svg>
  );
}

/** Пустая столбчатая диаграмма (пульс, сон) — пока нет данных с часов. */
export function EmptyBars({ max, unit }: { max: number; unit: string }) {
  const w = 300;
  const h = 120;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart">
      {[0, 1, 2].map((i) => {
        const y = 10 + (i / 2) * (h - 32);
        return (
          <g key={i}>
            <line x1="30" x2={w - 6} y1={y} y2={y} className="chart-grid" />
            <text x="25" y={y + 4} textAnchor="end" className="chart-label">
              {Math.round(max - (i / 2) * max)}
              {i === 2 ? '' : unit}
            </text>
          </g>
        );
      })}
      <text x={(30 + w) / 2} y={h / 2} textAnchor="middle" className="chart-empty">
        Нет данных
      </text>
    </svg>
  );
}
