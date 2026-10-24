// Сводка дня: кольцо калорий, полосы белков/жиров/углеводов и четыре плитки — как на макете.
import type { ReactNode } from 'react';
import type { Macros } from '../../nutrition/calc';
import { DropIcon, FlameIcon, ProteinIcon, WheatIcon } from './icons';

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
export const macroLine = (m: Macros) => `${fmt(m.kcal)} ккал · Б ${fmt(m.p)} · Ж ${fmt(m.f)} · У ${fmt(m.c)}`;
const frac = (v: number, of: number | undefined) => (of ? Math.min(1, v / of) : 0);

function KcalRing({ eaten, target }: { eaten: number; target: number | undefined }) {
  const R = 122;
  const len = 2 * Math.PI * R;
  const dash = `${len * frac(eaten, target)} ${len}`;
  return (
    <div className="nt-ring" data-testid="nt-ring">
      <svg viewBox="0 0 270 270" aria-hidden="true">
        <defs>
          <linearGradient id="ntRingG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffdf3a" />
            <stop offset="1" stopColor="#f5c518" />
          </linearGradient>
          <filter id="ntRingF" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <circle cx="135" cy="135" r={R} className="nt-ring-track" />
        {eaten > 0 && (
          <>
            <circle cx="135" cy="135" r={R} className="nt-ring-arc" stroke="#f5c518" strokeOpacity="0.55" strokeDasharray={dash} filter="url(#ntRingF)" transform="rotate(-90 135 135)" />
            <circle cx="135" cy="135" r={R} className="nt-ring-arc" stroke="url(#ntRingG)" strokeDasharray={dash} transform="rotate(-90 135 135)" />
          </>
        )}
      </svg>
      <div className="nt-ring-text">
        <span className="nt-flame">
          <FlameIcon />
        </span>
        <b>{fmt(eaten)}</b>
        <span className="nt-of">из {target ? fmt(target) : '—'}</span>
        <span className="nt-unit">ккал</span>
      </div>
    </div>
  );
}

const MACROS: { key: 'p' | 'f' | 'c'; label: string; icon: ReactNode }[] = [
  { key: 'p', label: 'Белки', icon: <ProteinIcon /> },
  { key: 'f', label: 'Жиры', icon: <DropIcon /> },
  { key: 'c', label: 'Углеводы', icon: <WheatIcon /> },
];

export function Summary({ eaten, targets }: { eaten: Macros; targets: Macros | null }) {
  return (
    <>
      <section className="nt-card nt-summary">
        <KcalRing eaten={eaten.kcal} target={targets?.kcal} />
        <div className="nt-macros">
          {MACROS.map((m) => (
            <div key={m.key} className="nt-macro" data-testid={`nt-macro-${m.key}`}>
              <span className="nt-macro-icon">{m.icon}</span>
              <span className="nt-macro-main">
                <span className="nt-macro-label">
                  <span>{m.label}</span>
                  <span>
                    <b>{fmt(eaten[m.key])}</b> <em>/ {targets ? fmt(targets[m.key]) : '—'} г</em>
                  </span>
                </span>
                <span className="nt-bar">
                  <span style={{ width: `${frac(eaten[m.key], targets?.[m.key]) * 100}%` }} />
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="nt-tiles">
        {[
          { cls: 'kcal', icon: <FlameIcon />, value: fmt(eaten.kcal), label: 'Калории' },
          { cls: 'p', icon: <ProteinIcon />, value: `${fmt(eaten.p)} г`, label: 'Белки' },
          { cls: 'f', icon: <DropIcon />, value: `${fmt(eaten.f)} г`, label: 'Жиры' },
          { cls: 'c', icon: <WheatIcon />, value: `${fmt(eaten.c)} г`, label: 'Углеводы' },
        ].map((t) => (
          <div key={t.cls} className={`nt-tile ${t.cls}`}>
            <span className="nt-tile-icon">{t.icon}</span>
            <b>{t.value}</b>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
