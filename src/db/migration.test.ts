import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { expect, test } from 'vitest';

test('обновление базы до версии 2 сохраняет тренировки и подходы', async () => {
  // База, какой она была на телефоне до «Питания» (схема v1)
  const v1 = new Dexie('artifex-fit');
  v1.version(1).stores({ workouts: '++id, cycle, day, startedAt', sets: '++id, workoutId, &[workoutId+exerciseId+kind+index], exerciseId', settings: 'key' });
  await v1.open();
  const wid = await v1.table('workouts').add({ cycle: 1, day: 12, startedAt: 1, finishedAt: 2 });
  await v1.table('sets').add({ workoutId: wid, cycle: 1, day: 12, exerciseId: 'db-bench-press', kind: 'work', index: 0, lb: 70, reps: 10, doneAt: 3 });
  await v1.table('settings').put({ key: 'position', value: { cycle: 1, day: 15 } });
  v1.close();

  const { db } = await import('./db');
  await db.open();
  expect(db.verno).toBe(2);
  expect(await db.workouts.count()).toBe(1);
  expect((await db.sets.toArray())[0].lb).toBe(70);
  expect((await db.settings.get('position'))?.value).toEqual({ cycle: 1, day: 15 });
  expect(await db.foods.count()).toBe(0);
  expect(await db.entries.count()).toBe(0);
});
