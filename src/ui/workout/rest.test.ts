import { expect, test } from 'vitest';
import { formatHMS, pauseRest, restLeft, resumeRest, type RestState } from './timer';
import { makeBeepWav } from './sound';

const rest: RestState = { startedAt: 0, duration: 120, setKey: 'db-bench-press:0' };

test('остаток отдыха идёт от времени старта', () => {
  expect(restLeft(rest, 30_500)).toBe(90);
  expect(restLeft(rest, 500_000)).toBe(0);
});

test('пауза замораживает остаток, продолжение считает дальше от него', () => {
  const paused = pauseRest(rest, 30_000);
  expect(restLeft(paused, 90_000)).toBe(90);
  const resumed = resumeRest(paused, 100_000);
  expect(restLeft(resumed, 110_000)).toBe(80);
  expect(resumed.setKey).toBe('db-bench-press:0');
});

test('время тренировки всегда с часами, как на макете', () => {
  expect(formatHMS(754)).toBe('00:12:34');
  expect(formatHMS(3903)).toBe('01:05:03');
});

test('звуковой сигнал — корректный WAV', () => {
  const wav = makeBeepWav();
  const text = (a: number, b: number) => String.fromCharCode(...wav.slice(a, b));
  expect(text(0, 4)).toBe('RIFF');
  expect(text(8, 12)).toBe('WAVE');
  const view = new DataView(wav.buffer);
  expect(view.getUint32(4, true)).toBe(wav.length - 8);
  expect(view.getUint32(40, true)).toBe(wav.length - 44);
  expect(wav.length).toBeGreaterThan(44 + 8000);
});
