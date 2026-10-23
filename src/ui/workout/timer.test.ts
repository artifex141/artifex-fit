import { expect, test } from 'vitest';
import { formatClock, remainingSec } from './timer';

test('остаток отдыха считается от времени старта', () => {
  expect(remainingSec(0, 120, 30_500)).toBe(90);
  expect(remainingSec(0, 120, 0)).toBe(120);
});

test('после блокировки экрана остаток не уходит в минус', () => {
  expect(remainingSec(0, 120, 500_000)).toBe(0);
});

test('формат часов', () => {
  expect(formatClock(120)).toBe('02:00');
  expect(formatClock(5)).toBe('00:05');
  expect(formatClock(3903)).toBe('1:05:03');
});
