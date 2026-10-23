import { expect, test } from 'vitest';
import type { SetRow, WorkoutRow } from '../db/db';
import { change, periodStart, summary, weightSeries } from './stats';

const T0 = new Date(2026, 9, 20, 18, 0).getTime(); // вт 20.10.2026
const HOUR = 3_600_000;

const workouts: WorkoutRow[] = [
  { id: 1, cycle: 1, day: 10, startedAt: T0, finishedAt: T0 + 2 * HOUR }, // «B»
  { id: 2, cycle: 1, day: 12, startedAt: T0 + 48 * HOUR, finishedAt: T0 + 48 * HOUR + HOUR }, // «C»
  { id: 3, cycle: 1, day: 15, startedAt: T0 + 96 * HOUR }, // не завершена
];

const s = (workoutId: number, day: number, exerciseId: string, lb: number, reps: number, index = 0, kind: 'work' | 'warmup' = 'work'): SetRow => ({
  workoutId, cycle: 1, day, exerciseId, kind, index, lb, reps, doneAt: 0,
});

const sets: SetRow[] = [
  s(1, 10, 'leg-press', 110, 10), // 110 на сторону → 2200
  s(1, 10, 'lying-leg-curl', 70, 14), // 980
  s(1, 10, 'lying-leg-curl', 50, 10, 0, 'warmup'), // разминка не считается
  s(2, 12, 'db-bench-press', 70, 10), // 700
  s(2, 12, 'db-bench-press', 70, 9, 1), // 630
  s(3, 15, 'db-bench-press', 75, 8), // незавершённая тренировка
];

test('итоги: только завершённые тренировки в периоде, только рабочие подходы', () => {
  expect(summary(workouts, sets, 0)).toEqual({ count: 2, minutes: 180, tonnage: 2200 + 980 + 700 + 630 });
  expect(summary(workouts, sets, T0 + 24 * HOUR)).toEqual({ count: 1, minutes: 60, tonnage: 1330 });
});

test('итоги за прошлый период: от начала до начала текущего (не включая)', () => {
  expect(summary(workouts, sets, 0, T0 + 24 * HOUR)).toEqual({ count: 1, minutes: 120, tonnage: 2200 + 980 });
});

test('сравнение с прошлым периодом', () => {
  expect(change(4, 2)).toEqual({ abs: 2, pct: 100 });
  expect(change(0, 0)).toEqual({ abs: 0, pct: null });
  expect(change(3, 0)).toEqual({ abs: 3, pct: null });
  expect(change(90, 120)).toEqual({ abs: -30, pct: -25 });
});

test('подтягивания с доп. весом в тоннаж не идут', () => {
  const w: WorkoutRow[] = [{ id: 9, cycle: 1, day: 8, startedAt: T0, finishedAt: T0 + HOUR }];
  expect(summary(w, [s(9, 8, 'neutral-pullup', 10, 10)], 0).tonnage).toBe(0);
});

test('график веса: мода за тренировку, по возрастанию даты, только завершённые', () => {
  const extra = [s(1, 10, 'db-bench-press', 65, 12)];
  expect(weightSeries('db-bench-press', workouts, [...sets, ...extra])).toEqual([
    { date: T0, lb: 65 },
    { date: T0 + 48 * HOUR, lb: 70 },
  ]);
});

test('начало периода: неделя с понедельника, месяц с 1-го, год с 1 января', () => {
  const thu = new Date(2026, 9, 22, 15, 0).getTime();
  expect(periodStart('week', thu)).toBe(new Date(2026, 9, 19).getTime());
  expect(periodStart('month', thu)).toBe(new Date(2026, 9, 1).getTime());
  expect(periodStart('year', thu)).toBe(new Date(2026, 0, 1).getTime());
  const sun = new Date(2026, 9, 25, 10, 0).getTime();
  expect(periodStart('week', sun)).toBe(new Date(2026, 9, 19).getTime());
});
