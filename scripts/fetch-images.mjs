// Downloads 2-frame exercise photos from free-exercise-db (Unlicense) into public/exercises.
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const MAP = {
  'leg-press': 'Leg_Press',
  'lying-leg-curl': 'Lying_Leg_Curls',
  'seated-calf': 'Seated_Calf_Raise',
  'low-cable-curl': 'Standing_Biceps_Cable_Curl',
  'rope-pushdown': 'Triceps_Pushdown_-_Rope_Attachment',
  'db-bench-press': 'Dumbbell_Bench_Press',
  'lat-pulldown': 'Wide-Grip_Lat_Pulldown',
  'mid-cable-fly': 'Cable_Crossover',
  'seated-cable-row': 'Seated_Cable_Rows',
  'leg-press-calf': 'Calf_Press_On_The_Leg_Press_Machine',
  'machine-lateral': 'Side_Lateral_Raise',
  'face-pull': 'Face_Pull',
  'straight-bar-pushdown': 'Triceps_Pushdown',
  'hammer-curl': 'Hammer_Curls',
  'db-overhead-ext': 'Standing_One-Arm_Dumbbell_Triceps_Extension',
  'bayesian-curl': 'Standing_One-Arm_Cable_Curl',
};

await mkdir('public/exercises', { recursive: true });
for (const [id, dbId] of Object.entries(MAP)) {
  for (const n of [0, 1]) {
    const res = await fetch(`${BASE}/${dbId}/${n}.jpg`);
    if (!res.ok) throw new Error(`${dbId}/${n}.jpg: HTTP ${res.status}`);
    await writeFile(`public/exercises/${id}-${n}.jpg`, Buffer.from(await res.arrayBuffer()));
  }
  console.log('ok', id);
}
