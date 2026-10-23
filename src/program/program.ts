// Программа «Тяжёлые тренировки: 4 недели + разгрузка», перенесена из docs/program-source.txt.
import type { DayTemplate, DayType, Prescription, ProgramExercise, WeightRule } from './types';

export { EXERCISES, stepFor } from './exercises';

const F = (lb: number): WeightRule => ({ kind: 'fixed', lb });
const ADD = (lb: number): WeightRule => ({ kind: 'added', lb });
const PL = (perSide: number): WeightRule => ({ kind: 'plates', perSide });
const PICK: WeightRule = { kind: 'pick' };
const H1 = (deltaLb = 0): WeightRule => ({ kind: 'anchor', week: 1, deltaLb });
const H3: WeightRule = { kind: 'anchor', week: 3, deltaLb: 0 };
const PCT: WeightRule = { kind: 'pct', week: 4, min: 0.7, max: 0.75 };
const INCLINE_W4: WeightRule = { kind: 'inclineW4' };

function p(sets: number, reps: number | [number, number], weight: WeightRule, dropset = false): Prescription {
  const [repsMin, repsMax] = typeof reps === 'number' ? [reps, reps] : reps;
  return dropset ? { sets, repsMin, repsMax, weight, dropset } : { sets, repsMin, repsMax, weight };
}

function ex(
  exerciseId: string,
  warmup: string[],
  weeks: ProgramExercise['weeks'],
  warmupDeload: string[] = [],
): ProgramExercise {
  return { exerciseId, warmup, warmupDeload, weeks };
}

const LIGHT = ['1×12 лёгкий'];

