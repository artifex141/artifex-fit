import type { ProgramExercise, Week } from './types';

export type AfterSet = { kind: 'stay' } | { kind: 'open'; exerciseId: string } | { kind: 'finish' };

/**
 * Что делать после записи подхода. doneBefore — сколько рабочих подходов каждого упражнения
 * записано без учёта этого. Упражнение закрыто → раскрыть следующее несделанное (сначала ниже, потом выше);
 * несделанных нет → предложить завершить тренировку.
 */
export function afterSet(exercises: ProgramExercise[], week: Week, doneBefore: Record<string, number>, exerciseId: string, index: number): AfterSet {
  const done = { ...doneBefore, [exerciseId]: (doneBefore[exerciseId] ?? 0) + 1 };
  const total = (e: ProgramExercise) => e.weeks[week - 1].sets;
  const isDone = (e: ProgramExercise) => (done[e.exerciseId] ?? 0) >= total(e);
  const i = exercises.findIndex((e) => e.exerciseId === exerciseId);
  if (i < 0 || !isDone(exercises[i]) || index < 0) return { kind: 'stay' };
  const next = exercises.slice(i + 1).find((e) => !isDone(e)) ?? exercises.slice(0, i).find((e) => !isDone(e));
  return next ? { kind: 'open', exerciseId: next.exerciseId } : { kind: 'finish' };
}
