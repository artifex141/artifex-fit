import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../db/db';
import {
  deleteSet,
  discardWorkout,
  finishWorkout,
  getCycleConfig,
  getOpenWorkout,
  getPendingCycleEnd,
  getPosition,
  saveSet,
  startWorkout,
  type Position,
} from '../../db/repo';
import { EXERCISES } from '../../program/exercises';
import { DAYS } from '../../program/program';
import { afterSet } from '../../program/flow';
import { dayInfo } from '../../program/schedule';
import { summary as statsSummary } from '../../program/stats';
import type { DayType } from '../../program/types';
import { targetFor } from '../../program/weights';
import { Overlay } from '../kit';
import { useNow } from '../useNow';
import { ExerciseCard, ExerciseRow } from './ExerciseCard';
import { useRestTimer } from './RestTimer';
import type { SetValues } from './SetRow';
import { formatHMS } from './timer';
import './workout.css';

const REST_WORK = 120;
const SHORT: Record<DayType, string> = { A: 'Верх груди', B: 'Плечи • Ноги', C: 'Грудь • Спина' };

interface Summary {
  minutes: number;
  sets: number;
  tonnage: number;
  cycle: number;
  cycleEnd: boolean;
  next: Position;
}

type Sheet = null | 'finish' | 'menu' | 'notStarted';

function Clock({ since }: { since: number | null }) {
  const now = useNow(1000);
  return <>{formatHMS(since === null ? 0 : (now - since) / 1000)}</>;
}

