// Графики «Прогресса» в стиле макета: жёлтая линия с заливкой и подписью последней точки, столбики пульса и сна.
const W = 300;

const dateLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const round = (v: number) => Math.round(v * 10) / 10;

interface Pt {
  date: number;
  lb: number;
}

export function AreaChart({ points, unit, ticks, dateTicks = 5 }: { points: Pt[]; unit: string; ticks?: number[]; dateTicks?: number }) {
  const H = 150;
  const PAD = { l: 26, r: 34, t: 10, b: 22 };
  if (points.length === 0) return null;
  const lbs = points.map((p) => p.lb);
  const yt = ticks ?? (() => {
    const lo = Math.floor(Math.min(...lbs) - 2.5);
    const hi = Math.ceil(Math.max(...lbs) + 2.5);
    return [hi, round((hi + lo) / 2), lo];
  })();
  const max = Math.max(...yt);
  const min = Math.min(...yt);
  const t0 = points[0].date;
  const t1 = points[points.length - 1].date;
  const x = (t: number) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${y(min)} L${x(t0).toFixed(1)},${y(min)} Z`;
  const last = points[points.length - 1];
  const lx = x(last.date);
  const ly = y(last.lb);
  const label = `${round(last.lb)} ${unit}`;
  const lw = label.length * 6 + 16;
  const dates = Array.from({ length: dateTicks }, (_, i) => t0 + ((t1 - t0) * i) / Math.max(1, dateTicks - 1) * 0.92);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="График">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5c518" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yt.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r + 20} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
            {v}
          </text>
        </g>
      ))}
      {dates.map((d) => (
        <line key={d} x1={x(d)} x2={x(d)} y1={PAD.t} y2={H - PAD.b} className="chart-grid" />
      ))}
      {points.length > 1 && <path d={area} fill="url(#areaFill)" />}
      <path d={line} className="chart-line" />
      <circle cx={lx} cy={ly} r="7" className="chart-dot-halo" />
      <circle cx={lx} cy={ly} r="4" fill="#fff" />
      <g transform={`translate(${Math.min(lx - lw / 2, W - lw)}, ${Math.max(ly - 34, 0)})`}>
        <rect width={lw} height="22" rx="7" className="chart-pill" />
        <text x={lw / 2} y="15" textAnchor="middle" className="chart-pill-text">
          {label}
        </text>
      </g>
      {dates.map((d) => (
        <text key={d} x={x(d)} y={H - 4} textAnchor="middle" className="chart-label">
          {dateLabel(d)}
        </text>
      ))}
    </svg>
  );
}

/** Столбики по дням: пульс в покое (жёлтые) или сон (серый — весь сон, жёлтый — глубокий). */
export function BarChart({ values, inner, unit, ticks, sleep }: { values: Pt[]; inner?: number[]; unit: string; ticks: number[]; sleep?: boolean }) {
  const H = 130;
  const PAD = { l: 26, r: sleep ? 6 : 34, t: 8, b: 22 };
  const max = Math.max(...ticks);
  const min = Math.min(...ticks);
  const n = values.length;
  const bw = (W - PAD.l - PAD.r) / n;
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const last = values[n - 1];
  const lx = PAD.l + bw * (n - 0.5);
  const dates = [0, 6, 13, 20, 27].filter((i) => i < n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs>
        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#f5c518" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
            {v}
            {sleep && v ? ` ${unit}` : ''}
          </text>
        </g>
      ))}
      {values.map((v, i) => {
        const cx = PAD.l + bw * (i + 0.5);
        if (sleep) {
          const deep = inner?.[i] ?? 0;
          return (
            <g key={v.date}>
              <rect x={cx - bw * 0.3} y={y(v.lb)} width={bw * 0.6} height={y(min) - y(v.lb)} rx="2" className="bar-grey" />
              <rect x={cx - bw * 0.3} y={y(Math.min(deep, v.lb - 0.5))} width={bw * 0.6} height={Math.max(0, y(min + 1.5) - y(Math.min(deep, v.lb - 0.5)))} rx="2" className="bar-yellow" />
            </g>
          );
        }
        return <rect key={v.date} x={cx - 1.6} y={y(v.lb)} width="3.2" height={y(min) - y(v.lb)} rx="1.6" fill="url(#barFill)" />;
      })}
      {!sleep && (
        <>
          <circle cx={lx} cy={y(last.lb)} r="7" className="chart-dot-halo" />
          <circle cx={lx} cy={y(last.lb)} r="4" fill="#fff" />
          <g transform={`translate(${lx - 30}, ${y(last.lb) - 36})`}>
            <rect width="52" height="22" rx="7" className="chart-pill" />
            <text x="26" y="15" textAnchor="middle" className="chart-pill-text">
              {round(last.lb)} {unit}
            </text>
          </g>
        </>
      )}
      {dates.map((i) => (
        <text key={i} x={PAD.l + bw * (i + 0.5)} y={H - 4} textAnchor="middle" className="chart-label">
          {dateLabel(values[i].date)}
        </text>
      ))}
    </svg>
  );
}
