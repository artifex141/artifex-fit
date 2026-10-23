// Профиль: личные данные, цель и достижения (считаются из журнала тренировок и замеров тела).
import type { WorkoutRow } from '../db/db';
import type { BodyData, Sample } from '../body/body';

export interface ProfileInfo {
  name: string;
  birthYear: number | null;
  heightCm: number | null;
  goal: 'mass' | 'cut' | 'keep';
  goalWeightLb: number | null;
}

export const DEFAULT_PROFILE: ProfileInfo = { name: 'Атлет', birthYear: null, heightCm: null, goal: 'mass', goalWeightLb: null };

export const GOAL_LABEL: Record<ProfileInfo['goal'], string> = {
  mass: 'Набор мышечной массы',
  cut: 'Снижение жира',
  keep: 'Поддержание формы',
};

const KG_TO_LB = 2.20462;
const round1 = (v: number) => Math.round(v * 10) / 10;

export function ageFrom(birthYear: number, now: number): number {
  return new Date(now).getUTCFullYear() - birthYear;
}

/** 179 см → 5′10.5″ */
export function formatHeight(cm: number): string {
  const inches = cm / 2.54;
  const ft = Math.floor(inches / 12);
  return `${ft}′${round1(inches - ft * 12)}″`;
}

export function goalProgress(currentLb: number | null, targetLb: number) {
  if (currentLb === null) return { current: null, target: targetLb, fraction: 0 };
  return { current: currentLb, target: targetLb, fraction: Math.min(1, Math.round((currentLb / targetLb) * 1000) / 1000) };
}

export interface Achievement {
  id: string;
  title: string;
  date: number;
  tier: 'gold' | 'silver';
}

const MILESTONES = [1, 10, 25, 50, 100, 200, 300];

/** Ближайший по времени замер веса к дате. */
function weightAt(list: Sample[], date: number): number | null {
  if (list.length === 0) return null;
  return list.reduce((best, s) => (Math.abs(s.date - date) < Math.abs(best.date - date) ? s : best)).value;
}

export function achievements(workouts: WorkoutRow[], body: BodyData, now: number): Achievement[] {
  void now;
  const out: Achievement[] = [];
  const done = workouts.filter((w) => w.finishedAt !== undefined).sort((a, b) => a.finishedAt! - b.finishedAt!);

  for (const m of MILESTONES) {
    if (done.length >= m) {
      out.push({ id: `w${m}`, title: m === 1 ? 'Первая тренировка' : `${m} тренировок`, date: done[m - 1].finishedAt!, tier: m >= 50 ? 'silver' : 'gold' });
    }
  }

  for (const w of done.filter((w) => w.day === 33)) {
    out.push({ id: `c${w.cycle}`, title: `Цикл ${w.cycle} завершён`, date: w.finishedAt!, tier: 'gold' });
  }

  // Сброшенный жир: масса жира (вес × %) в первом и последнем замере процента жира.
  const fat = [...(body.bodyFat ?? [])].sort((a, b) => a.date - b.date);
  const weight = body.weight ?? [];
  if (fat.length >= 2 && weight.length > 0) {
    const first = fat[0];
    const last = fat[fat.length - 1];
    const w0 = weightAt(weight, first.date);
    const w1 = weightAt(weight, last.date);
    if (w0 !== null && w1 !== null) {
      const lostLb = round1(((w0 * first.value) / 100 - (w1 * last.value) / 100) * KG_TO_LB);
      if (lostLb >= 1) out.push({ id: 'fat', title: `−${lostLb} lb жира`, date: last.date, tier: 'gold' });
    }
  }

  return out.sort((a, b) => b.date - a.date);
}
