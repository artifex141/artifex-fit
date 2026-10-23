import { describe, expect, test } from 'vitest';
import { anchorWeight, formatWeight, roundTo, targetFor, type CycleConfig, type LoggedSet } from './weights';

const EMPTY: CycleConfig = { offsets: {}, startWeights: {} };

/** Рабочие подходы одного упражнения в один день: reps по подходам, один вес. */
function sets(day: number, exerciseId: string, lb: number, reps: number[], cycle = 1): LoggedSet[] {
  return reps.map((r, index) => ({ cycle, day, exerciseId, kind: 'work', index, lb, reps: r }));
}

describe('roundTo', () => {
  test('к ближайшему кратному шагу', () => {
    expect(roundTo(17.4, 2.5)).toBe(17.5);
    expect(roundTo(72.5 * 0.725, 5)).toBe(55);
    expect(roundTo(41.2, 5)).toBe(40);
  });
});

describe('targetFor', () => {
  test('фиксированный вес из программы', () => {
    expect(targetFor('db-bench-press', 2, 1, [], EMPTY)).toMatchObject({ lb: 70, repsMin: 10, repsMax: 10, source: 'program' });
  });

  test('Н1 берётся из недели 2, если неделя 1 не записана (старт с дня 12)', () => {
    const log = sets(12, 'mid-cable-fly', 30, [15, 15]);
    expect(targetFor('mid-cable-fly', 3, 1, log, EMPTY)).toMatchObject({ lb: 35, repsMin: 12, source: 'anchor' });
  });

  test('Н1 из недели 1 важнее недели 2', () => {
    const log = [...sets(5, 'mid-cable-fly', 25, [12, 12]), ...sets(12, 'mid-cable-fly', 30, [15, 15])];
    expect(anchorWeight('mid-cable-fly', 1, 1, log, EMPTY)).toBe(25);
  });

  test('Н1 из стартовых весов цикла', () => {
    expect(targetFor('ez-curl', 3, 1, [], { offsets: {}, startWeights: { 'ez-curl': 50 } }).lb).toBe(55);
  });

  test('нет якоря — пустой вес и подсказка про Н1', () => {
    const t = targetFor('ez-curl', 2, 1, [], EMPTY);
    expect(t.lb).toBeNull();
    expect(t.source).toBe('unknown');
    expect(t.hint).toContain('Н1');
  });

  test('нет Н3 — подсказка про Н3', () => {
    expect(targetFor('ez-curl', 4, 1, [], EMPTY).hint).toContain('Н3');
  });

  test('якорь — мода, при равенстве больший вес', () => {
    const log: LoggedSet[] = [30, 30, 35, 35].map((lb, index) => ({ cycle: 1, day: 3, exerciseId: 'machine-chest-press', kind: 'work', index, lb, reps: 10 }));
    expect(anchorWeight('machine-chest-press', 1, 1, log, EMPTY)).toBe(35);
  });

  test('разминочные подходы не влияют на якорь', () => {
    const log: LoggedSet[] = [
      { cycle: 1, day: 3, exerciseId: 'machine-chest-press', kind: 'warmup', index: 0, lb: 20, reps: 12 },
      ...sets(3, 'machine-chest-press', 60, [10]),
    ];
    expect(anchorWeight('machine-chest-press', 1, 1, log, EMPTY)).toBe(60);
  });

  test('недобор 2+ повторений — вес не повышается', () => {
    const log = sets(8, 'incline-db-press', 65, [12, 12, 9, 8]);
    expect(targetFor('incline-db-press', 3, 1, log, EMPTY)).toMatchObject({ lb: 65, source: 'heldBack' });
  });

  test('недобор на 1 повторение — вес повышается', () => {
    const log = sets(8, 'incline-db-press', 65, [12, 12, 11, 11]);
    expect(targetFor('incline-db-press', 3, 1, log, EMPTY)).toMatchObject({ lb: 70, source: 'program' });
  });

  test('неделя 4, жим на наклонной: 75 lb после 70×10 во всех подходах', () => {
    const log = sets(15, 'incline-db-press', 70, [10, 10, 10, 10]);
    expect(targetFor('incline-db-press', 4, 1, log, EMPTY)).toMatchObject({ lb: 75, repsMin: 8, repsMax: 8 });
  });

  test('неделя 4, жим на наклонной: иначе 70 lb × 10–12', () => {
    const log = sets(15, 'incline-db-press', 70, [10, 10, 10, 9]);
    const t = targetFor('incline-db-press', 4, 1, log, EMPTY);
    expect(t).toMatchObject({ lb: 70, repsMin: 10, repsMax: 12 });
    expect(t.hint).toContain('75 lb');
  });

  test('разгрузка: 70–75% от Н4, округление к шагу', () => {
    const log = sets(22, 'ez-curl', 55, [12, 12, 12]);
    expect(targetFor('ez-curl', 5, 1, log, EMPTY)).toMatchObject({ lb: 40, source: 'anchor' });
  });

  test('смещение цикла прибавляется к фиксированному весу', () => {
    expect(targetFor('db-bench-press', 1, 2, [], { offsets: { 'db-bench-press': 5 }, startWeights: {} }).lb).toBe(70);
  });

  test('записи другого цикла не дают якорь', () => {
    const log = sets(12, 'mid-cable-fly', 30, [15, 15], 1);
    expect(targetFor('mid-cable-fly', 3, 2, log, EMPTY).lb).toBeNull();
  });

  test('подбор веса: предлагается последний записанный вес', () => {
    const log = sets(5, 'mid-cable-fly', 25, [12, 12]);
    expect(targetFor('mid-cable-fly', 1, 1, log, EMPTY)).toMatchObject({ lb: 25 });
    expect(targetFor('mid-cable-fly', 1, 1, [], EMPTY)).toMatchObject({ lb: null, source: 'unknown' });
  });
});

describe('formatWeight', () => {
  test('форматы', () => {
    expect(formatWeight({ kind: 'plates', perSide: 110 }, 110)).toBe('2×45 +20 / стор.');
    expect(formatWeight({ kind: 'plates', perSide: 90 }, 90)).toBe('2×45 / стор.');
    expect(formatWeight({ kind: 'added', lb: 0 }, 0)).toBe('без веса');
    expect(formatWeight({ kind: 'added', lb: 10 }, 10)).toBe('+10 lb');
    expect(formatWeight({ kind: 'fixed', lb: 17.5 }, 17.5)).toBe('17.5 lb');
    expect(formatWeight({ kind: 'pick' }, null)).toBe('—');
  });
});