function SheetView({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <Overlay>
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog card stack" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

export function WorkoutScreen({ onCycleEnd }: { onCycleEnd?: (cycle: number) => void }) {
  const position = useLiveQuery(getPosition);
  const open = useLiveQuery(async () => (await getOpenWorkout()) ?? null);
  const pendingEnd = useLiveQuery(getPendingCycleEnd);
  const allSets = useLiveQuery(() => db.sets.toArray(), [], []);
  const at: Position | undefined = open ?? position;
  const cfg = useLiveQuery(() => (at ? getCycleConfig(at.cycle) : undefined), [at?.cycle]);
  const rest = useRestTimer();
  const [openId, setOpenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const info = at ? dayInfo(at.day) : null;
  const targets = useMemo(() => {
    if (!at || !info || !cfg) return {};
    const log = allSets.filter((s) => s.cycle === at.cycle);
    return Object.fromEntries(DAYS[info.type].exercises.map((pe) => [pe.exerciseId, targetFor(pe.exerciseId, info.week, at.cycle, log, cfg)]));
  }, [allSets, cfg, at?.cycle, at?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // При открытии — сразу к текущему упражнению; при смене упражнения — плавная прокрутка к нему.
  const ready = !!(at && info && open !== undefined && pendingEnd !== undefined && cfg);
  const firstScroll = useRef(true);
  useEffect(() => {
    if (!ready || summary) return;
    const el = document.querySelector<HTMLElement>('.ex-card');
    if (!el) return;
    if (firstScroll.current) {
      firstScroll.current = false;
      if (Number(el.dataset.index) > 0) el.scrollIntoView({ block: 'start' });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ready, openId, summary]);

  if (!at || !info || open === undefined || pendingEnd === undefined || !cfg) return <div className="screen" />;

  const { week, type, rir } = info;
  const day = DAYS[type];
  const current = open ? allSets.filter((s) => s.workoutId === open.id && s.kind === 'work') : [];
  const workDone = current.length;
  const workTotal = day.exercises.reduce((n, e) => n + e.weeks[week - 1].sets, 0);
  const doneOf = (id: string) => current.filter((s) => s.exerciseId === id).length;
  const isDone = (pe: (typeof day.exercises)[number]) => doneOf(pe.exerciseId) >= pe.weeks[week - 1].sets;
  const expandedId = openId ?? day.exercises.find((e) => !isDone(e))?.exerciseId ?? day.exercises[day.exercises.length - 1].exerciseId;
  const expandedIdx = day.exercises.findIndex((e) => e.exerciseId === expandedId);

  const save = async (exerciseId: string, index: number, v: SetValues) => {
    // Таймер и разблокировку звука — до первого await: iOS разрешает звук только внутри нажатия.
    const pe = day.exercises.find((e) => e.exerciseId === exerciseId)!;
    const total = pe.weeks[week - 1].sets;
    const name = EXERCISES[exerciseId].name;
    const nextEx = day.exercises[day.exercises.indexOf(pe) + 1];
    const label =
      index + 1 < total
        ? `${name}: подход ${index + 2} из ${total}`
        : nextEx
          ? `Дальше: ${EXERCISES[nextEx.exerciseId].name}`
          : 'Последнее упражнение сделано';
    rest.start(`${exerciseId}:${index}`, REST_WORK, label);
    const isNew = !current.some((s) => s.exerciseId === exerciseId && s.index === index);
    const doneBefore: Record<string, number> = {};
    for (const s of current) if (!(s.exerciseId === exerciseId && s.index === index)) doneBefore[s.exerciseId] = (doneBefore[s.exerciseId] ?? 0) + 1;
    const workoutId = open?.id ?? (await startWorkout(at));
    await saveSet({ workoutId, cycle: at.cycle, day: at.day, exerciseId, kind: 'work', index, ...v });
    if (!isNew) return;
    const next = afterSet(day.exercises, week, doneBefore, exerciseId, index);
    if (next.kind === 'open') setOpenId(next.exerciseId);
    if (next.kind === 'finish') setSheet('finish');
  };

  const undo = async (exerciseId: string, index: number) => {
    if (rest.state?.setKey === `${exerciseId}:${index}`) rest.stop();
    if (open?.id) await deleteSet(open.id, exerciseId, 'work', index);
  };

  const finish = async () => {
    if (!open?.id) return;
    setSheet(null);
    const { next, cycleEnd } = await finishWorkout(open.id);
    rest.stop();
    setOpenId(null);
    const tonnage = statsSummary([{ ...open, finishedAt: Date.now() }], current, 0).tonnage;
    setSummary({ minutes: Math.round((Date.now() - open.startedAt) / 60000), sets: workDone, tonnage, cycle: open.cycle, cycleEnd, next });
  };

  const cancel = async () => {
    if (!open?.id) return;
    setSheet(null);
    rest.stop();
    setOpenId(null);
    await discardWorkout(open.id);
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
          <div className="card wide">
            <div className="muted">Тоннаж</div>
            <div className="big">{summary.tonnage.toLocaleString('ru-RU')} lb</div>
          </div>
        </div>
        <p className="muted">
          {summary.cycleEnd
            ? `Цикл ${summary.cycle} завершён! Осталось выбрать, с каких весов начать цикл ${summary.next.cycle}.`
            : `Следующая: день ${summary.next.day} · неделя ${n.week} · «${n.type}»`}
        </p>
        <button
          className="btn primary block"
          onClick={() => {
            setSummary(null);
            if (summary.cycleEnd) onCycleEnd?.(summary.cycle);
          }}
        >
          Ок
        </button>
      </div>
    );
  }

  if (pendingEnd !== null && !open) {
    return (
      <div className="screen">
        <h1 className="screen-title">Тренировка</h1>
        <div className="card stack">
          <h2 className="card-title">Цикл {pendingEnd} завершён 🎉</h2>
          <p className="muted">Выбери, с каких весов начать цикл {pendingEnd + 1}.</p>
          <button className="btn primary block" onClick={() => onCycleEnd?.(pendingEnd)}>
            Выбрать веса нового цикла
          </button>
        </div>
      </div>
    );
  }

  const rowsGroup = (from: number, to: number) => {
    const items = day.exercises.slice(from, to);
    if (items.length === 0) return null;
    return (
      <div className={from === 0 ? 'ex-list before' : 'ex-list after'}>
        {items.map((pe, i) => (
          <ExerciseRow key={pe.exerciseId} n={from + i + 1} pe={pe} done={isDone(pe)} onOpen={() => setOpenId(pe.exerciseId)} />
        ))}
      </div>
    );
  };

  const expanded = day.exercises[expandedIdx];
  const restIdx = rest.state?.setKey.startsWith(`${expanded.exerciseId}:`) ? Number(rest.state.setKey.split(':')[1]) : null;
  const restView = rest.state
    ? { left: rest.left, duration: rest.state.duration, paused: rest.state.pausedLeft !== undefined, onToggle: rest.toggle, onAdd: rest.add }
    : null;
  const [restEx, restSet] = rest.state ? rest.state.setKey.split(':') : ['', ''];
  const carriedRest =
    restView && restIdx === null && EXERCISES[restEx] ? { title: `после: ${EXERCISES[restEx].name}, подход ${Number(restSet) + 1}`, view: restView } : null;

  return (
    <div className="screen workout">
      <header className="w-head">
        <div className="w-titles">
          <h1 className="screen-title">Тренировка</h1>
          <p className="w-sub">
            {SHORT[type]} • День {at.day}
          </p>
        </div>
        <button className="w-clock" onClick={() => setSheet(open ? 'finish' : 'notStarted')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="7.5" />
            <path d="M12 9.5V13l2.5 1.5M4.5 5.5l2.5-2M19.5 5.5l-2.5-2M7 19.5l-1.5 1.5M17 19.5l1.5 1.5" />
          </svg>
          <span>
            <span className="w-clock-time">
              <Clock since={open ? open.startedAt : null} />
            </span>
            <span className="w-clock-label">Время тренировки</span>
          </span>
        </button>
        <button className="glass-btn menu-btn" aria-label="Меню" onClick={() => setSheet('menu')}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </header>

      {rowsGroup(0, expandedIdx)}
      <ExerciseCard
        key={expanded.exerciseId}
        n={expandedIdx + 1}
        pe={expanded}
        week={week}
        target={targets[expanded.exerciseId]}
        sets={current.filter((s) => s.exerciseId === expanded.exerciseId)}
        rest={restIdx !== null && restView ? { setIndex: restIdx, view: restView } : null}
        carriedRest={carriedRest}
        index={expandedIdx}
        onCollapse={() => {
          const next = day.exercises.find((e, i) => i > expandedIdx && !isDone(e)) ?? day.exercises.find((e) => !isDone(e) && e !== expanded);
          setOpenId(next ? next.exerciseId : expanded.exerciseId);
        }}
        onSave={(i, v) => save(expanded.exerciseId, i, v)}
        onUndo={(i) => undo(expanded.exerciseId, i)}
      />
      {rowsGroup(expandedIdx + 1, day.exercises.length)}

      {sheet === 'finish' && (
        <SheetView onClose={() => setSheet(null)}>
          <h2 className="card-title">{workDone >= workTotal ? 'Все подходы сделаны 💪' : 'Завершить тренировку?'}</h2>
          <p className="muted">
            {workDone >= workTotal ? 'Завершить тренировку и сохранить результат?' : `Сделано ${workDone} из ${workTotal} подходов.`}
          </p>
          <button className="btn primary block" onClick={finish}>
            Завершить
          </button>
          {workDone === 0 && (
            <button className="btn block" onClick={cancel}>
              Отменить тренировку
            </button>
          )}
          <button className="btn block" onClick={() => setSheet(null)}>
            Продолжить
          </button>
        </SheetView>
      )}
      {sheet === 'notStarted' && (
        <SheetView onClose={() => setSheet(null)}>
          <h2 className="card-title">Тренировка ещё не началась</h2>
          <p className="muted">Время пойдёт с первой отмеченной галочки.</p>
          <button className="btn primary block" onClick={() => setSheet(null)}>
            Понятно
          </button>
        </SheetView>
      )}
      {sheet === 'menu' && (
        <SheetView onClose={() => setSheet(null)}>
          <h2 className="card-title">
            День {at.day} · «{type}»
          </h2>
          <p className="muted">
            {day.title}
            <br />
            Неделя {week}
            {week === 5 ? ' (разгрузка)' : ''} · запас {rir} повт.{at.cycle > 1 ? ` · цикл ${at.cycle}` : ''}
          </p>
          {open && workDone === 0 && (
            <button className="btn block" onClick={cancel}>
              Отменить тренировку
            </button>
          )}
          <button className="btn block" onClick={() => setSheet(null)}>
            Закрыть
          </button>
        </SheetView>
      )}
    </div>
  );
}
