import { DAYS } from './program';
import type { DayType, WeightRule } from './types';
import { anchorWeight, type CycleConfig, type LoggedSet } from './weights';

export type CycleMode = 'program' | 'best';

function planned(rule: WeightRule): number | null {
  switch (rule.kind) {
    case 'fixed':
    case 'added':
      return rule.lb;
    case 'plates':
      return rule.perSide;
    case 'inclineW4':
      return 75;
    default:
      return null;
  }
}

/**
 * Настройки следующего цикла.
 * program: «веса недели 2, в подборных — Н3»; best: то же плюс перевыполнение недели 4, в подборных — Н4.
 */
export function nextCycleConfig(prev: CycleConfig, cycle: number, log: LoggedSet[], mode: CycleMode): CycleConfig {
  const offsets: Record<string, number> = { ...prev.offsets };
  const startWeights: Record<string, number> = { ...prev.startWeights };

  for (const t of ['A', 'B', 'C'] as DayType[]) {
    for (const pe of DAYS[t].exercises) {
      const id = pe.exerciseId;
      const w1 = planned(pe.weeks[0].weight);
      if (w1 !== null) {
        const prevOffset = prev.offsets[id] ?? 0;
        let offset = prevOffset + (planned(pe.weeks[1].weight)! - w1);
        if (mode === 'best') {
          const fact4 = anchorWeight(id, 4, cycle, log, prev);
          const plan4 = planned(pe.weeks[3].weight);
          if (fact4 !== null && plan4 !== null) offset += Math.max(0, fact4 - (plan4 + prevOffset));
        }
        offsets[id] = offset;
      } else {
        const h3 = anchorWeight(id, 3, cycle, log, prev);
        const h4 = mode === 'best' ? anchorWeight(id, 4, cycle, log, prev) : null;
        const start = h4 ?? h3;
        if (start !== null) startWeights[id] = start;
      }
    }
  }
  return { offsets, startWeights };
}
