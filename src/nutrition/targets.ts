// Дневная норма для экрана «Питание» и профиля.
import { inLb, metric, type BodyData } from '../body/body';
import { ageFrom, type ProfileInfo } from '../profile/profile';
import { autoTargets, type Targets } from './calc';

/** Норма: сохранённая; иначе расчёт из профиля и последнего веса; без данных — null. */
export function resolveTargets(saved: Targets | null, profile: ProfileInfo, body: BodyData, now: number): Targets | null {
  if (saved) return saved;
  const weight = inLb(metric(body.weight, now));
  if (!weight || !profile.birthYear || !profile.heightCm) return null;
  return autoTargets({ weightLb: weight.value, heightCm: profile.heightCm, age: ageFrom(profile.birthYear, now), goal: profile.goal });
}
