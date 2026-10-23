import { useEffect, useState } from 'react';
import type { WeightRule } from '../../program/types';

export interface SetValues {
  lb: number;
  reps: number;
  dropReps?: number;
}

interface Props {
  n: number;
  rule: WeightRule;
  step: number;
  initial: { lb: number | null; reps: number; dropReps?: number };
  done: boolean;
  withDrop: boolean;
  disabled: boolean;
  onSave: (v: SetValues) => void;
  onUndo: () => void;
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

function Stepper({ value, onChange, step, label, decimal }: { value: string; onChange: (v: string) => void; step: number; label: string; decimal?: boolean }) {
  const bump = (d: number) => {
    const v = num(value) ?? 0;
    onChange(String(Math.max(0, Math.round((v + d) * 10) / 10)));
  };
  return (
    <label className="stepper">
      <span className="stepper-label">{label}</span>
      <span className="stepper-box">
        <button type="button" aria-label="меньше" onClick={() => bump(-step)}>−</button>
        <input inputMode={decimal ? 'decimal' : 'numeric'} value={value} placeholder="–" onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-label="больше" onClick={() => bump(step)}>+</button>
      </span>
    </label>
  );
}

export function SetRow({ n, rule, step, initial, done, withDrop, disabled, onSave, onUndo }: Props) {
  const [lb, setLb] = useState(initial.lb === null ? '' : String(initial.lb));
  const [reps, setReps] = useState(String(initial.reps));
  const [drop, setDrop] = useState(initial.dropReps === undefined ? '' : String(initial.dropReps));

  // Подставленный вес мог поменяться (например, после записи прошлого подхода) — обновляем, пока подход не выполнен.
  useEffect(() => {
    if (!done) setLb(initial.lb === null ? '' : String(initial.lb));
  }, [initial.lb, done]);

  const lbN = num(lb);
  const repsN = num(reps);
  const dropN = num(drop);
  const changed = done && (lbN !== initial.lb || repsN !== initial.reps || (withDrop && (dropN ?? undefined) !== initial.dropReps));
  const valid = lbN !== null && repsN !== null && repsN > 0;

  const weightLabel = rule.kind === 'added' ? 'Доп. вес (lb)' : rule.kind === 'plates' ? 'На сторону (lb)' : 'Вес (lb)';

  const press = () => {
    if (done && !changed) return onUndo();
    if (!valid) return;
    onSave({ lb: lbN!, reps: repsN!, ...(withDrop && dropN !== null ? { dropReps: dropN } : {}) });
  };

  return (
    <div className={done ? 'set-row done' : 'set-row'}>
      <div className="set-n">{n}</div>
      <div className="set-fields">
        <Stepper value={lb} onChange={setLb} step={step} label={weightLabel} decimal />
        <Stepper value={reps} onChange={setReps} step={1} label="Повторы" />
        {withDrop && <Stepper value={drop} onChange={setDrop} step={1} label="Дроп, повт." />}
      </div>
      <button
        className={done && !changed ? 'set-check on' : 'set-check'}
        disabled={disabled || (!valid && !done)}
        onClick={press}
        aria-label={done && !changed ? 'Отменить подход' : 'Записать подход'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </button>
    </div>
  );
}
