import { stepFor, warmupFor } from '../../program/program';
import { EXERCISES } from '../../program/exercises';
import type { ProgramExercise, Week } from '../../program/types';
import { formatWeight, type Target } from '../../program/weights';
import type { SetRow as SetRecord } from '../../db/repo';
import { ExerciseImage } from './ExerciseImage';
import { SetRow, type SetValues } from './SetRow';

interface Props {
  n: number;
  pe: ProgramExercise;
  week: Week;
  target: Target;
  sets: SetRecord[]; // записи этого упражнения в текущей тренировке
  active: boolean; // тренировка начата
  expanded: boolean;
  onToggle: () => void;
  onSave: (kind: 'warmup' | 'work', index: number, v: SetValues) => void;
  onUndo: (kind: 'warmup' | 'work', index: number) => void;
}

export function ExerciseCard({ n, pe, week, target, sets, active, expanded, onToggle, onSave, onUndo }: Props) {
  const ex = EXERCISES[pe.exerciseId];
  const p = pe.weeks[week - 1];
  const work = sets.filter((s) => s.kind === 'work');
  const doneCount = work.length;
  const complete = doneCount >= p.sets;
  const reps = target.repsMin === target.repsMax ? `${target.repsMin}` : `${target.repsMin}–${target.repsMax}`;
  const warmups = warmupFor(pe, week);

  const initialFor = (i: number) => {
    const fact = work.find((s) => s.index === i);
    if (fact) return { lb: fact.lb, reps: fact.reps, dropReps: fact.dropReps };
    const prev = work.filter((s) => s.index < i).sort((a, b) => b.index - a.index)[0];
    return { lb: prev?.lb ?? target.lb, reps: target.repsMax };
  };

  return (
    <section className={`ex-card${expanded ? ' open' : ''}${complete ? ' complete' : ''}`}>
      <button className="ex-head" onClick={onToggle}>
        <span className="ex-n">{complete ? '✓' : n}</span>
        <span className="ex-title">
          <span className="ex-name">{ex.name}</span>
          <span className="ex-sub">
            {p.sets} × {reps} · {formatWeight(p.weight, target.lb)}
            {p.dropset ? ' + дроп' : ''}
          </span>
        </span>
        <span className="ex-count">
          {doneCount}/{p.sets}
        </span>
      </button>

      {expanded && (
        <div className="ex-body stack">
          <div className="muted ex-muscles">{ex.muscles}</div>
          {target.hint && <div className="hint">{target.hint}</div>}
          <ExerciseImage image={ex.image} name={ex.name} />

          {warmups.length > 0 && (
            <div>
              <div className="sub-title">Разминка · отдых 1 мин</div>
              <div className="chips">
                {warmups.map((w, i) => {
                  const done = sets.some((s) => s.kind === 'warmup' && s.index === i);
                  return (
                    <button
                      key={w}
                      className={done ? 'chip on' : 'chip'}
                      disabled={!active}
                      onClick={() => (done ? onUndo('warmup', i) : onSave('warmup', i, { lb: 0, reps: 0 }))}
                    >
                      {done ? '✓ ' : ''}
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="sub-title">
              Рабочие подходы · отдых 2 мин{p.dropset ? ' · дроп в последнем: −25–30% до отказа' : ''}
            </div>
            {Array.from({ length: p.sets }, (_, i) => (
              <SetRow
                key={i}
                n={i + 1}
                rule={p.weight}
                step={stepFor(pe.exerciseId)}
                initial={initialFor(i)}
                done={work.some((s) => s.index === i)}
                withDrop={!!p.dropset && i === p.sets - 1}
                disabled={!active}
                onSave={(v) => onSave('work', i, v)}
                onUndo={() => onUndo('work', i)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
