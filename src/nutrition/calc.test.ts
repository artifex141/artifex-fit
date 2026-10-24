import { expect, test } from 'vitest';
import { autoTargets, avgKcalPerDay, dayKey, mealByTime, scale, sumMacros } from './calc';

test('пересчёт КБЖУ на порцию', () => {
  expect(scale({ kcal: 350, p: 12, f: 1.5, c: 72 }, 150)).toEqual({ kcal: 525, p: 18, f: 2.3, c: 108 });
  expect(scale({ kcal: 52, p: 0.3, f: 0.2, c: 14 }, 0)).toEqual({ kcal: 0, p: 0, f: 0, c: 0 });
});

test('сумма за приём или день с округлением', () => {
  expect(sumMacros([{ kcal: 250, p: 10.04, f: 6, c: 38 }, { kcal: 105, p: 1.03, f: 0.3, c: 27 }])).toEqual({ kcal: 355, p: 11.1, f: 6.3, c: 65 });
  expect(sumMacros([])).toEqual({ kcal: 0, p: 0, f: 0, c: 0 });
});

test('приём пищи по времени', () => {
  const at = (h: number) => new Date(2026, 9, 23, h, 0);
  expect(mealByTime(at(8))).toBe('breakfast');
  expect(mealByTime(at(12))).toBe('lunch');
  expect(mealByTime(at(18))).toBe('dinner');
  expect(mealByTime(at(22))).toBe('snack');
});

test('норма по Миффлину: набор, снижение, поддержание', () => {
  const base = { weightLb: 160.7, heightCm: 179, age: 28 };
  expect(autoTargets({ ...base, goal: 'mass' })).toEqual({ kcal: 2920, p: 161, f: 81, c: 387, manual: false });
  expect(autoTargets({ ...base, goal: 'cut' }).kcal).toBe(2120);
  expect(autoTargets({ ...base, goal: 'keep' }).kcal).toBe(2650);
});

test('ключ дня по местному времени', () => {
  expect(dayKey(new Date(2026, 9, 23, 23, 30))).toBe('2026-10-23');
  expect(dayKey(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
});

test('калории в среднем за день — по дням с записями внутри периода', () => {
  const days = [
    { date: '2026-10-23', kcal: 2000 },
    { date: '2026-10-21', kcal: 2600 },
    { date: '2026-10-12', kcal: 1000 },
  ];
  expect(avgKcalPerDay(days, '2026-10-20', '2026-10-27')).toBe(2300);
  expect(avgKcalPerDay(days, '2026-10-13', '2026-10-20')).toBe(0);
  expect(avgKcalPerDay(days, '2026-10-12', '2026-10-13')).toBe(1000);
});
