import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { cachedBody, loadBody, metric, type BodyData } from '../../body/body';
import { db } from '../../db/db';
import { EXERCISES } from '../../program/exercises';
import { change, periodStart, summary, weightSeries, type Period } from '../../program/stats';
import { demoBodyWeight, demoDaily } from '../demo';
import { ChevronIcon } from '../kit';
import { AreaChart, BarChart } from './LineChart';
import './progress.css';

const PERIODS: { id: Period; label: string; caption: string }[] = [
  { id: 'week', label: 'Неделя', caption: 'на этой неделе' },
  { id: 'month', label: 'Месяц', caption: 'в этом месяце' },
  { id: 'year', label: 'Год', caption: 'в этом году' },
];

const fmtNum = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const DAY = 86_400_000;

const I = {
  dumbbell: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  timer: 'M12 8.5V13l2.5 1.5M10 2.5h4M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM18.5 6.5l1-1',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  run: 'M14 4.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM7 21l3.2-5.6 3 2.6V22M5 11.5l3.4-3.2 4.2.8 2 3 3.6 1M10.5 9l-1.8 6',
  flameO: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  stairs: 'M3 20h5v-5h5v-5h5V5h3',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
};
const Icon = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const More = () => (
  <span className="glass-btn p-more" aria-hidden="true">
    <ChevronIcon dir="right" />
  </span>
);
const Up = ({ up }: { up: boolean }) => <span className="arrow">{up ? '↗' : '↘'}</span>;

function Tile({ icon, label, value, delta, caption }: { icon: string; label: string; value: React.ReactNode; delta?: React.ReactNode; caption: string }) {
  return (
    <div className="p-tile">
      <Icon d={icon} className="p-tile-icon" />
      <span className="p-tile-label">{label}</span>
      <span className="p-tile-value">{value}</span>
      <span className="p-tile-delta">{delta ?? ' '}</span>
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
      {c.pct}% <Up up={c.pct > 0} />
    </>
  );
}

function Metric({ value, unit, label, delta, up }: { value: string; unit: string; label: string; delta: string; up: boolean }) {
  return (
    <div className="p-metric">
      <span className="p-metric-value">
        {value}
        <small>{unit}</small>
      </span>
      <span className="p-metric-row">
        <span className="p-metric-label">{label}</span>
        {delta && (
          <span className="p-metric-delta">
            {up ? '↑' : '↘'} {delta}
          </span>
        )}
      </span>
    </div>
  );
}

