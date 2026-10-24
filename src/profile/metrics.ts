// Метрики профиля из реальных данных: сила относительно плана, прогресс цикла, питание относительно нормы.
import { TRAINING_DAYS, dayInfo, type Position } from '../program/schedule';
import { targetFor, type CycleConfig, type LoggedSet } from '../program/weights';

/** Оценка силы подхода по Эпли: вес × (1 + повторы / 30) — сравнимы подходы с разным числом повторов. */
const e1rm = (lb: number, reps: number) => lb * (1 + reps / 30);

/**
 * Насколько рабочие подходы сильнее (+) или слабее (−) плана программы, в процентах.
 * План подхода — вес и нижняя граница повторов, которые программа давала до этого дня.
 */
export function strengthVsPlan(sets: LoggedSet[], cfgFor: (cycle: number) => CycleConfig): { pct: number } | null {
  let actual = 0;
  let planned = 0;
  for (const s of sets) {
    if (s.kind !== 'work' || s.lb <= 0) continue;
    const before = sets.filter((x) => x.cycle < s.cycle || (x.cycle === s.cycle && x.day < s.day));
    let target;
    try {
      target = targetFor(s.exerciseId, dayInfo(s.day).week, s.cycle, before, cfgFor(s.cycle));
    } catch {
      continue; // упражнение не из программы или день не тренировочный
    }
    if (!target.lb || target.lb <= 0) continue;
    actual += e1rm(s.lb, s.reps);
    planned += e1rm(target.lb, target.repsMin);
  }
  return planned > 0 ? { pct: Math.round((actual / planned - 1) * 100) } : null;
}

/** Сколько тренировок цикла уже позади (по текущему дню программы). */
export function cycleProgress(pos: Position): { done: number; total: number } {
  return { done: Math.max(0, TRAINING_DAYS.indexOf(pos.day)), total: TRAINING_DAYS.length };
}

export function nutritionScore(kcal: number, target: number | null): { text: string; frac: number } {
  const k = Math.round(kcal);
  if (!target) return { text: `${k} ккал`, frac: 0 };
  return { text: `${k}/${Math.round(target)}`, frac: Math.min(1, k / target) };
}
