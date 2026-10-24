import { expect, test } from 'vitest';
import { targetFor, type LoggedSet } from '../program/weights';
import { cycleProgress, nutritionScore, strengthVsPlan } from './metrics';

const CFG = { offsets: {}, startWeights: {} };
// План упражнения на неделю 1 берём из движка, чтобы тест не зависел от цифр программы.
const T = targetFor('machine-shoulder-press', 1, 1, [], CFG);
const PLAN_LB = T.lb!;
const PLAN_REPS = T.repsMin;
// Жим на плечи в тренажёре (fixed 100 lb, 8–10) — проверяем на неделе 1, дне 3 цикла 1.
const set = (lb: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ cycle: 1, day: 3, exerciseId: 'machine-shoulder-press', kind: 'work', index: 0, lb, reps, ...extra });

test('сила: по плану — 0 %, тяжелее или больше повторов — плюс, меньше — минус', () => {
  expect(strengthVsPlan([], () => CFG)).toBeNull();
  const t = (lb: number, reps: number) => strengthVsPlan([set(lb, reps)], () => CFG)!;
  const atPlan = t(PLAN_LB, PLAN_REPS);
  expect(atPlan.pct).toBe(0);
  expect(t(PLAN_LB + 10, PLAN_REPS).pct).toBeGreaterThan(0);
  expect(t(PLAN_LB, PLAN_REPS - 3).pct).toBeLessThan(0);
});

test('сила: разминка, неизвестные упражнения и подходы без плана не считаются', () => {
  expect(strengthVsPlan([set(100, 10, { kind: 'warmup' }), set(50, 10, { exerciseId: 'nope' })], () => CFG)).toBeNull();
});

test('прогресс цикла — по текущему тренировочному дню', () => {
  expect(cycleProgress({ cycle: 1, day: 1 })).toEqual({ done: 0, total: 15 });
  expect(cycleProgress({ cycle: 2, day: 12 })).toEqual({ done: 5, total: 15 });
});

test('питание: съедено относительно нормы', () => {
  expect(nutritionScore(1580, 2400)).toEqual({ text: '1580/2400', frac: 1580 / 2400 });
  expect(nutritionScore(3000, 2400).frac).toBe(1);
  expect(nutritionScore(500, null)).toEqual({ text: '500 ккал', frac: 0 });
});

