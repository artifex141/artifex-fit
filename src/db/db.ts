import Dexie, { type Table } from 'dexie';
import type { Macros, Meal, Per100 } from '../nutrition/calc';
import type { LoggedSet } from '../program/weights';

export interface WorkoutRow {
  id?: number;
  cycle: number;
  day: number;
  startedAt: number;
  finishedAt?: number;
}

export interface SetRow extends LoggedSet {
  id?: number;
  workoutId: number;
  doneAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface FoodRow {
  id?: number;
  source: 'ai' | 'off' | 'manual';
  name: string;
  brand?: string;
  barcode?: string;
  per100: Per100;
  image?: string;
  lastUsedAt: number;
}

/** Запись питания: КБЖУ — снимок на момент сохранения; per100 — для пересчёта при правке граммов. */
export interface EntryRow extends Macros {
  id?: number;
  date: string;
  meal: Meal;
  name: string;
  grams: number;
  per100: Per100;
  foodId?: number;
  photoId?: number;
  createdAt: number;
}

export interface PhotoRow {
  id?: number;
  blob: Blob;
  createdAt: number;
}

class ArtifexDB extends Dexie {
  workouts!: Table<WorkoutRow, number>;
  sets!: Table<SetRow, number>;
  settings!: Table<SettingRow, string>;
  foods!: Table<FoodRow, number>;
  entries!: Table<EntryRow, number>;
  photos!: Table<PhotoRow, number>;

  constructor() {
    super('artifex-fit');
    this.version(1).stores({
      workouts: '++id, cycle, day, startedAt',
      sets: '++id, workoutId, &[workoutId+exerciseId+kind+index], exerciseId',
      settings: 'key',
    });
    // v2: питание. Таблицы v1 не меняются — журнал тренировок переносится как есть.
    this.version(2).stores({
      foods: '++id, &barcode, lastUsedAt, name',
      entries: '++id, date, meal',
      photos: '++id',
    });
  }
}

export const db = new ArtifexDB();
