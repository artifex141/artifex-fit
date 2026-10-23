// Замеры тела из Zepp Life → Apple Health → «Команды» → сервер fit.artifex.mobi → сюда.
import { push } from '../push/push';

export interface Sample {
  date: number;
  value: number;
}
export type BodyData = Partial<Record<'weight' | 'bodyFat' | 'leanMass' | 'bmi', Sample[]>>;

const DAY = 86_400_000;
const CACHE = 'artifex.body';
const round = (v: number) => Math.round(v * 10) / 10;

/** Последнее значение, изменение к замеру ~4 недели назад и ряд за 30 дней (для графика). */
export function metric(list: Sample[] | undefined, now: number) {
  if (!list || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.date - b.date);
  const last = sorted[sorted.length - 1];
  const before = sorted.filter((s) => s.date <= now - 28 * DAY);
  const base = before.length ? before[before.length - 1] : sorted.length > 1 ? sorted[0] : null;
  return {
    value: last.value,
    delta: base && base !== last ? round(last.value - base.value) : null,
    series: sorted.filter((s) => s.date >= now - 30 * DAY).map((s) => ({ date: s.date, lb: s.value })),
    lastDate: last.date,
  };
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
