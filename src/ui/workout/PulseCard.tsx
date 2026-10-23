import { demoHeartRate } from '../demo';

const W = 300;
const H = 150;
const L = 34;
const R = 10;
const T = 30;
const B = 24;

/** Блок «Динамика пульса» по макету. Пока Apple Watch не подключены — демо-ряд. */
export function PulseCard() {
  const pts = demoHeartRate();
  const cur = pts[pts.length - 1].bpm;
  const x = (t: number) => L + 6 + (t / 15) * (W - L - R - 18);
  const y = (v: number) => T + ((180 - v) / 120) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(' ');
  const area = `${line} L${x(15)},${y(60)} L${x(0)},${y(60)} Z`;
  const lx = x(15);
  const ly = y(cur);
  const ringC = 2 * Math.PI * 40;
  const ringFrac = Math.min(1, (cur - 40) / 180);

  return (
    <div className="pulse">
      <div className="pulse-head">
        <span className="pulse-title">Динамика пульса</span>
        <span className="pulse-src">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="6.5" y="6" width="11" height="12" rx="3" />
            <path d="M9 6l.6-3h4.8l.6 3M9 18l.6 3h4.8l.6-3" />
          </svg>
          Apple Watch
        </span>
      </div>
      <div className="pulse-body">
        <div className="pulse-ring">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="pulseg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffd84a" />
                <stop offset="1" stopColor="#e3a900" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="40" className="pulse-ring-track" />
            <circle
              cx="50" cy="50" r="40" className="pulse-ring-arc" stroke="url(#pulseg)"
              strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ringFrac)} transform="rotate(-90 50 50)"
            />
            <circle cx="50" cy="50" r="33" className="pulse-ring-in" />
          </svg>
          <div className="pulse-value">
            <svg viewBox="0 0 24 24" className="pulse-heart" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
            <span className="pulse-num">{cur}</span>
            <span className="pulse-unit">bpm</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="pulse-chart">
          <defs>
            <linearGradient id="pulsearea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f5c518" stopOpacity="0.5" />
              <stop offset="1" stopColor="#f5c518" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[180, 140, 100, 60].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {[0, 5, 10, 15].map((t) => (
            <text key={t} x={x(t)} y={H - 4} textAnchor="middle">
              {t} мин
            </text>
          ))}
          <path d={area} fill="url(#pulsearea)" />
          <path d={line} className="pulse-line" />
          <circle cx={lx} cy={ly} r="5.5" fill="#f5c518" stroke="#fff" strokeWidth="2" />
          <g transform={`translate(${lx - 58}, ${ly - 34})`}>
            <rect width="64" height="22" rx="11" className="pulse-pill" />
            <text x="32" y="15" textAnchor="middle" className="pulse-pill-text">
              {cur} bpm
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
