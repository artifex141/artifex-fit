import { describe, expect, test } from 'vitest';
import { nextCycleConfig } from './cycle';
import type { CycleConfig, LoggedSet } from './weights';

const EMPTY: CycleConfig = { offsets: {}, startWeights: {} };

function sets(day: number, exerciseId: string, lb: number, n: number, reps = 10): LoggedSet[] {
  return Array.from({ length: n }, (_, index) => ({ cycle: 1, day, exerciseId, kind: 'work' as const, index, lb, reps }));
}

const log: LoggedSet[] = [
  ...sets(17, 'ez-skullcrusher', 50, 3), // Н3
  ...sets(15, 'ez-curl', 55, 3), // Н3
  ...sets(22, 'ez-curl', 60, 3), // Н4
  ...sets(24, 'machine-shoulder-press', 110, 4), // факт недели 4 при плане 100
];

describe('как в программе', () => {
  const next = nextCycleConfig(EMPTY, 1, log, 'program');

  test('смещение = вес недели 2 − вес недели 1', () => {
    expect(next.offsets['db-bench-press']).toBe(5);
    expect(next.offsets['incline-db-press']).toBe(0);
    expect(next.offsets['leg-press']).toBe(10);
    expect(next.offsets['neutral-pullup']).toBe(5);
    expect(next.offsets['machine-shoulder-press']).toBe(0);
  });

  test('подбор веса: стартовый вес = Н3', () => {
    expect(next.startWeights['ez-curl']).toBe(55);
    expect(next.startWeights['ez-skullcrusher']).toBe(50);
  });

  test('без Н3 остаётся прошлый стартовый вес', () => {
    const n = nextCycleConfig({ offsets: {}, startWeights: { 'pec-deck': 80 } }, 1, log, 'program');
    expect(n.startWeights['pec-deck']).toBe(80);
    expect(n.startWeights['face-pull']).toBeUndefined();
  });

  test('смещения накапливаются', () => {
    expect(nextCycleConfig({ offsets: { 'db-bench-press': 5 }, startWeights: {} }, 1, [], 'program').offsets['db-bench-press']).toBe(10);
  });
});

describe('лучшие результаты', () => {
  const next = nextCycleConfig(EMPTY, 1, log, 'best');

  test('перевыполнение недели 4 добавляется к смещению', () => {
    expect(next.offsets['machine-shoulder-press']).toBe(10);
    expect(next.offsets['db-bench-press']).toBe(5);
  });

  test('подбор веса: стартовый вес = Н4, если есть, иначе Н3', () => {
    expect(next.startWeights['ez-curl']).toBe(60);
    expect(next.startWeights['ez-skullcrusher']).toBe(50);
  });
});
