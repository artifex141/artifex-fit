// Сон из «Здоровья» (через «Команды» и сервер): отрезки со стадиями → ночи.
import { dayKey } from '../nutrition/calc';

export interface SleepSegment {
  start: number;
  end: number;
  stage: 'inBed' | 'awake' | 'core' | 'deep' | 'rem' | 'asleep';
}

export interface Night {
  date: string; // день пробуждения, 'YYYY-MM-DD'
  start: number;
  end: number;
  asleepMin: number;
  deepMin: number;
  inBedMin: number;
}

const GAP = 3 * 3600_000; // разрыв больше 3 ч — уже другой сон
const ASLEEP = new Set<SleepSegment['stage']>(['core', 'deep', 'rem', 'asleep']);

/** Сумма длин отрезков без двойного счёта перекрытий, в минутах. */
function unionMin(list: SleepSegment[]): number {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  let total = 0;
  let from = -Infinity;
  let to = -Infinity;
  for (const s of sorted) {
    if (s.start > to) {
      if (to > from) total += to - from;
      [from, to] = [s.start, s.end];
    } else to = Math.max(to, s.end);
  }
  if (to > from) total += to - from;
  return Math.round(total / 60_000);
}

/**
 * Ночи по возрастанию даты. Сон — по стадиям (часы); если стадий нет, а есть только «в кровати» (iPhone без часов) —
 * время в кровати. В один день — самый длинный сон (дневной не перебивает ночной).
 */
export function sleepNights(segments: SleepSegment[]): Night[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const sessions: SleepSegment[][] = [];
  let end = -Infinity;
  for (const s of sorted) {
    if (s.start > end + GAP) sessions.push([]);
    sessions[sessions.length - 1].push(s);
    end = Math.max(end, s.end);
  }
  const byDate = new Map<string, Night>();
  for (const list of sessions) {
    const asleep = unionMin(list.filter((s) => ASLEEP.has(s.stage)));
    const inBedMin = unionMin(list);
    const night: Night = {
      date: dayKey(new Date(Math.max(...list.map((s) => s.end)))),
      start: Math.min(...list.map((s) => s.start)),
      end: Math.max(...list.map((s) => s.end)),
      asleepMin: asleep || unionMin(list.filter((s) => s.stage !== 'awake')),
      deepMin: unionMin(list.filter((s) => s.stage === 'deep')),
      inBedMin,
    };
    const prev = byDate.get(night.date);
    if (!prev || night.asleepMin > prev.asleepMin) byDate.set(night.date, night);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** «6 ч 28 м» → { h: 6, m: 28 } */
export const hm = (min: number) => ({ h: Math.floor(min / 60), m: Math.round(min % 60) });

/** Карточка «Сон»: последняя ночь, оценка (7 ч+ — хорошо, 6–7 — норма) или дата, если ночь старше двух дней. */
export function lastNight(nights: Night[], now: number): { min: number; status: string; frac: number } | null {
  const last = nights[nights.length - 1];
  if (!last) return null;
  const [y, m, d] = last.date.split('-').map(Number);
  const old = now - new Date(y, m - 1, d).getTime() > 2 * 86_400_000;
  const status = old
    ? new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
    : last.asleepMin >= 420 ? 'Хорошо' : last.asleepMin >= 360 ? 'Норма' : 'Мало';
  return { min: last.asleepMin, status, frac: Math.min(1, last.asleepMin / 480) };
}
