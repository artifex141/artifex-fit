import { useEffect, useId, useRef, useState } from 'react';
import type { WeightRule } from '../../program/types';
import { CheckIcon, NumRing } from '../kit';
import { formatClock } from './timer';

export interface SetValues {
  lb: number;
  reps: number;
  dropReps?: number;
}

export interface RestView {
  left: number;
  duration: number;
  paused: boolean;
  onToggle: () => void;
  onAdd: (sec: number) => void;
}

export interface SetRowProps {
  n: number;
  rule: WeightRule;
  step: number;
  withDrop: boolean;
  /** done — записан; active — следующий по очереди; future — ещё не дошли */
  status: 'done' | 'active' | 'future';
  suggest: { lb: number | null; reps: number };
  fact?: SetValues;
  rest?: RestView; // отдых после этого подхода идёт сейчас
  onSave: (v: SetValues) => void;
  onUndo: () => void;
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const fmt = (n: number) => String(Math.round(n * 10) / 10);


function Field({ label, value, onChange, step, disabled, decimal }: { label: string; value: string; onChange: (v: string) => void; step: number; disabled: boolean; decimal?: boolean }) {
  const bump = (d: number) => {
    const v = num(value) ?? 0;
    onChange(fmt(Math.max(0, v + d)));
  };
  return (
    <label className={disabled ? 'sfield off' : 'sfield'}>
      <span className="sfield-label">{label}</span>
      <span className="sfield-box">
        {disabled ? (
          <span className="sfield-empty">- -</span>
        ) : (
          <input inputMode={decimal ? 'decimal' : 'numeric'} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        <span className="sfield-arrows">
          <button type="button" tabIndex={-1} disabled={disabled} aria-label={`${label}: больше`} onClick={() => bump(step)}>
            <svg viewBox="0 0 12 8"><path d="M1 7l5-5 5 5" /></svg>
          </button>
          <button type="button" tabIndex={-1} disabled={disabled} aria-label={`${label}: меньше`} onClick={() => bump(-step)}>
            <svg viewBox="0 0 12 8"><path d="M1 1l5 5 5-5" /></svg>
          </button>
        </span>
      </span>
    </label>
  );
}

/** Кольцо отдыха как на макете: толстая светящаяся дуга со скруглёнными концами вокруг тёмного стеклянного диска. */
function RestRing({ left, duration }: { left: number; duration: number }) {
  const id = useId().replace(/:/g, '');
  const R = 44;
  const C = 2 * Math.PI * R;
  const frac = duration ? Math.max(0, Math.min(1, left / duration)) : 0;
  const arc = { strokeDasharray: C, strokeDashoffset: C * (1 - frac), transform: 'rotate(-90 52 52)' };
  return (
    <div className="rest-ring">
      <svg viewBox="0 0 104 104">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd84a" />
            <stop offset="1" stopColor="#f2b705" />
          </linearGradient>
          <radialGradient id={`d${id}`} cx="0.45" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#1f272f" />
            <stop offset="1" stopColor="#0c1115" />
          </radialGradient>
          <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>
        <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        {frac > 0 && <circle cx="52" cy="52" r={R} fill="none" stroke="#f5c518" strokeOpacity="0.55" strokeWidth="9" strokeLinecap="round" filter={`url(#f${id})`} {...arc} />}
        {frac > 0 && <circle cx="52" cy="52" r={R} fill="none" stroke={`url(#g${id})`} strokeWidth="9" strokeLinecap="round" {...arc} />}
        <circle cx="52" cy="52" r="34" fill={`url(#d${id})`} stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
      </svg>
      <span>{formatClock(left)}</span>
    </div>
  );
}

export function SetRow({ n, rule, step, withDrop, status, suggest, fact, rest, onSave, onUndo }: SetRowProps) {
  const init = fact ?? suggest;
  const [lb, setLb] = useState(init.lb === null ? '' : fmt(init.lb));
  const [reps, setReps] = useState(String(init.reps));
  const [drop, setDrop] = useState(fact?.dropReps === undefined ? '' : String(fact.dropReps));
  const [editing, setEditing] = useState(false);

  // Подставленный вес мог поменяться (после записи прошлого подхода) — обновляем, пока подход не записан.
  // Сразу после удаления подхода оставляем в полях записанные значения.
  const done = status === 'done';
  const wasDone = useRef(done);
  useEffect(() => {
    const justUndone = wasDone.current && !done;
    wasDone.current = done;
    if (!done && !justUndone) setLb(suggest.lb === null ? '' : fmt(suggest.lb));
  }, [suggest.lb, done]);

  const lbN = num(lb);
  const repsN = num(reps);
  const dropN = num(drop);
  const valid = lbN !== null && repsN !== null && repsN > 0;
  const weightLabel = rule.kind === 'added' ? 'Доп. вес (lb)' : rule.kind === 'plates' ? 'На сторону (lb)' : 'Вес (lb)';
  const save = () => {
    if (!valid) return;
    setEditing(false);
    onSave({ lb: lbN!, reps: repsN!, ...(withDrop && dropN !== null ? { dropReps: dropN } : {}) });
  };

  if (done && fact && !editing) {
    const detail = `${fmt(fact.lb)} lb × ${fact.reps} повт.${fact.dropReps ? ` + дроп ${fact.dropReps}` : ''}`;
    return (
      <div className={rest ? 'srow done resting' : 'srow done'}>
        <button className="srow-main" aria-label={`Подход ${n}: изменить`} onClick={() => setEditing(true)}>
          <span className="snum-done">
            <CheckIcon />
          </span>
          <span className="srow-text">
            <span className="srow-title">Подход {n}</span>
            <span className="srow-sub">{detail}</span>
          </span>
        </button>
        {rest && (
          <>
            <RestRing left={rest.left} duration={rest.duration} />
            <button className="glass-btn add-btn" aria-label="Добавить 30 секунд" onClick={() => rest.onAdd(30)}>
              +30<small>с</small>
            </button>
            <button className="glass-btn accent pause" aria-label={rest.paused ? 'Продолжить отдых' : 'Пауза'} onClick={rest.onToggle}>
              {rest.paused ? (
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  const off = status === 'future' && !editing;
  return (
    <div className={`srow ${editing ? 'active' : status}`}>
      <NumRing n={n} active={!off} size={36} />
      <span className="srow-title fixed">Подход {n}</span>
      <div className="sfields">
        <Field label={weightLabel} value={lb} onChange={setLb} step={step} disabled={off} decimal />
        <Field label="Повторы" value={reps} onChange={setReps} step={1} disabled={off} />
        {withDrop && !off && <Field label="Дроп, повт." value={drop} onChange={setDrop} step={1} disabled={false} />}
      </div>
      <div className="srow-actions">
        <button className={off ? 'check-btn off' : 'check-btn'} disabled={off || !valid} aria-label="Записать подход" onClick={save}>
          <CheckIcon />
        </button>
        {editing && (
          <button
            className="undo-btn"
            aria-label="Удалить подход"
            onClick={() => {
              setEditing(false);
              onUndo();
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
