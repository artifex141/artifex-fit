import { nextCycleConfig, type CycleMode } from '../program/cycle';
import { nextTrainingDay, type Position } from '../program/schedule';
import { DEFAULT_PROFILE, type ProfileInfo } from '../profile/profile';
import type { CycleConfig } from '../program/weights';
import { db, type EntryRow, type FoodRow, type SetRow, type SettingRow, type WorkoutRow } from './db';

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

export async function getProfile(): Promise<ProfileInfo> {
  return { ...DEFAULT_PROFILE, ...(await getSetting<Partial<ProfileInfo>>('profile', {})) };
}

export async function saveProfile(p: ProfileInfo): Promise<void> {
  await db.settings.put({ key: 'profile', value: p });
}

export async function getCycleConfig(cycle: number): Promise<CycleConfig> {
  return getSetting(`cycle:${cycle}`, { offsets: {}, startWeights: {} });
}

export async function saveCycleConfig(cycle: number, c: CycleConfig): Promise<void> {
  await db.settings.put({ key: `cycle:${cycle}`, value: c });
}

/** Начинает тренировку; если уже есть незавершённая — возвращает её (защита от двойного нажатия). */
export async function startWorkout(p: Position): Promise<number> {
  return db.transaction('rw', db.workouts, async () => {
    const open = await getOpenWorkout();
    if (open?.id !== undefined) return open.id;
    return db.workouts.add({ cycle: p.cycle, day: p.day, startedAt: Date.now() });
  });
}

/** Отменяет тренировку целиком: запись и все её подходы; позиция в программе не меняется. */
export async function discardWorkout(id: number): Promise<void> {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where({ workoutId: id }).delete();
    await db.workouts.delete(id);
  });
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

/** Цикл, который завершён, но веса следующего ещё не выбраны. */
export async function getPendingCycleEnd(): Promise<number | null> {
  return getSetting<number | null>('cycleEnd', null);
}

/**
 * Завершает тренировку и двигает позицию на следующий тренировочный день.
 * После последнего дня цикла позиция не меняется: ставится отметка cycleEnd, новый цикл начинает startNextCycle.
 */
export async function finishWorkout(id: number): Promise<{ next: Position; cycleEnd: boolean }> {
  const w = await db.workouts.get(id);
  if (!w) throw new Error('Тренировка не найдена');
  const next = nextTrainingDay({ cycle: w.cycle, day: w.day });
  const cycleEnd = next.cycle !== w.cycle;
  await db.transaction('rw', db.workouts, db.settings, async () => {
    await db.workouts.update(id, { finishedAt: Date.now() });
    if (cycleEnd) await db.settings.put({ key: 'cycleEnd', value: w.cycle });
    else await setPosition(next);
  });
  return { next, cycleEnd };
}

/** Закрывает цикл: считает настройки следующего по выбранному режиму и ставит позицию на день 1. */
export async function startNextCycle(prevCycle: number, mode: CycleMode): Promise<void> {
  await db.transaction('rw', db.sets, db.settings, async () => {
    const prev = await getCycleConfig(prevCycle);
    const log = (await db.sets.toArray()).filter((s) => s.cycle === prevCycle);
    await saveCycleConfig(prevCycle + 1, nextCycleConfig(prev, prevCycle, log, mode));
    await setPosition({ cycle: prevCycle + 1, day: 1 });
    await db.settings.delete('cycleEnd');
  });
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
  foods?: FoodRow[]; // питание (фото в копию не входят)
  entries?: EntryRow[];
}

export async function exportAll(): Promise<string> {
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
    settings: await db.settings.toArray(),
    foods: await db.foods.toArray(),
    entries: (await db.entries.toArray()).map(({ photoId: _photo, ...e }) => e),
  };
  return JSON.stringify(backup);
}

export async function importAll(json: string): Promise<void> {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(json) as Partial<Backup>;
  } catch {
    throw new Error('Файл повреждён');
  }
  if (data?.version !== 1 || !Array.isArray(data.workouts) || !Array.isArray(data.sets) || !Array.isArray(data.settings)) {
    throw new Error('Это не резервная копия Artifex Fit');
  }
  if ((data.foods && !Array.isArray(data.foods)) || (data.entries && !Array.isArray(data.entries))) throw new Error('Это не резервная копия Artifex Fit');
  await db.transaction('rw', [db.workouts, db.sets, db.settings, db.foods, db.entries], async () => {
    await Promise.all([db.workouts.clear(), db.sets.clear(), db.settings.clear(), db.foods.clear(), db.entries.clear()]);
    await db.workouts.bulkAdd(data.workouts!);
    await db.sets.bulkAdd(data.sets!);
    await db.settings.bulkAdd(data.settings!);
    if (data.foods) await db.foods.bulkAdd(data.foods);
    if (data.entries) await db.entries.bulkAdd(data.entries);
  });
}
