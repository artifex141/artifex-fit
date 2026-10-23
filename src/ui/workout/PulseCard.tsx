/** Блок «Динамика пульса» по макету. Apple Watch пока не подключены — показываем пустые значения. */
export function PulseCard() {
  const W = 300;
  const H = 150;
  const L = 34;
  const B = 24;
  const ys = [180, 140, 100, 60];
  const xs = ['0 мин', '5 мин', '10 мин', '15 мин'];
  const y = (v: number) => 8 + ((180 - v) / 120) * (H - B - 8);
  const x = (i: number) => L + 14 + (i / 3) * (W - L - 40);
  return (
    <div className="pulse">
      <div className="pulse-head">
        <span className="pulse-title">Динамика пульса</span>
        <span className="pulse-src">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="6" y="6" width="12" height="12" rx="3" />
            <path d="M9 6l.5-3h5l.5 3M9 18l.5 3h5l.5-3" />
          </svg>
          Apple Watch
        </span>
      </div>
      <div className="pulse-body">
        <div className="pulse-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="pulse-ring-bg" />
          </svg>
          <div className="pulse-value">
            <svg viewBox="0 0 24 24" className="pulse-heart" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
            <span className="pulse-num">--</span>
            <span className="pulse-unit">bpm</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="pulse-chart">
          {ys.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} className="grid" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {xs.map((t, i) => (
            <text key={t} x={x(i)} y={H - 4} textAnchor="middle">
              {t}
            </text>
          ))}
          <text x={(L + W) / 2} y={y(120) + 4} textAnchor="middle" className="pulse-empty">
            Нет данных
          </text>
        </svg>
      </div>
    </div>
  );
}
