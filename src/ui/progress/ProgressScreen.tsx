import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { EXERCISES } from '../../program/exercises';
import { periodStart, summary, weightSeries, type Period } from '../../program/stats';
import { LineChart } from './LineChart';
import './progress.css';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
];

const fmtNum = (n: number) => n.toLocaleString('ru-RU');

export function ProgressScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const sets = useLiveQuery(() => db.sets.toArray(), [], []);
  const [picked, setPicked] = useState<string>('');

  const s = summary(workouts, sets, periodStart(period, Date.now()));
  const finishedIds = new Set(workouts.filter((w) => w.finishedAt !== undefined).map((w) => w.id));
  const logged = Object.values(EXERCISES).filter((e) => sets.some((x) => x.exerciseId === e.id && x.kind === 'work' && finishedIds.has(x.workoutId)));
  const exerciseId = picked && logged.some((e) => e.id === picked) ? picked : logged[0]?.id;
  const series = exerciseId ? weightSeries(exerciseId, workouts, sets) : [];
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <div className="screen">
      <h1 className="screen-title">Прогресс</h1>
      <div className="row">
        <div className="segmented">
          {PERIODS.map((p) => (
            <button key={p.id} className={p.id === period ? 'on' : ''} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiles">
        <div className="card tile">
          <div className="tile-label">Тренировки</div>
          <div className="tile-value">{s.count}</div>
        </div>
        <div className="card tile">
          <div className="tile-label">Время</div>
          <div className="tile-value">
            {Math.floor(s.minutes / 60)}
            <small>ч</small> {s.minutes % 60}
            <small>м</small>
          </div>
        </div>
        <div className="card tile wide">
          <div className="tile-label">Общий тоннаж</div>
          <div className="tile-value">
            {fmtNum(s.tonnage)} <small>lb</small>
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 className="card-title">Рабочий вес</h2>
        </div>
        {logged.length === 0 ? (
          <p className="muted">Пока нет записей. Заверши первую тренировку — здесь появится график.</p>
        ) : (
          <>
            <select className="field" value={exerciseId} onChange={(e) => setPicked(e.target.value)}>
              {logged.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {last && (
              <div className="row">
                <span className="tile-value">
                  {last.lb} <small>lb</small>
                </span>
                {first && last.lb !== first.lb && (
                  <span className={last.lb > first.lb ? 'delta up' : 'delta down'}>
                    {last.lb > first.lb ? '↑ +' : '↓ '}
                    {Math.round((last.lb - first.lb) * 10) / 10} lb
                  </span>
                )}
              </div>
            )}
            {series.length > 0 && <LineChart points={series} />}
          </>
        )}
      </div>
    </div>
  );
}
