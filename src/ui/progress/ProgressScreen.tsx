import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { EXERCISES } from '../../program/exercises';
import { change, periodStart, summary, weightSeries, type Period } from '../../program/stats';
import { EmptyBars, LineChart } from './LineChart';
import './progress.css';

const PERIODS: { id: Period; label: string; caption: string }[] = [
  { id: 'week', label: 'Неделя', caption: 'на этой неделе' },
  { id: 'month', label: 'Месяц', caption: 'в этом месяце' },
  { id: 'year', label: 'Год', caption: 'в этом году' },
];

const fmtNum = (n: number) => n.toLocaleString('ru-RU');
const Arrow = ({ up }: { up: boolean }) => <span className="arrow">{up ? '↗' : '↘'}</span>;

const I = {
  dumbbell: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  run: 'M13 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM8 21l3-6 3 3v3M6 11l3-3 4 1 2 3 3 1',
  moon: 'M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z',
};
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Chevron = () => (
  <span className="round-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </span>
);

function Tile({ icon, label, value, delta, caption }: { icon: string; label: string; value: React.ReactNode; delta?: React.ReactNode; caption: string }) {
  return (
    <div className="p-tile">
      <span className="p-tile-icon">
        <Icon d={icon} />
      </span>
      <span className="p-tile-label">{label}</span>
      <span className="p-tile-value">{value}</span>
      <span className="p-tile-delta">{delta ?? <span className="muted">—</span>}</span>
      <span className="p-tile-caption">{caption}</span>
    </div>
  );
}

function pctDelta(cur: number, prev: number) {
  const c = change(cur, prev);
  if (c.pct === null || c.abs === 0) return undefined;
  return (
    <>
      {c.pct > 0 ? '+' : ''}
      {c.pct}% <Arrow up={c.pct > 0} />
    </>
  );
}

export function ProgressScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const sets = useLiveQuery(() => db.sets.toArray(), [], []);
  const [picked, setPicked] = useState<string>('');

  const now = Date.now();
  const from = periodStart(period, now);
  const prevFrom = periodStart(period, from - 1);
  const s = summary(workouts, sets, from);
  const p = summary(workouts, sets, prevFrom, from);
  const caption = PERIODS.find((x) => x.id === period)!.caption;
  const countDelta = change(s.count, p.count).abs;

  const finishedIds = new Set(workouts.filter((w) => w.finishedAt !== undefined).map((w) => w.id));
  const logged = Object.values(EXERCISES).filter((e) => sets.some((x) => x.exerciseId === e.id && x.kind === 'work' && finishedIds.has(x.workoutId)));
  const exerciseId = picked && logged.some((e) => e.id === picked) ? picked : logged[0]?.id;
  const series = exerciseId ? weightSeries(exerciseId, workouts, sets) : [];
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <div className="screen progress">
      <header className="p-head">
        <h1 className="screen-title">Прогресс</h1>
        <div className="segmented">
          {PERIODS.map((x) => (
            <button key={x.id} className={x.id === period ? 'on' : ''} onClick={() => setPeriod(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-tiles">
        <Tile
          icon={I.dumbbell}
          label="Тренировки"
          value={s.count}
          delta={countDelta ? <>{countDelta > 0 ? '+' : ''}{countDelta} <Arrow up={countDelta > 0} /></> : undefined}
          caption={caption}
        />
        <Tile icon={I.flame} label="Калории" value="--" caption="в среднем / день" />
        <Tile
          icon={I.timer}
          label="Время"
          value={
            <>
              {Math.floor(s.minutes / 60)}
              <small>ч</small> {s.minutes % 60}
              <small>м</small>
            </>
          }
          delta={pctDelta(s.minutes, p.minutes)}
          caption={caption}
        />
        <Tile icon={I.trend} label="Общий тоннаж" value={<>{fmtNum(s.tonnage)} <small>lb</small></>} delta={pctDelta(s.tonnage, p.tonnage)} caption={caption} />
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <span className="p-card-title">Вес</span>
          <Chevron />
        </div>
        <div className="p-split">
          <div className="p-big">
            <span className="p-big-value">
              -- <small>кг</small>
            </span>
            <span className="muted small">за 4 недели</span>
          </div>
          <LineChart points={[]} unit="кг" />
        </div>
      </section>

      <section className="p-card">
        <div className="p-card-head">
          <span className="p-card-title">Состав тела</span>
          <Chevron />
        </div>
        <div className="p-body">
          <div className="p-metrics">
            <div className="p-metric">
              <b>--%</b>
              <span>Жир</span>
            </div>
            <div className="p-metric">
              <b>-- кг</b>
              <span>Мышечная масса</span>
            </div>
          </div>
          <svg viewBox="0 0 60 120" className="p-figure" aria-hidden="true">
            <circle cx="30" cy="12" r="8" />
            <path d="M18 24h24l6 34-6 2-4-22v30l3 46h-8l-3-38-3 38h-8l3-46V38l-4 22-6-2z" />
          </svg>
          <div className="p-metrics">
            <div className="p-metric">
              <b>--%</b>
              <span>Вода</span>
            </div>
            <div className="p-metric">
              <b>-- кг</b>
              <span>Костная масса</span>
            </div>
          </div>
        </div>
      </section>

      <section className="p-card">
        <div className="p-card-head">
          <span className="p-card-title with-icon">
            <Icon d={I.heart} /> Пульс
          </span>
          <Chevron />
        </div>
        <div className="p-split">
          <div className="p-big">
            <span className="p-big-value">
              -- <small>bpm</small>
            </span>
            <span className="muted small">Средний пульс в покое</span>
          </div>
          <EmptyBars max={80} unit="" />
        </div>
      </section>

      <div className="p-pair">
        <section className="p-card">
          <div className="p-card-head">
            <span className="p-card-title with-icon">
              <Icon d={I.run} /> Активность
            </span>
          </div>
          <div className="p-activity">
            <div className="p-ring">
              <b>--</b>
              <span>шагов</span>
            </div>
            <div className="p-act-list muted small">
              <span>-- ккал</span>
              <span>-- этажей</span>
              <span>-- км</span>
            </div>
          </div>
        </section>
        <section className="p-card">
          <div className="p-card-head">
            <span className="p-card-title with-icon">
              <Icon d={I.moon} /> Сон
            </span>
            <span className="p-sleep">
              <b>--</b>
              <small>в среднем</small>
            </span>
          </div>
          <EmptyBars max={10} unit="ч" />
        </section>
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <span className="p-card-title">Рабочий вес</span>
        </div>
        {logged.length === 0 ? (
          <>
            <p className="muted small">Заверши первую тренировку — здесь появится график по каждому упражнению.</p>
            <LineChart points={[]} unit="lb" />
          </>
        ) : (
          <>
            <select className="field" value={exerciseId} onChange={(e) => setPicked(e.target.value)}>
              {logged.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="p-split">
              <div className="p-big">
                <span className="p-big-value">
                  {last?.lb ?? '--'} <small>lb</small>
                </span>
                {first && last && last.lb !== first.lb && (
                  <span className="p-tile-delta">
                    {last.lb > first.lb ? '+' : ''}
                    {Math.round((last.lb - first.lb) * 10) / 10} lb <Arrow up={last.lb > first.lb} />
                  </span>
                )}
              </div>
              <LineChart points={series} unit="lb" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
