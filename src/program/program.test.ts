import { describe, expect, test } from 'vitest';
import { DAYS, EXERCISES, stepFor, warmupFor } from './program';
import type { DayType, Week } from './types';

const work = (t: DayType, w: Week) => DAYS[t].exercises.reduce((s, e) => s + e.weeks[w - 1].sets, 0);

describe('данные программы', () => {
  test('рабочие подходы недель 1–4: A=36, B=38, C=35', () => {
    for (const w of [1, 2, 3, 4] as Week[]) {
      expect(work('A', w)).toBe(36);
      expect(work('B', w)).toBe(38);
      expect(work('C', w)).toBe(35);
    }
  });

  test('разгрузка: A=22, B=23, C=21', () => {
    expect(work('A', 5)).toBe(22);
    expect(work('B', 5)).toBe(23);
    expect(work('C', 5)).toBe(21);
  });

  test('11/12/11 упражнений, все есть в справочнике, 34 всего', () => {
    expect(DAYS.A.exercises).toHaveLength(11);
    expect(DAYS.B.exercises).toHaveLength(12);
    expect(DAYS.C.exercises).toHaveLength(11);
    const ids = (['A', 'B', 'C'] as DayType[]).flatMap((t) => DAYS[t].exercises.map((e) => e.exerciseId));
    for (const id of ids) expect(EXERCISES[id], id).toBeDefined();
    expect(new Set(ids).size).toBe(34);
    expect(Object.keys(EXERCISES)).toHaveLength(34);
  });

  test('дропсеты только на махах недель 3–4', () => {
    const withDrop: string[] = [];
    for (const t of ['A', 'B', 'C'] as DayType[])
      for (const e of DAYS[t].exercises)
        e.weeks.forEach((p, i) => p.dropset && withDrop.push(`${e.exerciseId}:${i + 1}`));
    expect(withDrop.sort()).toEqual(
      ['cable-lateral:3', 'cable-lateral:4', 'machine-lateral:3', 'machine-lateral:4', 'supported-db-lateral:3', 'supported-db-lateral:4'].sort(),
    );
  });

  test('19 упражнений с подбором веса на неделе 1', () => {
    const picks = (['A', 'B', 'C'] as DayType[]).flatMap((t) => DAYS[t].exercises.filter((e) => e.weeks[0].weight.kind === 'pick'));
    expect(picks).toHaveLength(19);
  });

  test('примеры предписаний', () => {
    expect(DAYS.A.exercises[0].weeks[3].weight).toEqual({ kind: 'inclineW4' });
    expect(DAYS.B.exercises[2].weeks[1]).toMatchObject({ sets: 3, repsMin: 10, repsMax: 10, weight: { kind: 'plates', perSide: 110 } });
    expect(DAYS.C.exercises[8].weeks[2]).toMatchObject({ sets: 3, repsMin: 8, repsMax: 10, weight: { kind: 'fixed', lb: 40 } });
    expect(DAYS.A.exercises[1].weeks[4].weight).toEqual({ kind: 'added', lb: 0 });
    expect(DAYS.A.exercises[2].weeks[2].weight).toEqual({ kind: 'anchor', week: 1, deltaLb: 5 });
    expect(DAYS.C.exercises[4].weeks[2].weight).toEqual({ kind: 'anchor', week: 1, deltaLb: 20 });
    expect(DAYS.B.exercises[8].weeks[4]).toMatchObject({ sets: 2, repsMin: 10, weight: { kind: 'fixed', lb: 30 } });
    expect(DAYS.B.exercises[5].weeks[2]).toMatchObject({ dropset: true, weight: { kind: 'fixed', lb: 17.5 } });
    expect(DAYS.A.exercises[9].weeks[4]).toMatchObject({ sets: 1, repsMin: 18, weight: { kind: 'pct', week: 4, min: 0.7, max: 0.75 } });
    expect(DAYS.A.exercises[0].warmup).toEqual(['20×15', '40×10', '55×6']);
  });

  test('разминка: недели 1–4 из программы, на разгрузке — лёгкий подход только в первом упражнении', () => {
    expect(warmupFor(DAYS.B.exercises[2], 2)).toEqual(['пустая ×15', '1×45/стор. ×10']);
    expect(warmupFor(DAYS.B.exercises[2], 5)).toEqual([]);
    expect(warmupFor(DAYS.B.exercises[0], 5)).toEqual(['1×12 лёгкий']);
  });

  test('шаг веса: гантели 2,5, остальное 5', () => {
    expect(stepFor('supported-db-lateral')).toBe(2.5);
    expect(stepFor('incline-db-press')).toBe(2.5);
    expect(stepFor('lat-pulldown')).toBe(5);
  });
});