export function ProgressScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const sets = useLiveQuery(() => db.sets.toArray(), [], []);
  const [picked, setPicked] = useState<string>('');
  const [bodyData, setBodyData] = useState<BodyData>(cachedBody);
  useEffect(() => {
    void loadBody().then(setBodyData);
  }, []);

  const now = Date.now();
  const from = periodStart(period, now);
  const prevFrom = periodStart(period, from - 1);
  const s = summary(workouts, sets, from);
  const p = summary(workouts, sets, prevFrom, from);
  const caption = PERIODS.find((x) => x.id === period)!.caption;
  const countDelta = change(s.count, p.count).abs;

  // Вес и жир — из Zepp Life (через Health и «Команды»), если пришли; иначе демо.
  const weight = metric(bodyData.weight, now);
  const fat = metric(bodyData.bodyFat, now);
  const body = weight && weight.series.length > 0 ? weight.series : demoBodyWeight(now);
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  const rhr = demoDaily(30, 64, 9, 11).map((v, i) => ({ date: now - (29 - i) * DAY, lb: v }));
  rhr[rhr.length - 1].lb = 62;
  const sleepDeep = demoDaily(30, 5.2, 3, 5);
  const sleepTotal = demoDaily(30, 7.4, 2.6, 9);

  const finishedIds = new Set(workouts.filter((w) => w.finishedAt !== undefined).map((w) => w.id));
  const logged = Object.values(EXERCISES).filter((e) => sets.some((x) => x.exerciseId === e.id && x.kind === 'work' && finishedIds.has(x.workoutId)));
  const exerciseId = picked && logged.some((e) => e.id === picked) ? picked : logged[0]?.id;
  const series = exerciseId ? weightSeries(exerciseId, workouts, sets) : [];
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <div className="screen progress">
      <header className="p-head">
        <h1 className="p-title">Прогресс</h1>
        <div className="segmented">
          {PERIODS.map((x) => (
            <button key={x.id} className={x.id === period ? 'on' : ''} onClick={() => setPeriod(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button className="glass-btn p-menu" aria-label="Меню">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </header>

      <div className="p-tiles">
        <Tile
          icon={I.dumbbell}
          label="Тренировки"
          value={s.count}
          delta={countDelta ? <>{countDelta > 0 ? '+' : ''}{countDelta} <Up up={countDelta > 0} /></> : undefined}
          caption={caption}
        />
        <Tile icon={I.flame} label="Калории" value="2 450" delta={<>+12% <Up up /></>} caption="в среднем / день" />
        <Tile
          icon={I.timer}
          label="Время"
          value={
            <>
              {Math.floor(s.minutes / 60)}
              <small> ч </small>
              {s.minutes % 60}
              <small>м</small>
            </>
          }
          delta={pctDelta(s.minutes, p.minutes)}
          caption={caption}
        />
        <Tile icon={I.trend} label="Общий тоннаж" value={<>{fmtNum(s.tonnage)}<small> lb</small></>} delta={pctDelta(s.tonnage, p.tonnage)} caption={caption} />
      </div>

      <section className="p-card p-weight">
        <div className="p-card-head">
          <span className="p-card-title">Вес</span>
          <More />
        </div>
        <div className="p-split">
          <div className="p-big">
            <span className="p-big-value">
              {weight ? weight.value : 80.2}
              <small> кг</small>
            </span>
            {weight ? (
              weight.delta !== null && (
                <span className="p-big-delta">
                  {sign(weight.delta)} кг <Up up={weight.delta > 0} />
                </span>
              )
            ) : (
              <span className="p-big-delta">
                -1.4 кг <Up up={false} />
              </span>
            )}
            <span className="p-big-caption">за 4 недели</span>
          </div>
          <AreaChart points={body} unit="кг" ticks={weight ? undefined : [84, 82, 80, 78]} dateTicks={5} />
        </div>
      </section>

      <section className="p-card p-body">
        <div className="p-card-head">
          <span className="p-card-title">Состав тела</span>
          <More />
        </div>
        <div className="p-body-grid">
          <div className="p-metrics">
            {fat ? (
              <Metric value={String(fat.value)} unit="%" label="Жир" delta={fat.delta !== null ? `${sign(fat.delta)}%` : ''} up={(fat.delta ?? 0) > 0} />
            ) : (
              <Metric value="15.2" unit="%" label="Жир" delta="-2.1%" up={false} />
            )}
            <Metric value="72.0" unit=" кг" label="Мышечная масса" delta="+1.8 кг" up />
          </div>
          <img className="p-figure" src={`${import.meta.env.BASE_URL}ui/body-figure.webp`} alt="" />
          <div className="p-metrics">
            <Metric value="58.4" unit="%" label="Вода" delta="+1.2%" up />
            <Metric value="3.1" unit=" кг" label="Костная масса" delta="+0.1 кг" up />
          </div>
        </div>
      </section>

      <section className="p-card p-pulse">
        <div className="p-card-head">
          <span className="p-card-title with-icon">
            <svg viewBox="0 0 24 24" className="p-heart">
              <path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 6.1-8 11-8 11z" fill="currentColor" />
            </svg>
            Пульс
          </span>
          <More />
        </div>
        <div className="p-split">
          <div className="p-subbox">
            <span className="glass-btn p-dots" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="6" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="18" cy="12" r="1.6" />
              </svg>
            </span>
            <span className="p-big-value">
              62<small> bpm</small>
            </span>
            <span className="p-big-caption">Средний пульс в покое</span>
            <span className="p-big-delta">
              <Up up={false} /> -6 bpm
            </span>
          </div>
          <BarChart values={rhr} unit="bpm" ticks={[80, 70, 60, 50]} />
        </div>
      </section>

      <div className="p-pair">
        <section className="p-card p-activity">
          <div className="p-card-head">
            <span className="p-card-title with-icon">
              <Icon d={I.run} className="p-head-icon" /> Активность
            </span>
            <More />
          </div>
          <div className="p-activity-body">
            <div className="p-ring">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="43" className="p-ring-track" />
                <circle cx="50" cy="50" r="43" className="p-ring-arc" strokeDasharray={2 * Math.PI * 43} strokeDashoffset={2 * Math.PI * 43 * 0.18} transform="rotate(-90 50 50)" />
              </svg>
              <span className="p-ring-text">
                <b>8 420</b>
                <span>шагов</span>
              </span>
            </div>
            <div className="p-act-list">
              <span>
                <Icon d={I.flameO} /> <b>620</b> ккал
              </span>
              <span>
                <Icon d={I.stairs} /> <b>12</b> этажей
              </span>
              <span>
                <Icon d={I.pin} /> <b>5.8</b> км
              </span>
            </div>
          </div>
        </section>
        <section className="p-card p-sleep">
          <div className="p-card-head">
            <span className="p-card-title with-icon">
              <svg viewBox="0 0 24 24" className="p-head-icon">
                <path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z" fill="#c7d2e0" />
              </svg>
              Сон
            </span>
            <span className="p-sleep-avg">
              <b>
                7<small> ч </small>28<small> м</small>
              </b>
              <span>в среднем</span>
            </span>
            <More />
          </div>
          <BarChart values={sleepTotal.map((v, i) => ({ date: now - (29 - i) * DAY, lb: v }))} inner={sleepDeep} unit="ч" ticks={[10, 5, 0]} sleep />
        </section>
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <span className="p-card-title">Рабочий вес</span>
        </div>
        {logged.length === 0 ? (
          <p className="p-big-caption">Заверши первую тренировку — здесь появится график по каждому упражнению.</p>
        ) : (
          <>
            <select className="field p-select" value={exerciseId} onChange={(e) => setPicked(e.target.value)}>
              {logged.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="p-split">
              <div className="p-big">
                <span className="p-big-value">
                  {last?.lb ?? '--'}
                  <small> lb</small>
                </span>
                {first && last && last.lb !== first.lb && (
                  <span className="p-big-delta">
                    {last.lb > first.lb ? '+' : ''}
                    {Math.round((last.lb - first.lb) * 10) / 10} lb <Up up={last.lb > first.lb} />
                  </span>
                )}
                <span className="p-big-caption">за всё время</span>
              </div>
              <AreaChart points={series} unit="lb" dateTicks={Math.min(5, series.length)} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
