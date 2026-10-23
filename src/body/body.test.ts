import { expect, test } from 'vitest';
import { metric } from './body';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 23, 12);

test('нет замеров — null (на экране остаётся демо)', () => {
  expect(metric(undefined, NOW)).toBeNull();
  expect(metric([], NOW)).toBeNull();
});

test('последнее значение, изменение за 4 недели и ряд за 30 дней', () => {
  const list = [
    { date: NOW - 40 * DAY, value: 83 },
    { date: NOW - 29 * DAY, value: 81.6 },
    { date: NOW - 10 * DAY, value: 80.9 },
    { date: NOW - 1 * DAY, value: 80.2 },
  ];
  const m = metric(list, NOW)!;
  expect(m.value).toBe(80.2);
  expect(m.delta).toBe(-1.4); // к замеру ~28 дней назад (81.6)
  expect(m.series.map((p) => p.lb)).toEqual([81.6, 80.9, 80.2]);
});

test('один замер — без изменения', () => {
  const m = metric([{ date: NOW - DAY, value: 15.2 }], NOW)!;
  expect(m.value).toBe(15.2);
  expect(m.delta).toBeNull();
});
