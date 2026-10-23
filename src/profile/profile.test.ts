import { expect, test } from 'vitest';
import type { WorkoutRow } from '../db/db';
import { achievements, ageFrom, formatHeight, goalProgress } from './profile';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1, 12);
const w = (i: number, cycle = 1, day = 1): WorkoutRow => ({ id: i, cycle, day, startedAt: T0 + i * 2 * DAY, finishedAt: T0 + i * 2 * DAY + 3_600_000 });

test('возраст по году рождения и рост в футах', () => {
  expect(ageFrom(1998, Date.UTC(2026, 9, 23))).toBe(28);
  expect(formatHeight(179)).toBe(`5′10.5″`);
});

test('цель: текущий вес из целевого, доля для полосы', () => {
  expect(goalProgress(160.7, 175)).toEqual({ current: 160.7, target: 175, fraction: 0.918 });
  expect(goalProgress(null, 175)).toEqual({ current: null, target: 175, fraction: 0 });
  expect(goalProgress(190, 175).fraction).toBe(1);
});

test('достижения: вехи по числу тренировок с датой нужной тренировки', () => {
  const list = achievements(Array.from({ length: 12 }, (_, i) => w(i + 1)), {}, T0 + 40 * DAY);
  expect(list.map((a) => a.title)).toEqual(['10 тренировок', 'Первая тренировка']);
  expect(list[0].date).toBe(w(10).finishedAt);
});

test('достижения: завершённый цикл и сброшенный жир', () => {
  const ws = [w(1, 1, 1), w(2, 1, 33), w(3, 2, 1)];
  const body = {
    weight: [
      { date: T0, value: 80 },
      { date: T0 + 30 * DAY, value: 79 },
    ],
    bodyFat: [
      { date: T0, value: 20 },
      { date: T0 + 30 * DAY, value: 17 },
    ],
  };
  const titles = achievements(ws, body, T0 + 40 * DAY).map((a) => a.title);
  expect(titles).toContain('Цикл 1 завершён');
  // жир: 80×20% = 16 кг → 79×17% = 13.43 кг: −2.57 кг = −5.7 lb
  expect(titles).toContain('−5.7 lb жира');
});

test('незавершённые тренировки не считаются', () => {
  expect(achievements([{ id: 1, cycle: 1, day: 1, startedAt: T0 }], {}, T0)).toEqual([]);
});
