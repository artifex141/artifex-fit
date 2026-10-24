// Хранилище питания: продукты, записи по дням, миниатюры фото, дневная норма.
import { scale, type Meal, type Per100, type Targets } from '../nutrition/calc';
import { db, type EntryRow, type FoodRow } from './db';

export type { EntryRow, FoodRow } from './db';

/** Продукт по штрихкоду (или по источнику + названию) обновляется, а не дублируется. */
export async function upsertFood(f: Omit<FoodRow, 'id' | 'lastUsedAt'>): Promise<number> {
  return db.transaction('rw', db.foods, async () => {
    const existing = f.barcode
      ? await db.foods.where('barcode').equals(f.barcode).first()
      : await db.foods.where('name').equals(f.name).filter((x) => x.source === f.source && !x.barcode).first();
    const row: FoodRow = { ...f, lastUsedAt: Date.now() };
    if (existing?.id !== undefined) {
      await db.foods.put({ ...row, id: existing.id });
      return existing.id;
    }
    return db.foods.add(row);
  });
}

export async function addEntries(date: string, meal: Meal, items: { name: string; grams: number; per100: Per100; foodId?: number }[], photo?: Blob): Promise<void> {
  await db.transaction('rw', db.entries, db.photos, async () => {
    const photoId = photo ? await db.photos.add({ blob: photo, createdAt: Date.now() }) : undefined;
    const now = Date.now();
    await db.entries.bulkAdd(
      items.map((it, i) => ({ date, meal, name: it.name, grams: it.grams, per100: it.per100, foodId: it.foodId, photoId, createdAt: now + i, ...scale(it.per100, it.grams) })),
    );
  });
}

export async function entriesOn(date: string): Promise<EntryRow[]> {
  return (await db.entries.where('date').equals(date).toArray()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function setEntryGrams(id: number, grams: number): Promise<void> {
  const e = await db.entries.get(id);
  if (e) await db.entries.put({ ...e, grams, ...scale(e.per100, grams) });
}

export async function deleteEntry(id: number): Promise<void> {
  await db.entries.delete(id);
}

export async function recentFoods(limit = 20): Promise<FoodRow[]> {
  return db.foods.orderBy('lastUsedAt').reverse().limit(limit).toArray();
}

export async function daysWithEntries(): Promise<{ date: string; kcal: number }[]> {
  const byDay = new Map<string, number>();
  await db.entries.each((e) => byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.kcal));
  return [...byDay].map(([date, kcal]) => ({ date, kcal: Math.round(kcal) })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTargets(): Promise<Targets | null> {
  return ((await db.settings.get('nutritionTargets'))?.value as Targets | undefined) ?? null;
}

export async function saveTargets(t: Targets): Promise<void> {
  await db.settings.put({ key: 'nutritionTargets', value: t });
}

/** Вернуться к расчётной норме. */
export async function clearTargets(): Promise<void> {
  await db.settings.delete('nutritionTargets');
}

/** Свой продукт с этим штрихкодом (введённый вручную или найденный раньше). */
export async function foodByBarcode(code: string): Promise<FoodRow | undefined> {
  return db.foods.where('barcode').equals(code).first();
}
