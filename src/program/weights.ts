import { DAYS, stepFor } from './program';
import { dayInfo } from './schedule';
import type { DayType, Prescription, ProgramExercise, Week, WeightRule } from './types';

export interface LoggedSet {
  cycle: number;
  day: number;
  exerciseId: string;
  kind: 'warmup' | 'work';
  index: number;
  lb: number;
  reps: number;
  dropReps?: number;
}

export interface CycleConfig {
  offsets: Record<string, number>; // прибавка к fixed / added / plates
  startWeights: Record<string, number>; // Н1 для упражнений с подбором веса
}

export interface Target {
  lb: number | null;
  repsMin: number;
  repsMax: number;
  source: 'program' | 'anchor' | 'heldBack' | 'unknown';
  hint?: string;
}

const PROGRAM_EXERCISES: Record<string, ProgramExercise> = Object.fromEntries(
  (['A', 'B', 'C'] as DayType[]).flatMap((t) => DAYS[t].exercises.map((e) => [e.exerciseId, e])),
);

export function programExercise(exerciseId: string): ProgramExercise {
  const pe = PROGRAM_EXERCISES[exerciseId];
  if (!pe) throw new Error(`Нет упражнения ${exerciseId}`);
  return pe;
}

export function roundTo(lb: number, step: number): number {
  return Math.round(lb / step) * step;
}

function workSets(exerciseId: string, week: Week, cycle: number, log: LoggedSet[]): LoggedSet[] {
  return log.filter((s) => s.kind === 'work' && s.cycle === cycle && s.exerciseId === exerciseId && dayInfo(s.day).week === week);
}

/** Самый частый вес; при равенстве — больший. */
function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && v > best)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function anchorWeight(exerciseId: string, week: Week, cycle: number, log: LoggedSet[], cfg: CycleConfig): number | null {
  const own = mode(workSets(exerciseId, week, cycle, log).map((s) => s.lb));
  if (own !== null || week !== 1) return own;
  // На неделе 2 программа даёт «вес Н1», так что её записи — тоже Н1.
  return mode(workSets(exerciseId, 2, cycle, log).map((s) => s.lb)) ?? cfg.startWeights[exerciseId] ?? null;
}

function programWeight(rule: WeightRule): number | null {
  switch (rule.kind) {
    case 'fixed':
    case 'added':
      return rule.lb;
    case 'plates':
      return rule.perSide;
    default:
      return null;
  }
}

function lastLoggedWeight(exerciseId: string, cycle: number, log: LoggedSet[]): number | null {
  const own = log
    .filter((s) => s.kind === 'work' && s.cycle === cycle && s.exerciseId === exerciseId)
    .sort((a, b) => a.day - b.day || a.index - b.index);
  return own.length ? own[own.length - 1].lb : null;
}

function baseTarget(p: Prescription, exerciseId: string, cycle: number, log: LoggedSet[], cfg: CycleConfig): Target {
  const reps = { repsMin: p.repsMin, repsMax: p.repsMax };
  const offset = cfg.offsets[exerciseId] ?? 0;
  const step = stepFor(exerciseId);
  const rule = p.weight;
  switch (rule.kind) {
    case 'fixed':
    case 'added':
    case 'plates':
      return { lb: programWeight(rule)! + offset, ...reps, source: 'program' };
    case 'pick': {
      const lb = lastLoggedWeight(exerciseId, cycle, log) ?? cfg.startWeights[exerciseId] ?? null;
      return lb === null
        ? { lb: null, ...reps, source: 'unknown', hint: 'Подбери вес: 3 повторения в запасе' }
        : { lb, ...reps, source: 'anchor' };
    }
    case 'anchor': {
      const h = anchorWeight(exerciseId, rule.week, cycle, log, cfg);
      return h === null
        ? { lb: null, ...reps, source: 'unknown', hint: `Введи свой вес Н${rule.week}` }
        : { lb: roundTo(h + rule.deltaLb, step), ...reps, source: 'anchor' };
    }
    case 'pct': {
      const h = anchorWeight(exerciseId, rule.week, cycle, log, cfg);
      const mid = (rule.min + rule.max) / 2;
      return h === null
        ? { lb: null, ...reps, source: 'unknown', hint: `Нет веса Н${rule.week}: возьми 70–75% от него` }
        : { lb: roundTo(h * mid, step), ...reps, source: 'anchor' };
    }
    case 'inclineW4': {
      const w3 = workSets(exerciseId, 3, cycle, log);
      const ok = w3.filter((s) => s.lb >= 70 + offset && s.reps >= 10).length >= 4;
      return ok
        ? { lb: 75 + offset, repsMin: 8, repsMax: 8, source: 'program' }
        : { lb: 70 + offset, repsMin: 10, repsMax: 12, source: 'program', hint: '75 lb — только после 70×10 во всех подходах на неделе 3' };
    }
  }
}

export function targetFor(exerciseId: string, week: Week, cycle: number, log: LoggedSet[], cfg: CycleConfig): Target {
  const pe = programExercise(exerciseId);
  const t = baseTarget(pe.weeks[week - 1], exerciseId, cycle, log, cfg);
  if (week < 2 || week > 4 || t.lb === null) return t;

  // Правило недобора: на прошлой неделе подход на 2+ повторения меньше плана → вес не повышаем.
  const prevWeek = (week - 1) as Week;
  const prevMin = pe.weeks[prevWeek - 1].repsMin;
  const prev = workSets(exerciseId, prevWeek, cycle, log);
  const prevLb = mode(prev.map((s) => s.lb));
  const missed = prev.some((s) => s.reps <= prevMin - 2);
  if (missed && prevLb !== null && t.lb > prevLb) {
    return { ...t, lb: prevLb, source: 'heldBack', hint: 'Вес не повышен: на прошлой неделе недобор повторений' };
  }
  return t;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function formatWeight(rule: WeightRule, lb: number | null): string {
  if (lb === null) return '—';
  if (rule.kind === 'added') return lb === 0 ? 'без веса' : `+${fmt(lb)} lb`;
  if (rule.kind === 'plates') {
    const n = Math.floor(lb / 45);
    if (n === 0) return `${fmt(lb)} lb / стор.`;
    const rest = lb - n * 45;
    return rest > 0 ? `${n}×45 +${fmt(rest)} / стор.` : `${n}×45 / стор.`;
  }
  return `${fmt(lb)} lb`;
}
