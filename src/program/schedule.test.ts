import { expect, test } from 'vitest';
import { TRAINING_DAYS, dayInfo, nextTrainingDay } from './schedule';

test('15 тренировочных дней в цикле', () => {
  expect(TRAINING_DAYS).toEqual([1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29, 31, 33]);
});

test('день 12 — неделя 2, тренировка C, запас 2', () => {
  expect(dayInfo(12)).toEqual({ week: 2, type: 'C', rir: '2' });
});

test('день 1 — A, день 31 — разгрузка B, день 22 — пик', () => {
  expect(dayInfo(1)).toEqual({ week: 1, type: 'A', rir: '3' });
  expect(dayInfo(31)).toEqual({ week: 5, type: 'B', rir: '4–5' });
  expect(dayInfo(22)).toEqual({ week: 4, type: 'A', rir: '0–1' });
});

test('день отдыха — ошибка', () => {
  expect(() => dayInfo(2)).toThrow();
});

test('следующая тренировка по порядку и переход на новый цикл', () => {
  expect(nextTrainingDay({ cycle: 1, day: 12 })).toEqual({ cycle: 1, day: 15 });
  expect(nextTrainingDay({ cycle: 1, day: 33 })).toEqual({ cycle: 2, day: 1 });
});
