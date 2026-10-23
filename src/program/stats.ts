import type { SetRow, WorkoutRow } from '../db/db';
import { dayInfo } from './schedule';
import { programExercise } from './weights';

export type Period = 'week' | 'month' | 'year';

export function periodStart(period: Period, now: number): number {
  const d = new Date(now);
  if (period === 'year') return new Date(d.getFullYear(), 0, 1).getTime();
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
}

/** Тоннаж подхода: доп. вес к своему не считаем, блины на сторону ×2. */
function setTonnage(s: SetRow): number {
  const kind = programExercise(s.exerciseId).weeks[dayInfo(s.day).week - 1].weight.kind;
  if (kind === 'added') return 0;
  return s.lb * s.reps * (kind === 'plates' ? 2 : 1);
}

export function summary(workouts: WorkoutRow[], sets: SetRow[], from: number): { count: number; minutes: number; tonnage: number } {
  const done = workouts.filter((w) => w.finishedAt !== undefined && w.finishedAt >= from);
  const ids = new Set(done.map((w) => w.id));
  const minutes = Math.round(done.reduce((m, w) => m + (w.finishedAt! - w.startedAt), 0) / 60_000);
  const tonnage = sets.filter((s) => s.kind === 'work' && ids.has(s.workoutId)).reduce((t, s) => t + setTonnage(s), 0);
  return { count: done.length, minutes, tonnage };
}

export function weightSeries(exerciseId: string, workouts: WorkoutRow[], sets: SetRow[]): { date: number; lb: number }[] {
  return workouts
    .filter((w) => w.finishedAt !== undefined)
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((w) => {
      const lbs = sets.filter((s) => s.workoutId === w.id && s.exerciseId === exerciseId && s.kind === 'work').map((s) => s.lb);
      if (lbs.length === 0) return [];
      const counts = new Map<number, number>();
      for (const lb of lbs) counts.set(lb, (counts.get(lb) ?? 0) + 1);
      const lb = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      return [{ date: w.startedAt, lb }];
    });
}
