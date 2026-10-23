import { useEffect, useRef, useState } from 'react';
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

function RestRing({ left, duration }: { left: number; duration: number }) {
  const R = 31;
  const C = 2 * Math.PI * R;
  const frac = duration ? left / duration : 0;
  return (
    <div className="rest-ring">
      <svg viewBox="0 0 76 76">
        <defs>
          <linearGradient id="restg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd84a" />
            <stop offset="1" stopColor="#e0a800" />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={R} className="rest-ring-track" />
        <circle cx="38" cy="38" r={R} className="rest-ring-fg" stroke="url(#restg)" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 38 38)" />
        <circle cx="38" cy="38" r={R - 7} className="rest-ring-in" />
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
            <span className="rest-info">
              <span className="rest-info-label">Отдых после {n} подхода</span>
              <span className="rest-info-total">{formatClock(rest.duration)}</span>
            </span>
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
