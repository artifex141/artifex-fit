import { nextCycleConfig, type CycleMode } from '../program/cycle';
import { nextTrainingDay, type Position } from '../program/schedule';
import type { CycleConfig } from '../program/weights';
import { db, type SetRow, type SettingRow, type WorkoutRow } from './db';

export type { Position } from '../program/schedule';
export type { SetRow, WorkoutRow } from './db';

const START: Position = { cycle: 1, day: 12 };

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function getPosition(): Promise<Position> {
  return getSetting('position', START);
}

export async function setPosition(p: Position): Promise<void> {
  await db.settings.put({ key: 'position', value: p });
}

export async function getCycleConfig(cycle: number): Promise<CycleConfig> {
  return getSetting(`cycle:${cycle}`, { offsets: {}, startWeights: {} });
}

export async function saveCycleConfig(cycle: number, c: CycleConfig): Promise<void> {
  await db.settings.put({ key: `cycle:${cycle}`, value: c });
}

export async function startWorkout(p: Position): Promise<number> {
  return db.workouts.add({ cycle: p.cycle, day: p.day, startedAt: Date.now() });
}

export async function getOpenWorkout(): Promise<WorkoutRow | undefined> {
  return db.workouts.filter((w) => w.finishedAt === undefined).first();
}

export async function saveSet(s: Omit<SetRow, 'id' | 'doneAt'>): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const existing = await db.sets.where({ workoutId: s.workoutId, exerciseId: s.exerciseId, kind: s.kind, index: s.index }).first();
    await db.sets.put({ ...s, id: existing?.id, doneAt: Date.now() });
  });
}

export async function deleteSet(workoutId: number, exerciseId: string, kind: 'warmup' | 'work', index: number): Promise<void> {
  await db.sets.where({ workoutId, exerciseId, kind, index }).delete();
}

export async function finishWorkout(id: number): Promise<Position> {
  const w = await db.workouts.get(id);
  if (!w) throw new Error('Тренировка не найдена');
  const next = nextTrainingDay({ cycle: w.cycle, day: w.day });
  await db.transaction('rw', db.workouts, db.settings, async () => {
    await db.workouts.update(id, { finishedAt: Date.now() });
    await setPosition(next);
  });
  return next;
}

/** Закрывает цикл: считает настройки следующего по выбранному режиму и ставит позицию на день 1. */
export async function startNextCycle(prevCycle: number, mode: CycleMode): Promise<void> {
  const prev = await getCycleConfig(prevCycle);
  const log = (await db.sets.toArray()).filter((s) => s.cycle === prevCycle);
  await saveCycleConfig(prevCycle + 1, nextCycleConfig(prev, prevCycle, log, mode));
  await setPosition({ cycle: prevCycle + 1, day: 1 });
}

export async function allSets(): Promise<SetRow[]> {
  return db.sets.toArray();
}

interface Backup {
  version: 1;
  exportedAt: string;
  workouts: WorkoutRow[];
  sets: SetRow[];
  settings: SettingRow[];
}

export async function exportAll(): Promise<string> {
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
    settings: await db.settings.toArray(),
  };
  return JSON.stringify(backup);
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json) as Partial<Backup>;
  if (data?.version !== 1 || !Array.isArray(data.workouts) || !Array.isArray(data.sets) || !Array.isArray(data.settings)) {
    throw new Error('Это не резервная копия Artifex Fit');
  }
  await db.transaction('rw', db.workouts, db.sets, db.settings, async () => {
    await Promise.all([db.workouts.clear(), db.sets.clear(), db.settings.clear()]);
    await db.workouts.bulkAdd(data.workouts!);
    await db.sets.bulkAdd(data.sets!);
    await db.settings.bulkAdd(data.settings!);
  });
}
