import { expect, test } from 'vitest';
import { DAYS } from './program';
import { afterSet } from './flow';

const C = DAYS.C.exercises; // неделя 2: 4,3,2,3,5,5,3,3,3,2,2 подходов

test('не последний подход — остаёмся в упражнении', () => {
  expect(afterSet(C, 2, {}, 'db-bench-press', 0)).toEqual({ kind: 'stay' });
});

test('последний подход — раскрываем следующее упражнение', () => {
  const done = { 'db-bench-press': 3 };
  expect(afterSet(C, 2, done, 'db-bench-press', 3)).toEqual({ kind: 'open', exerciseId: 'lat-pulldown' });
});

test('следующее уже сделано — раскрываем ближайшее несделанное', () => {
  const done = { 'db-bench-press': 3, 'lat-pulldown': 3 };
  expect(afterSet(C, 2, done, 'db-bench-press', 3)).toEqual({ kind: 'open', exerciseId: 'mid-cable-fly' });
});

test('после последнего упражнения есть пропущенное раньше — возвращаемся к нему', () => {
  const done = Object.fromEntries(C.map((e) => [e.exerciseId, e.weeks[1].sets]));
  done['lat-pulldown'] = 1;
  done['bayesian-curl'] = 1;
  expect(afterSet(C, 2, done, 'bayesian-curl', 1)).toEqual({ kind: 'open', exerciseId: 'lat-pulldown' });
});

test('всё сделано — предложить завершить тренировку', () => {
  const done = Object.fromEntries(C.map((e) => [e.exerciseId, e.weeks[1].sets]));
  done['bayesian-curl'] = 1;
  expect(afterSet(C, 2, done, 'bayesian-curl', 1)).toEqual({ kind: 'finish' });
});
