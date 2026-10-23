import { EXERCISES } from '../../program/exercises';
import { stepFor, warmupFor } from '../../program/program';
import type { ProgramExercise, Week } from '../../program/types';
import type { Target } from '../../program/weights';
import type { SetRow as SetRecord } from '../../db/repo';
import { ChevronIcon, NumRing } from '../kit';
import { ExerciseImage } from './ExerciseImage';
import { PulseCard } from './PulseCard';
import { CheckIcon } from '../kit';
import { RestControls, SetRow, type RestView, type SetValues } from './SetRow';

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'подход' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'подхода' : 'подходов');

const dots = (s: string) => s.replace(/ · /g, ' • ');

/** Свёрнутое упражнение — строка списка, как «2 Разведения гантелей лёжа» на макете. */
export function ExerciseRow({ n, pe, done, onOpen }: { n: number; pe: ProgramExercise; done: boolean; onOpen: () => void }) {
  const ex = EXERCISES[pe.exerciseId];
  return (
    <button className={done ? 'ex-row done' : 'ex-row'} onClick={onOpen}>
      <NumRing n={done ? '✓' : n} size={42} />
      <span className="ex-titles">
        <span className="ex-name">{ex.name}</span>
        <span className="ex-muscles">{dots(ex.muscles)}</span>
      </span>
      <span className="glass-btn" style={{ width: 40, height: 40 }}>
        <ChevronIcon dir="right" />
      </span>
    </button>
  );
}

interface CardProps {
  n: number;
  pe: ProgramExercise;
  week: Week;
  target: Target;
  sets: SetRecord[]; // рабочие подходы этого упражнения в текущей тренировке
  rest: { setIndex: number; view: RestView } | null;
  /** Отдых после последнего подхода предыдущего упражнения — показываем над подходами этого. */
  carriedRest?: { title: string; view: RestView } | null;
  index: number;
  onCollapse: () => void;
  onSave: (index: number, v: SetValues) => void;
  onUndo: (index: number) => void;
}

/** Раскрытое упражнение: заголовок, 3 кадра, подходы, пульс. */
export function ExerciseCard({ n, pe, week, target, sets, rest, carriedRest, index, onCollapse, onSave, onUndo }: CardProps) {
  const ex = EXERCISES[pe.exerciseId];
  const p = pe.weeks[week - 1];
  const warmups = warmupFor(pe, week);
  const doneIdx = new Set(sets.map((s) => s.index));
  const activeIdx = Array.from({ length: p.sets }, (_, i) => i).find((i) => !doneIdx.has(i));

  const suggestFor = (i: number) => {
    const prev = sets.filter((s) => s.index < i).sort((a, b) => b.index - a.index)[0];
    return { lb: prev?.lb ?? target.lb, reps: target.repsMax };
  };

  return (
    <section className="ex-card" data-index={index}>
      <button className="ex-head" onClick={onCollapse}>
        <NumRing n={n} active size={48} />
        <span className="ex-titles">
          <span className="ex-name big">{ex.name}</span>
          <span className="ex-muscles">{dots(ex.muscles)}</span>
        </span>
        <span className="glass-btn accent" style={{ width: 44, height: 44 }} aria-label="Свернуть">
          <ChevronIcon dir="up" />
        </span>
      </button>

      {target.hint && <div className="ex-hint">{target.hint}</div>}

      <ExerciseImage image={ex.image} name={ex.name} />

      <div className="sets-head">
        <span className="sets-title">Подходы</span>
        <span className="sets-meta">
          {p.sets} {plural(p.sets)} · Отдых 2 мин
        </span>
      </div>
      {(warmups.length > 0 || p.dropset || ex.note) && (
        <div className="sets-note">
          {ex.note && <>{ex.note}{warmups.length > 0 ? ' · ' : ''}</>}
          {warmups.length > 0 && <>Разминка: {warmups.join(' · ')}</>}
          {warmups.length > 0 && p.dropset && <br />}
          {p.dropset && <>В последнем подходе дроп: −25–30% веса и до отказа</>}
        </div>
      )}

      <div className="sets">
        {carriedRest && (
          <div className="srow done resting carried">
            <span className="srow-main">
              <span className="snum-done">
                <CheckIcon />
              </span>
              <span className="srow-text">
                <span className="srow-title">Отдых</span>
                <span className="srow-sub">{carriedRest.title}</span>
              </span>
            </span>
            <RestControls rest={carriedRest.view} />
          </div>
        )}
        {Array.from({ length: p.sets }, (_, i) => {
          const fact = sets.find((s) => s.index === i);
          return (
            <SetRow
              key={i}
              n={i + 1}
              rule={p.weight}
              step={stepFor(pe.exerciseId)}
              withDrop={!!p.dropset && i === p.sets - 1}
              status={fact ? 'done' : i === activeIdx ? 'active' : 'future'}
              suggest={suggestFor(i)}
              fact={fact && { lb: fact.lb, reps: fact.reps, dropReps: fact.dropReps }}
              rest={rest && rest.setIndex === i ? rest.view : undefined}
              onSave={(v) => onSave(i, v)}
              onUndo={() => onUndo(i)}
            />
          );
        })}
      </div>

      <PulseCard />
    </section>
  );
}
