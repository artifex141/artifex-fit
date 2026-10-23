export type DayType = 'A' | 'B' | 'C';
export type Week = 1 | 2 | 3 | 4 | 5;

export type WeightRule =
  | { kind: 'fixed'; lb: number }
  | { kind: 'added'; lb: number } // добавочный вес к своему (подтягивания); 0 = без веса
  | { kind: 'plates'; perSide: number } // сумма блинов на одну сторону: 2×45 +20 → 110
  | { kind: 'pick' } // «подбери вес»
  | { kind: 'anchor'; week: 1 | 3; deltaLb: number } // «вес Н1 +5 lb», «вес Н3»
  | { kind: 'pct'; week: 4; min: number; max: number } // «70–75% от Н4»
  | { kind: 'inclineW4' }; // жим на наклонной, неделя 4: 75 lb при 70×10 во всех подходах недели 3

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  weight: WeightRule;
  dropset?: boolean;
}

export type ExerciseImage =
  | { frames: 3; src: string }
  | { frames: 2; src0: string; src1: string };

export interface Exercise {
  id: string;
  name: string;
  muscles: string;
  note?: string; // уточнение к технике, например угол скамьи
  equipment: 'dumbbell' | 'other';
  image: ExerciseImage;
}

export interface ProgramExercise {
  exerciseId: string;
  warmup: string[]; // недели 1–4
  warmupDeload?: string[]; // неделя 5
  weeks: [Prescription, Prescription, Prescription, Prescription, Prescription];
}

export interface DayTemplate {
  type: DayType;
  title: string;
  exercises: ProgramExercise[];
}
