// Демо-данные для блоков, у которых пока нет источника (Apple Watch, весы, шаги).
// Убрать, когда появятся настоящие данные: поиск по DEMO.
export const DEMO = true;

/** Детерминированный «случайный» ряд: одинаковый при каждом открытии. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Пульс за 15 минут тренировки: разгон, пики на подходах, текущее значение 124. */
export function demoHeartRate(): { t: number; bpm: number }[] {
  const r = rng(7);
  const pts: { t: number; bpm: number }[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 4; // минуты
    const base = 78 + 38 * (1 - Math.exp(-t / 4));
    const wave = 18 * Math.max(0, Math.sin((t / 15) * Math.PI * 5.2));
    pts.push({ t, bpm: Math.round(base + wave + (r() - 0.5) * 8) });
  }
  pts[pts.length - 1].bpm = 124;
  return pts;
}

/** Вес тела за 4 недели (кг), последнее значение 80.2. */
export function demoBodyWeight(now: number): { date: number; lb: number }[] {
  const r = rng(3);
  const day = 86_400_000;
  return Array.from({ length: 29 }, (_, i) => ({
    date: now - (28 - i) * day,
    lb: i === 28 ? 80.2 : Math.round((81.6 - i * 0.05 + (r() - 0.5) * 0.9) * 10) / 10,
  }));
}

/** Пульс в покое по дням (уд/мин) и сон по дням (часы). */
export function demoDaily(n: number, base: number, spread: number, seed: number): number[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => Math.round((base + (r() - 0.5) * spread) * 10) / 10);
}
