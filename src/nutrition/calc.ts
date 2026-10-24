// Расчёты питания: пересчёт на порцию, итоги, приём по времени, дневная норма.

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Per100 {
  kcal: number;
  p: number;
  f: number;
  c: number;
}
export type Macros = Per100;
export interface Targets extends Macros {
  manual: boolean;
}

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекусы' };

const r1 = (v: number) => Math.round(v * 10) / 10;

/** КБЖУ порции: ккал до 1, граммы БЖУ до 0,1. */
export function scale(per100: Per100, grams: number): Macros {
  const k = grams / 100;
  return { kcal: Math.round(per100.kcal * k), p: r1(per100.p * k), f: r1(per100.f * k), c: r1(per100.c * k) };
}

export function sumMacros(list: Macros[]): Macros {
  const s = list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f, c: a.c + m.c }), { kcal: 0, p: 0, f: 0, c: 0 });
  return { kcal: Math.round(s.kcal), p: r1(s.p), f: r1(s.f), c: r1(s.c) };
}

/** До 11:00 — завтрак, до 16:00 — обед, до 21:00 — ужин, позже — перекус. */
export function mealByTime(date: Date): Meal {
  const h = date.getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

/**
 * Норма по Миффлину — Сан Жеору (мужчина) × 1,55 (три тяжёлые тренировки в неделю), поправка на цель.
 * Белок — 1 г на фунт веса, жир — 25 % калорий, углеводы — остаток.
 */
export function autoTargets({ weightLb, heightCm, age, goal }: { weightLb: number; heightCm: number; age: number; goal: 'mass' | 'cut' | 'keep' }): Targets {
  const kg = weightLb / 2.20462;
  const tdee = (10 * kg + 6.25 * heightCm - 5 * age + 5) * 1.55;
  const kcal = Math.round((tdee * { mass: 1.1, cut: 0.8, keep: 1 }[goal]) / 10) * 10;
  const p = Math.round(weightLb);
  const f = Math.round((0.25 * kcal) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return { kcal, p, f, c, manual: false };
}

const pad = (n: number) => String(n).padStart(2, '0');
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
