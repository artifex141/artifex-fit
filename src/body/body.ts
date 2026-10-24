// Замеры тела из Zepp Life → Apple Health → «Команды» → сервер fit.artifex.mobi → сюда.
import { push } from '../push/push';
import type { SleepSegment } from './sleep';

export interface Sample {
  date: number;
  value: number;
}
export type BodyData = Partial<Record<'weight' | 'bodyFat' | 'leanMass' | 'bmi', Sample[]>> & { sleep?: SleepSegment[] };

const DAY = 86_400_000;
const CACHE = 'artifex.body';
const round = (v: number) => Math.round(v * 10) / 10;

/** Последнее значение, изменение к замеру за ~4 недели до него и ряд за 30 дней до последнего замера (для графика). */
export function metric(list: Sample[] | undefined, now: number) {
  if (!list || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.date - b.date);
  const last = sorted[sorted.length - 1];
  // Окно — 4 недели до последнего замера (а не до сегодня): старые данные тоже показываются графиком.
  void now;
  const before = sorted.filter((s) => s.date <= last.date - 28 * DAY);
  const base = before.length ? before[before.length - 1] : sorted.length > 1 ? sorted[0] : null;
  return {
    value: last.value,
    delta: base && base !== last ? round(last.value - base.value) : null,
    series: sorted.filter((s) => s.date >= last.date - 30 * DAY).map((s) => ({ date: s.date, lb: s.value })),
    lastDate: last.date,
  };
}

export const KG_TO_LB = 2.20462;
const lb = (kg: number) => round(kg * KG_TO_LB);

/** Тот же показатель в фунтах (вес и сухая масса хранятся в кг). */
export function inLb(m: ReturnType<typeof metric>) {
  if (!m) return null;
  return { ...m, value: lb(m.value), delta: m.delta === null ? null : lb(m.delta), series: m.series.map((p) => ({ date: p.date, lb: lb(p.lb) })) };
}

export function cachedBody(): BodyData {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '{}') as BodyData;
  } catch {
    return {};
  }
}

/** Свежие замеры с сервера; без сети — последние сохранённые. */
export async function loadBody(api = import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi'): Promise<BodyData> {
  try {
    const r = await fetch(`${api}/api/body?deviceId=${encodeURIComponent(push.deviceId())}`);
    if (!r.ok) return cachedBody();
    const data = (await r.json()) as BodyData;
    try {
      localStorage.setItem(CACHE, JSON.stringify(data));
    } catch {
      /* приватный режим */
    }
    return data;
  } catch {
    return cachedBody();
  }
}
