import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteSet, finishWorkout, getCycleConfig, getOpenWorkout, getPosition, saveSet, startWorkout, type Position } from '../../db/repo';
import { DAYS } from '../../program/program';
import { dayInfo } from '../../program/schedule';
import { targetFor } from '../../program/weights';
import { useNow } from '../useNow';
import { ExerciseCard } from './ExerciseCard';
import { RestTimer, useRestTimer } from './RestTimer';
import { formatClock } from './timer';
import type { SetValues } from './SetRow';
import './workout.css';

const REST_WORK = 120;
const REST_WARMUP = 60;

interface Summary {
  minutes: number;
  sets: number;
  next: Position;
}

function Clock({ since }: { since: number }) {
  const now = useNow(1000);
  return <>{formatClock(Math.max(0, (now - since) / 1000))}</>;
}

export function WorkoutScreen({ onCycleEnd }: { onCycleEnd?: (cycle: number) => void }) {
  const position = useLiveQuery(getPosition);
  const open = useLiveQuery(async () => (await getOpenWorkout()) ?? null);
  const allSets = useLiveQuery(() => db.sets.toArray(), [], []);
  const at: Position | undefined = open ?? position;
  const cfg = useLiveQuery(() => (at ? getCycleConfig(at.cycle) : undefined), [at?.cycle]);
  const rest = useRestTimer();
  const [openId, setOpenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  if (!at || open === undefined || !cfg) return <div className="screen" />;

  const { week, type, rir } = dayInfo(at.day);
  const day = DAYS[type];
  const log = allSets.filter((s) => s.cycle === at.cycle);
  const current = open ? allSets.filter((s) => s.workoutId === open.id) : [];
  const workDone = current.filter((s) => s.kind === 'work').length;
  const workTotal = day.exercises.reduce((n, e) => n + e.weeks[week - 1].sets, 0);
  const firstOpen = day.exercises.find((e) => current.filter((s) => s.exerciseId === e.exerciseId && s.kind === 'work').length < e.weeks[week - 1].sets);
  const expandedId = openId ?? firstOpen?.exerciseId ?? null;

  const save = async (exerciseId: string, kind: 'warmup' | 'work', index: number, v: SetValues) => {
    if (!open?.id) return;
    await saveSet({ workoutId: open.id, cycle: open.cycle, day: open.day, exerciseId, kind, index, ...v });
    rest.start(kind === 'work' ? REST_WORK : REST_WARMUP);
  };

  const undo = async (exerciseId: string, kind: 'warmup' | 'work', index: number) => {
    if (open?.id) await deleteSet(open.id, exerciseId, kind, index);
  };

  const finish = async () => {
    if (!open?.id) return;
    if (workDone < workTotal && !confirm(`Сделано ${workDone} из ${workTotal} подходов. Завершить тренировку?`)) return;
    const next = await finishWorkout(open.id);
    rest.stop();
    setOpenId(null);
    setSummary({ minutes: Math.round((Date.now() - open.startedAt) / 60000), sets: workDone, next });
  };

  if (summary) {
    const n = dayInfo(summary.next.day);
    return (
      <div className="screen">
        <h1 className="screen-title">Готово 💪</h1>
        <p className="screen-sub">Тренировка записана</p>
        <div className="summary-grid">
          <div className="card">
            <div className="muted">Время</div>
            <div className="big">{summary.minutes} мин</div>
          </div>
          <div className="card">
            <div className="muted">Рабочих подходов</div>
            <div className="big">{summary.sets}</div>
          </div>
        </div>
        <p className="muted">
          Следующая: день {summary.next.day} · неделя {n.week} · «{n.type}»{summary.next.cycle !== open?.cycle ? ` · цикл ${summary.next.cycle}` : ''}
        </p>
        <button
          className="btn primary block"
          onClick={() => {
            setSummary(null);
            if (summary.next.day === 1 && summary.next.cycle > 1) onCycleEnd?.(summary.next.cycle - 1);
          }}
        >
          Ок
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row workout-top">
        <div>
          <h1 className="screen-title">Тренировка</h1>
          <p className="screen-sub">
            День {at.day} · «{type}»: {day.title}
          </p>
        </div>
        <div className="spacer" />
        {open && (
          <div className="stopwatch">
            <span className="stopwatch-time">
              <Clock since={open.startedAt} />
            </span>
            <span className="stopwatch-label">время</span>
          </div>
        )}
      </div>

      <div className="chips week-chips">
        <span className="chip on">Неделя {week}{week === 5 ? ' · разгрузка' : ''}</span>
        <span className="chip">Запас {rir}</span>
        {at.cycle > 1 && <span className="chip">Цикл {at.cycle}</span>}
        {open && (
          <span className="chip">
            {workDone}/{workTotal} подходов
          </span>
        )}
      </div>

      {!open && (
        <button className="btn primary block start-btn" onClick={() => startWorkout(at)}>
          Начать тренировку
        </button>
      )}

      <div className="stack">
        {day.exercises.map((pe, i) => (
          <ExerciseCard
            key={pe.exerciseId}
            n={i + 1}
            pe={pe}
            week={week}
            target={targetFor(pe.exerciseId, week, at.cycle, log, cfg)}
            sets={current.filter((s) => s.exerciseId === pe.exerciseId)}
            active={!!open}
            expanded={expandedId === pe.exerciseId}
            onToggle={() => setOpenId(expandedId === pe.exerciseId ? '' : pe.exerciseId)}
            onSave={(kind, index, v) => save(pe.exerciseId, kind, index, v)}
            onUndo={(kind, index) => undo(pe.exerciseId, kind, index)}
          />
        ))}
      </div>

      {open && (
        <button className="btn block finish-btn" onClick={finish}>
          Завершить тренировку
        </button>
      )}

      <RestTimer state={rest.state} onStop={rest.stop} onAdd={rest.add} />
    </div>
  );
}
