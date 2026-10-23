import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import {
  allSets,
  deleteSet,
  discardWorkout,
  exportAll,
  finishWorkout,
  getCycleConfig,
  getOpenWorkout,
  getPendingCycleEnd,
  getPosition,
  getProfile,
  importAll,
  saveCycleConfig,
  saveProfile,
  saveSet,
  setPosition,
  startNextCycle,
  startWorkout,
} from './repo';

beforeEach(async () => {
  await Promise.all([db.workouts.clear(), db.sets.clear(), db.settings.clear()]);
});

const base = { cycle: 1, day: 12, exerciseId: 'db-bench-press', kind: 'work' as const };

test('позиция по умолчанию — цикл 1, день 12', async () => {
  expect(await getPosition()).toEqual({ cycle: 1, day: 12 });
  await setPosition({ cycle: 1, day: 15 });
  expect(await getPosition()).toEqual({ cycle: 1, day: 15 });
});

test('настройки цикла по умолчанию пустые и сохраняются', async () => {
  expect(await getCycleConfig(2)).toEqual({ offsets: {}, startWeights: {} });
  await saveCycleConfig(2, { offsets: { 'db-bench-press': 5 }, startWeights: {} });
  expect((await getCycleConfig(2)).offsets['db-bench-press']).toBe(5);
});

test('повторное сохранение подхода обновляет запись, а не дублирует', async () => {
  const workoutId = await startWorkout({ cycle: 1, day: 12 });
  await saveSet({ ...base, workoutId, index: 0, lb: 70, reps: 10 });
  await saveSet({ ...base, workoutId, index: 0, lb: 70, reps: 9 });
  const all = await allSets();
  expect(all).toHaveLength(1);
  expect(all[0].reps).toBe(9);
});

test('подход можно удалить', async () => {
  const workoutId = await startWorkout({ cycle: 1, day: 12 });
  await saveSet({ ...base, workoutId, index: 0, lb: 70, reps: 10 });
  await deleteSet(workoutId, 'db-bench-press', 'work', 0);
  expect(await allSets()).toHaveLength(0);
});

test('незавершённая тренировка находится после перезапуска', async () => {
  const id = await startWorkout({ cycle: 1, day: 12 });
  expect((await getOpenWorkout())?.id).toBe(id);
});

test('завершение тренировки двигает позицию на следующий день', async () => {
  const id = await startWorkout({ cycle: 1, day: 12 });
  expect(await finishWorkout(id)).toEqual({ next: { cycle: 1, day: 15 }, cycleEnd: false });
  expect(await getPosition()).toEqual({ cycle: 1, day: 15 });
  expect(await getOpenWorkout()).toBeUndefined();
});

test('экспорт и импорт восстанавливают данные', async () => {
  const workoutId = await startWorkout({ cycle: 1, day: 12 });
  await saveSet({ ...base, workoutId, index: 0, lb: 70, reps: 10 });
  await setPosition({ cycle: 1, day: 15 });
  const json = await exportAll();
  await Promise.all([db.workouts.clear(), db.sets.clear(), db.settings.clear()]);
  await importAll(json);
  expect(await allSets()).toHaveLength(1);
  expect(await getPosition()).toEqual({ cycle: 1, day: 15 });
});

test('новый цикл: настройки считаются по прошлому циклу, позиция — день 1', async () => {
  const workoutId = await startWorkout({ cycle: 1, day: 15 });
  for (const index of [0, 1, 2]) await saveSet({ workoutId, cycle: 1, day: 15, exerciseId: 'ez-curl', kind: 'work', index, lb: 55, reps: 10 });
  await startNextCycle(1, 'program');
  expect(await getPosition()).toEqual({ cycle: 2, day: 1 });
  const cfg = await getCycleConfig(2);
  expect(cfg.startWeights['ez-curl']).toBe(55);
  expect(cfg.offsets['db-bench-press']).toBe(5);
});

test('последняя тренировка цикла не переводит на новый цикл, а ждёт выбора весов', async () => {
  await setPosition({ cycle: 1, day: 33 });
  const id = await startWorkout({ cycle: 1, day: 33 });
  expect((await finishWorkout(id)).cycleEnd).toBe(true);
  expect(await getPendingCycleEnd()).toBe(1);
  expect(await getPosition()).toEqual({ cycle: 1, day: 33 });
  await startNextCycle(1, 'program');
  expect(await getPendingCycleEnd()).toBeNull();
  expect(await getPosition()).toEqual({ cycle: 2, day: 1 });
});

test('двойное нажатие «Начать» не создаёт вторую тренировку', async () => {
  const [a, b] = await Promise.all([startWorkout({ cycle: 1, day: 12 }), startWorkout({ cycle: 1, day: 12 })]);
  expect(a).toBe(b);
  expect(await db.workouts.count()).toBe(1);
});

test('отмена тренировки удаляет её и разминку, позиция не меняется', async () => {
  const id = await startWorkout({ cycle: 1, day: 12 });
  await saveSet({ ...base, kind: 'warmup', workoutId: id, index: 0, lb: 0, reps: 0 });
  await discardWorkout(id);
  expect(await db.workouts.count()).toBe(0);
  expect(await allSets()).toHaveLength(0);
  expect(await getOpenWorkout()).toBeUndefined();
  expect(await getPosition()).toEqual({ cycle: 1, day: 12 });
});

test('битый файл: понятная ошибка на русском', async () => {
  await expect(importAll('{bad')).rejects.toThrow('Файл повреждён');
});

test('битый файл не трогает данные', async () => {
  const workoutId = await startWorkout({ cycle: 1, day: 12 });
  await saveSet({ ...base, workoutId, index: 0, lb: 70, reps: 10 });
  await expect(importAll('{bad')).rejects.toThrow();
  await expect(importAll(JSON.stringify({ version: 2, workouts: [], sets: [], settings: [] }))).rejects.toThrow();
  await expect(importAll(JSON.stringify({ version: 1, workouts: 'x', sets: [], settings: [] }))).rejects.toThrow();
  expect(await allSets()).toHaveLength(1);
});

test('профиль: по умолчанию «Атлет», сохраняется и читается', async () => {
  expect((await getProfile()).name).toBe('Атлет');
  await saveProfile({ name: 'Алексей', birthYear: 1998, heightCm: 179, goal: 'mass', goalWeightLb: 175 });
  expect(await getProfile()).toEqual({ name: 'Алексей', birthYear: 1998, heightCm: 179, goal: 'mass', goalWeightLb: 175 });
});
