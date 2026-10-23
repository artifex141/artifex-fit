import Dexie, { type Table } from 'dexie';
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

class ArtifexDB extends Dexie {
  workouts!: Table<WorkoutRow, number>;
  sets!: Table<SetRow, number>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('artifex-fit');
    this.version(1).stores({
      workouts: '++id, cycle, day, startedAt',
      sets: '++id, workoutId, &[workoutId+exerciseId+kind+index], exerciseId',
      settings: 'key',
    });
  }
}

export const db = new ArtifexDB();
