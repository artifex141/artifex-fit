import type { Exercise, ExerciseImage } from './types';

// 3 кадра — картинки пользователя; 2 кадра — фото из free-exercise-db (Unlicense).
const img3 = (id: string): ExerciseImage => ({ frames: 3, src: `exercises/${id}.webp` });
const img2 = (id: string): ExerciseImage => ({ frames: 2, src0: `exercises/${id}-0.jpg`, src1: `exercises/${id}-1.jpg` });

const list: Exercise[] = [
  // День A
  { id: 'incline-db-press', name: 'Жим гантелей на наклонной', muscles: 'Грудные мышцы · Трицепс · Передние дельты', note: 'Скамья 20–30°', equipment: 'dumbbell', image: img3('incline-db-press') },
  { id: 'neutral-pullup', name: 'Подтягивания параллельным хватом', muscles: 'Широчайшие · Бицепс', equipment: 'other', image: img3('neutral-pullup') },
  { id: 'low-high-cable-fly', name: 'Сведения в кроссовере снизу вверх', muscles: 'Верх груди', equipment: 'other', image: img3('low-high-cable-fly') },
  { id: 'chest-supported-row', name: 'Тяга с упором грудью', muscles: 'Спина · Задние дельты', equipment: 'other', image: img3('chest-supported-row') },
  { id: 'standing-calf', name: 'Подъёмы на носки стоя', muscles: 'Икры', equipment: 'other', image: img3('standing-calf') },
  { id: 'cable-lateral', name: 'Махи в кроссовере (средняя дельта)', muscles: 'Средние дельты', equipment: 'other', image: img3('cable-lateral') },
  { id: 'reverse-pec-deck', name: 'Обратная бабочка', muscles: 'Задние дельты', equipment: 'other', image: img3('reverse-pec-deck') },
  { id: 'overhead-rope-ext', name: 'Разгибания с канатом из-за головы', muscles: 'Трицепс (длинная головка)', equipment: 'other', image: img3('overhead-rope-ext') },
  { id: 'ez-curl', name: 'Подъём EZ-штанги на бицепс', muscles: 'Бицепс', equipment: 'other', image: img3('ez-curl') },
  { id: 'single-arm-cable-ext', name: 'Разгибание одной рукой в кроссовере', muscles: 'Трицепс', equipment: 'other', image: img3('single-arm-cable-ext') },
  { id: 'preacher-curl', name: 'Сгибания на скамье Скотта', muscles: 'Бицепс', equipment: 'other', image: img3('preacher-curl') },
  // День B
  { id: 'machine-shoulder-press', name: 'Жим на плечи в тренажёре', muscles: 'Передние и средние дельты · Трицепс', equipment: 'other', image: img3('machine-shoulder-press') },
  { id: 'machine-chest-press', name: 'Жим в тренажёре на грудь', muscles: 'Грудь · Трицепс', equipment: 'other', image: img3('machine-chest-press') },
  { id: 'leg-press', name: 'Жим ногами', muscles: 'Квадрицепсы · Ягодицы', equipment: 'other', image: img3('leg-press') },
  { id: 'lying-leg-curl', name: 'Сгибания ног лёжа', muscles: 'Бицепс бедра', equipment: 'other', image: img2('lying-leg-curl') },
  { id: 'seated-calf', name: 'Подъёмы на носки сидя', muscles: 'Икры (камбаловидная)', equipment: 'other', image: img2('seated-calf') },
  { id: 'supported-db-lateral', name: 'Махи гантелей с упором', muscles: 'Средние дельты', equipment: 'dumbbell', image: img3('supported-db-lateral') },
  { id: 'pec-deck', name: 'Бабочка (сведения в тренажёре)', muscles: 'Грудь', equipment: 'other', image: img3('pec-deck') },
  { id: 'rear-delt-db-fly', name: 'Разведения гантелей в наклоне', muscles: 'Задние дельты', equipment: 'dumbbell', image: img3('rear-delt-db-fly') },
  { id: 'incline-db-curl', name: 'Подъём гантелей сидя на наклонной', muscles: 'Бицепс (длинная головка)', equipment: 'dumbbell', image: img3('incline-db-curl') },
  { id: 'ez-skullcrusher', name: 'Французский жим EZ лёжа', muscles: 'Трицепс', equipment: 'other', image: img3('ez-skullcrusher') },
  { id: 'low-cable-curl', name: 'Сгибания на нижнем блоке', muscles: 'Бицепс', equipment: 'other', image: img2('low-cable-curl') },
  { id: 'rope-pushdown', name: 'Разгибания с канатом вниз', muscles: 'Трицепс', equipment: 'other', image: img3('rope-pushdown') },
  // День C
  { id: 'db-bench-press', name: 'Жим гантелей лёжа', muscles: 'Грудь · Трицепс', equipment: 'dumbbell', image: img3('db-bench-press') },
  { id: 'lat-pulldown', name: 'Вертикальная тяга блока', muscles: 'Широчайшие', equipment: 'other', image: img3('lat-pulldown') },
  { id: 'mid-cable-fly', name: 'Сведения в кроссовере (средний блок)', muscles: 'Грудь', equipment: 'other', image: img3('mid-cable-fly') },
  { id: 'seated-cable-row', name: 'Горизонтальная тяга сидя', muscles: 'Спина', equipment: 'other', image: img3('seated-cable-row') },
  { id: 'leg-press-calf', name: 'Подъёмы на носки в жиме ногами', muscles: 'Икры', equipment: 'other', image: img3('leg-press-calf') },
  { id: 'machine-lateral', name: 'Махи в тренажёре (средняя дельта)', muscles: 'Средние дельты', equipment: 'other', image: img3('machine-lateral') },
  { id: 'face-pull', name: 'Тяга каната к лицу', muscles: 'Задние дельты · Ротаторы', equipment: 'other', image: img3('face-pull') },
  { id: 'straight-bar-pushdown', name: 'Разгибания на трицепс с прямой рукоятью', muscles: 'Трицепс', equipment: 'other', image: img3('straight-bar-pushdown') },
  { id: 'hammer-curl', name: 'Молотки', muscles: 'Брахиалис · Бицепс', equipment: 'dumbbell', image: img3('hammer-curl') },
  { id: 'db-overhead-ext', name: 'Разгибание гантели из-за головы одной рукой', muscles: 'Трицепс', equipment: 'dumbbell', image: img3('db-overhead-ext') },
  { id: 'bayesian-curl', name: 'Подъём на бицепс в кроссовере (спиной к блоку)', muscles: 'Бицепс', equipment: 'other', image: img3('bayesian-curl') },
];

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(list.map((e) => [e.id, e]));

export function stepFor(exerciseId: string): 2.5 | 5 {
  return EXERCISES[exerciseId]?.equipment === 'dumbbell' ? 2.5 : 5;
}
