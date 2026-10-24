import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { addEntries, clearTargets, daysWithEntries, deleteEntry, entriesOn, getTargets, recentFoods, saveTargets, setEntryGrams, upsertFood } from './nutrition';
import { exportAll, importAll } from './repo';

const OATS = { kcal: 350, p: 12, f: 1.5, c: 72 };

beforeEach(async () => {
  await Promise.all([db.foods.clear(), db.entries.clear(), db.photos.clear(), db.settings.clear()]);
});

test('запись считает КБЖУ порции и хранит фото', async () => {
  await addEntries('2026-10-23', 'breakfast', [{ name: 'Овсянка', grams: 150, per100: OATS }], new Blob(['jpg']));
  const [e] = await entriesOn('2026-10-23');
  expect(e).toMatchObject({ meal: 'breakfast', name: 'Овсянка', grams: 150, kcal: 525, p: 18, f: 2.3, c: 108 });
  expect(e.photoId).toBeDefined();
  expect(await db.photos.count()).toBe(1);
});

test('правка граммов пересчитывает КБЖУ, удаление убирает запись', async () => {
  await addEntries('2026-10-23', 'lunch', [{ name: 'Овсянка', grams: 100, per100: OATS }]);
  const [e] = await entriesOn('2026-10-23');
  await setEntryGrams(e.id!, 200);
  expect((await entriesOn('2026-10-23'))[0]).toMatchObject({ grams: 200, kcal: 700, p: 24 });
  await deleteEntry(e.id!);
  expect(await entriesOn('2026-10-23')).toHaveLength(0);
});

test('повторный штрихкод — тот же продукт; недавние — по последнему использованию', async () => {
  const a = await upsertFood({ source: 'off', name: 'Йогурт', barcode: '4600000000001', per100: { kcal: 60, p: 5, f: 1.5, c: 7 } });
  const b = await upsertFood({ source: 'off', name: 'Йогурт 1,5%', barcode: '4600000000001', per100: { kcal: 60, p: 5, f: 1.5, c: 7 } });
  expect(b).toBe(a);
  expect(await db.foods.count()).toBe(1);
  expect((await db.foods.get(a))?.name).toBe('Йогурт 1,5%');
  await upsertFood({ source: 'manual', name: 'Банан', per100: { kcal: 89, p: 1.1, f: 0.3, c: 23 } });
  expect((await recentFoods())[0].name).toBe('Банан');
});

test('история: дни с записями и суммой ккал, новые сверху', async () => {
  await addEntries('2026-10-22', 'dinner', [{ name: 'Овсянка', grams: 100, per100: OATS }]);
  await addEntries('2026-10-23', 'breakfast', [
    { name: 'Овсянка', grams: 100, per100: OATS },
    { name: 'Овсянка', grams: 50, per100: OATS },
  ]);
  expect(await daysWithEntries()).toEqual([
    { date: '2026-10-23', kcal: 525 },
    { date: '2026-10-22', kcal: 350 },
  ]);
});

test('норма: нет — null; сохраняется', async () => {
  expect(await getTargets()).toBeNull();
  await saveTargets({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
  expect(await getTargets()).toEqual({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
  await clearTargets();
  expect(await getTargets()).toBeNull();
});

test('резервная копия включает продукты и записи питания', async () => {
  await upsertFood({ source: 'manual', name: 'Банан', per100: { kcal: 89, p: 1.1, f: 0.3, c: 23 } });
  await addEntries('2026-10-23', 'snack', [{ name: 'Банан', grams: 120, per100: { kcal: 89, p: 1.1, f: 0.3, c: 23 } }]);
  const json = await exportAll();
  await Promise.all([db.foods.clear(), db.entries.clear()]);
  await importAll(json);
  expect(await db.foods.count()).toBe(1);
  expect((await entriesOn('2026-10-23'))[0].kcal).toBe(107);
});