export const DAYS: Record<DayType, DayTemplate> = {
  A: {
    type: 'A',
    title: 'верх груди, средняя дельта, руки',
    exercises: [
      ex('incline-db-press', ['20×15', '40×10', '55×6'], [p(4, 10, F(65)), p(4, 12, F(65)), p(4, 10, F(70)), p(4, 8, INCLINE_W4), p(2, 8, F(55))], LIGHT),
      ex('neutral-pullup', ['тяга блока 1×15'], [p(3, 10, ADD(5)), p(3, [8, 10], ADD(10)), p(3, 10, ADD(10)), p(3, 8, ADD(15)), p(2, 8, ADD(0))]),
      ex('low-high-cable-fly', [], [p(3, 12, PICK), p(3, 15, H1()), p(3, 12, H1(5)), p(3, 15, H3), p(2, 15, PCT)]),
      ex('chest-supported-row', ['50×12'], [p(3, 10, F(100)), p(3, 12, F(100)), p(3, 10, F(110)), p(3, 12, F(110)), p(2, 12, F(80))]),
      ex('standing-calf', ['1×15'], [p(5, 12, PICK), p(5, 15, H1()), p(5, 12, H1(10)), p(5, 15, H3), p(3, 15, PCT)]),
      ex('cable-lateral', ['1×15 лёгкий'], [p(5, 15, PICK), p(5, 18, H1()), p(5, 15, H1(5), true), p(5, 18, H3, true), p(3, 18, PCT)]),
      ex('reverse-pec-deck', [], [p(3, 15, F(55)), p(3, 18, F(55)), p(3, 15, F(60)), p(3, 18, F(60)), p(2, 18, F(45))]),
      ex('overhead-rope-ext', ['1×15'], [p(3, 12, F(35)), p(3, 10, F(40)), p(3, 12, F(40)), p(3, 10, F(45)), p(2, 10, F(35))]),
      ex('ez-curl', ['1×12'], [p(3, 10, PICK), p(3, 12, H1()), p(3, 10, H1(5)), p(3, 12, H3), p(2, 12, PCT)]),
      ex('single-arm-cable-ext', [], [p(2, 15, PICK), p(2, 18, H1()), p(2, 15, H1(5)), p(2, 18, H3), p(1, 18, PCT)]),
      ex('preacher-curl', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
    ],
  },
  B: {
    type: 'B',
    title: 'жим на плечи, ноги (поддержание), руки',
    exercises: [
      ex('machine-shoulder-press', ['50×10', '70×5'], [p(4, 8, F(90)), p(4, 10, F(90)), p(4, 8, F(100)), p(4, 10, F(100)), p(2, 10, F(75))], LIGHT),
      ex('machine-chest-press', ['1×12'], [p(3, 10, PICK), p(3, 12, H1()), p(3, 10, H1(10)), p(3, 12, H3), p(2, 12, PCT)]),
      ex('leg-press', ['пустая ×15', '1×45/стор. ×10'], [p(3, 12, PL(100)), p(3, 10, PL(110)), p(3, 12, PL(110)), p(3, 10, PL(120)), p(2, 10, PL(90))]),
      ex('lying-leg-curl', ['1×15'], [p(3, 12, F(70)), p(3, 14, F(70)), p(3, 10, F(80)), p(3, 12, F(80)), p(2, 12, F(60))]),
      ex('seated-calf', ['1×15'], [p(5, 15, PICK), p(5, 18, H1()), p(5, 15, H1(10)), p(5, 18, H3), p(3, 18, PCT)]),
      ex('supported-db-lateral', ['10×15'], [p(5, 15, F(15)), p(5, 18, F(15)), p(5, 15, F(17.5), true), p(5, 18, F(17.5), true), p(3, 15, F(12.5))]),
      ex('pec-deck', [], [p(2, 15, PICK), p(2, 18, H1()), p(2, 15, H1(5)), p(2, 18, H3), p(1, 18, PCT)]),
      ex('rear-delt-db-fly', [], [p(3, 15, PICK), p(3, 18, H1()), p(3, 15, H1(5)), p(3, 18, H3), p(2, 18, PCT)]),
      ex('incline-db-curl', ['1×12 лёгкий'], [p(3, 10, F(35)), p(3, 12, F(35)), p(3, [8, 10], F(40)), p(3, 10, F(40)), p(2, 10, F(30))]),
      ex('ez-skullcrusher', ['1×12'], [p(3, 10, PICK), p(3, 12, H1()), p(3, 10, H1(5)), p(3, 12, H3), p(2, 12, PCT)]),
      ex('low-cable-curl', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
      ex('rope-pushdown', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
    ],
  },
  C: {
    type: 'C',
    title: 'грудь, спина (поддержание), средняя дельта, руки',
    exercises: [
      ex('db-bench-press', ['20×15', '40×10', '55×6'], [p(4, 12, F(65)), p(4, 10, F(70)), p(4, 12, F(70)), p(4, [8, 10], F(75)), p(2, 10, F(55))], LIGHT),
      ex('lat-pulldown', ['1×12'], [p(3, 10, F(100)), p(3, 12, F(100)), p(3, 10, F(110)), p(3, 12, F(110)), p(2, 12, F(80))]),
      ex('mid-cable-fly', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
      ex('seated-cable-row', ['1×12'], [p(3, 10, F(100)), p(3, 12, F(100)), p(3, 10, F(110)), p(3, 12, F(110)), p(2, 12, F(80))]),
      ex('leg-press-calf', ['1×15'], [p(5, 15, PICK), p(5, 18, H1()), p(5, 15, H1(20)), p(5, 18, H3), p(3, 18, PCT)]),
      ex('machine-lateral', ['1×15'], [p(5, 15, PICK), p(5, 18, H1()), p(5, 15, H1(5), true), p(5, 18, H3, true), p(3, 18, PCT)]),
      ex('face-pull', [], [p(3, 15, PICK), p(3, 18, H1()), p(3, 15, H1(5)), p(3, 18, H3), p(2, 18, PCT)]),
      ex('straight-bar-pushdown', ['1×15'], [p(3, 12, F(45)), p(3, 15, F(45)), p(3, 12, F(50)), p(3, 10, F(55)), p(2, 10, F(40))]),
      ex('hammer-curl', [], [p(3, 10, F(35)), p(3, 12, F(35)), p(3, [8, 10], F(40)), p(3, 10, F(40)), p(2, 10, F(30))]),
      ex('db-overhead-ext', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
      ex('bayesian-curl', [], [p(2, 12, PICK), p(2, 15, H1()), p(2, 12, H1(5)), p(2, 15, H3), p(1, 15, PCT)]),
    ],
  },
};

/** Разминочные подходы упражнения на данной неделе (на разгрузке — только лёгкий подход в первом упражнении). */
export function warmupFor(pe: ProgramExercise, week: number): string[] {
  return week === 5 ? pe.warmupDeload ?? [] : pe.warmup;
}
