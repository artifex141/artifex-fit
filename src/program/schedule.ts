import type { DayType, Week } from './types';

export interface Position {
  cycle: number;
  day: number;
}

export const TRAINING_DAYS: readonly number[] = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29, 31, 33];

const TYPES: DayType[] = ['A', 'B', 'C'];
const RIR: Record<Week, string> = { 1: '3', 2: '2', 3: '1', 4: '0–1', 5: '4–5' };

export function dayInfo(day: number): { week: Week; type: DayType; rir: string } {
  const i = TRAINING_DAYS.indexOf(day);
  if (i < 0) throw new Error(`День ${day} — не тренировочный`);
  const week = (Math.floor(i / 3) + 1) as Week;
  return { week, type: TYPES[i % 3], rir: RIR[week] };
}

export function nextTrainingDay(pos: Position): Position {
  const i = TRAINING_DAYS.indexOf(pos.day);
  if (i < 0 || i === TRAINING_DAYS.length - 1) return { cycle: pos.cycle + 1, day: TRAINING_DAYS[0] };
  return { cycle: pos.cycle, day: TRAINING_DAYS[i + 1] };
}
