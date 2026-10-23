# Artifex Fit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Офлайн-PWA, которая ведёт пользователя по программе «4 недели + разгрузка»: считает веса, записывает подходы, показывает прогресс.

**Architecture:** Чистые функции программы в `src/program/` (данные программы, расписание, расчёт весов, циклы) покрыты Vitest. Журнал — Dexie (IndexedDB) в `src/db/`. React-экраны в `src/ui/` читают журнал через `dexie-react-hooks` и вызывают функции программы.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Dexie 4 + dexie-react-hooks, vite-plugin-pwa, Vitest + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-23-artifex-fit-mvp-design.md`

## Global Constraints

- Все веса в lb; шаг: гантели 2,5 lb, остальное 5 lb.
- Интерфейс только на русском.
- Тёмная тема, акцент `#FFD60A`, фон `#0B0D10`, карточки `#15181D`.
- Работает офлайн; `base: '/artifex-fit/'` для GitHub Pages.
- Первый запуск: позиция `{ cycle: 1, day: 12 }`.
- Отдых: 120 с после рабочего подхода, 60 с после разминочного.
- Никаких сетевых запросов во время работы приложения (картинки локальные).

## Review Focus

1. Пользователь стартует с дня 12 без записей недели 1 → поля «вес Н1» пустые, ввод на неделе 2 становится Н1 для недели 3 (тест в Task 4).
2. Перезагрузка страницы посреди тренировки → подходы сохранены, тренировка продолжается (тест в Task 6: `getOpenWorkout`).
3. Таймер при блокировке экрана → после возврата показывает верный остаток (функция `remainingSec(startedAt, durationSec, now)` тестируется в Task 7).
4. Импорт битого JSON → ошибка, данные не тронуты (тест в Task 6).
5. Правка уже записанного подхода (повторная галочка) → обновляет запись, не дублирует (тест в Task 6).

---

### Task 1: Каркас проекта, тема, картинки

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/TabBar.tsx`, `src/styles/global.css`, `public/exercises/*.webp|jpg`, `scripts/fetch-images.mjs`, `src/smoke.test.ts`

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`; добавить `dexie dexie-react-hooks`, dev: `vitest fake-indexeddb vite-plugin-pwa @vitest/coverage-v8 jsdom`.
- [ ] **Step 2:** `vite.config.ts`: `base: '/artifex-fit/'`, VitePWA (`registerType: 'autoUpdate'`, манифест: name «Artifex Fit», short_name «Artifex», `display: 'standalone'`, `theme_color`/`background_color` `#0B0D10`, иконки 192/512 PNG), workbox `globPatterns: ['**/*.{js,css,html,webp,jpg,png,svg}']`; `test: { environment: 'node' }`.
- [ ] **Step 3:** Скопировать 18 пользовательских картинок в `public/exercises/<exerciseId>.webp` (соответствие — в Task 2, таблица `USER_IMAGES`). `scripts/fetch-images.mjs` скачивает `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<dbId>/{0,1}.jpg` → `public/exercises/<exerciseId>-0.jpg`, `-1.jpg` для 16 упражнений.
- [ ] **Step 4:** `App.tsx` — 4 вкладки (Тренировка · Прогресс · Питание · Профиль), состояние вкладки в `useState`; `global.css` — токены темы, safe-area отступы, шрифт system-ui.
- [ ] **Step 5:** Smoke-тест `expect(1+1).toBe(2)`; `npx vitest run` → PASS; `npm run build` → успех.
- [ ] **Step 6:** Commit `chore: scaffold Vite React PWA with theme and exercise images`.

### Task 2: Справочник упражнений и данные программы

**Files:**
- Create: `src/program/types.ts`, `src/program/exercises.ts`, `src/program/program.ts`
- Test: `src/program/program.test.ts`

**Interfaces — Produces:**
```ts
export type DayType = 'A' | 'B' | 'C';
export type Week = 1 | 2 | 3 | 4 | 5;
export type WeightRule =
  | { kind: 'fixed'; lb: number }
  | { kind: 'added'; lb: number }
  | { kind: 'plates'; perSide: number }            // сумма блинов на сторону, 2×45+10 → 100
  | { kind: 'pick' }
  | { kind: 'anchor'; week: 1 | 3; deltaLb: number }
  | { kind: 'pct'; week: 4; min: number; max: number }
  | { kind: 'inclineW4' };                           // условие недели 4 жима на наклонной
export interface Prescription { sets: number; repsMin: number; repsMax: number; weight: WeightRule; dropset?: boolean }
export interface Exercise { id: string; name: string; muscles: string; equipment: 'dumbbell' | 'other'; image: { src: string; frames: 2 | 3 } | { src0: string; src1: string; frames: 2 } }
export interface ProgramExercise { exerciseId: string; warmup: string[]; weeks: [Prescription, Prescription, Prescription, Prescription, Prescription] }
export interface DayTemplate { type: DayType; title: string; exercises: ProgramExercise[] }
export const EXERCISES: Record<string, Exercise>;
export const DAYS: Record<DayType, DayTemplate>;
export function stepFor(exerciseId: string): 2.5 | 5;
```
id упражнений — латиница kebab-case, напр. `incline-db-press`, `neutral-pullup`, `low-high-cable-fly`, `chest-supported-row`, `standing-calf`, `cable-lateral`, `reverse-pec-deck`, `overhead-rope-ext`, `ez-curl`, `single-arm-cable-ext`, `preacher-curl`, `machine-shoulder-press`, `machine-chest-press`, `leg-press`, `lying-leg-curl`, `seated-calf`, `supported-db-lateral`, `pec-deck`, `rear-delt-db-fly`, `incline-db-curl`, `ez-skullcrusher`, `low-cable-curl`, `rope-pushdown`, `db-bench-press`, `lat-pulldown`, `mid-cable-fly`, `seated-cable-row`, `leg-press-calf`, `machine-lateral`, `face-pull`, `straight-bar-pushdown`, `hammer-curl`, `db-overhead-ext`, `bayesian-curl`.

- [ ] **Step 1: Тесты данных**
```ts
const work = (t: DayType, w: Week) => DAYS[t].exercises.reduce((s, e) => s + e.weeks[w-1].sets, 0);
test('рабочие подходы недель 1–4', () => { for (const w of [1,2,3,4] as Week[]) { expect(work('A',w)).toBe(36); expect(work('B',w)).toBe(38); expect(work('C',w)).toBe(35); } });
test('разгрузка', () => { expect(work('A',5)).toBe(22); expect(work('B',5)).toBe(23); expect(work('C',5)).toBe(21); });
test('все упражнения есть в справочнике', ...);
test('дропсеты только на махах недель 3–4', () => /* cable-lateral, supported-db-lateral, machine-lateral в нед. 3,4 */);
test('примеры', () => {
  expect(DAYS.A.exercises[0].weeks[3].weight).toEqual({ kind: 'inclineW4' });
  expect(DAYS.B.exercises[2].weeks[1]).toMatchObject({ sets: 3, repsMin: 10, repsMax: 10, weight: { kind: 'plates', perSide: 110 } });
  expect(DAYS.C.exercises[8].weeks[2]).toMatchObject({ repsMin: 8, repsMax: 10, weight: { kind: 'fixed', lb: 40 } });
  expect(DAYS.A.exercises[1].weeks[4].weight).toEqual({ kind: 'added', lb: 0 });
  expect(stepFor('supported-db-lateral')).toBe(2.5); expect(stepFor('lat-pulldown')).toBe(5);
});
```
- [ ] **Step 2:** `npx vitest run src/program` → FAIL (модуль не найден).
- [ ] **Step 3:** Перенести программу из `docs/program-source.txt` в `program.ts` дословно: «подбери вес» → `pick`; «вес Н1 +5 lb» → `anchor{1,5}`; «вес Н3» → `anchor{3,0}`; «70–75% от Н4» → `pct{4,0.70,0.75}`; «2×45 +20 lb/стор.» → `plates{110}`; «+10 lb» → `added{10}`; «без веса» → `added{0}`; «8–10» → repsMin 8, repsMax 10; «+ дроп» → `dropset: true`. Разминки — строками из колонки «Разминка». Гантельные упражнения (`equipment: 'dumbbell'`): incline-db-press, supported-db-lateral, rear-delt-db-fly, incline-db-curl, db-bench-press, hammer-curl, db-overhead-ext.
- [ ] **Step 4:** `npx vitest run src/program` → PASS.
- [ ] **Step 5:** Commit `feat: program data and exercise catalog`.

### Task 3: Расписание

**Files:** Create `src/program/schedule.ts`; Test `src/program/schedule.test.ts`

**Interfaces — Produces:**
```ts
export const TRAINING_DAYS: readonly number[];   // [1,3,5,8,10,12,15,17,19,22,24,26,29,31,33]
export function dayInfo(day: number): { week: Week; type: DayType; rir: string };  // rir: '3','2','1','0–1','4–5'
export function nextTrainingDay(pos: { cycle: number; day: number }): { cycle: number; day: number }; // после 33 → { cycle+1, day: 1 }
```
- [ ] **Step 1: Тесты:** `dayInfo(12)` → `{week:2,type:'C',rir:'2'}`; `dayInfo(1).type==='A'`; `dayInfo(31)` → `{week:5,type:'B'}`; `nextTrainingDay({cycle:1,day:12})` → `{1,15}`; `nextTrainingDay({cycle:1,day:33})` → `{2,1}`; `dayInfo(2)` бросает ошибку.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5:** Commit `feat: program schedule`.

### Task 4: Расчёт целевого веса

**Files:** Create `src/program/weights.ts`; Test `src/program/weights.test.ts`

**Interfaces:**
- Consumes: `DAYS`, `EXERCISES`, `stepFor`, `dayInfo`.
- Produces:
```ts
export interface LoggedSet { cycle: number; day: number; exerciseId: string; kind: 'warmup' | 'work'; index: number; lb: number; reps: number; dropReps?: number }
export interface CycleConfig { offsets: Record<string, number>; startWeights: Record<string, number> }
export interface Target { lb: number | null; repsMin: number; repsMax: number; source: 'program' | 'anchor' | 'heldBack' | 'unknown'; hint?: string }
export function roundTo(lb: number, step: number): number;               // к ближайшему кратному шагу
export function anchorWeight(exerciseId: string, week: Week, cycle: number, log: LoggedSet[], cfg: CycleConfig): number | null;
export function targetFor(exerciseId: string, week: Week, cycle: number, log: LoggedSet[], cfg: CycleConfig): Target;
export function formatWeight(rule: WeightRule, lb: number | null): string; // '65 lb', '+10 lb', 'без веса', '2×45 +20 / стор.', '—'
```
Правила из спеки §5. Неделя упражнения в журнале = `dayInfo(set.day).week`; учитываются только `kind==='work'` и `set.cycle === cycle`.
Мода: самый частый `lb`, при равенстве — больший.
Недобор: на неделе `week-1` (только для week 2–4) есть рабочий подход с `reps <= repsMin_prev - 2`, где `repsMin_prev` — из предписания прошлой недели; и программный вес > моды прошлой недели → `{ lb: мода прошлой недели, source: 'heldBack', hint: 'Вес не повышен: на прошлой неделе недобор повторений' }`.
`inclineW4`: на неделе 3 ровно 4+ рабочих подходов с `lb >= 70 && reps >= 10` → `{lb:75, repsMin:8, repsMax:8}`, иначе `{lb:70, repsMin:10, repsMax:12, hint:'75 lb — только после 70×10 во всех подходах на неделе 3'}`.
`pick`: последний записанный рабочий вес упражнения в цикле → иначе `startWeights` → иначе `{lb:null, source:'unknown', hint:'Подбери вес: 3 повторения в запасе'}`.
`anchor` без якоря: `{lb:null, source:'unknown', hint:'Введи свой вес Н1'}` (для week 3 якоря — 'Н3').
`pct`: `roundTo(H4 * 0.725, step)`.
`offsets[exerciseId]` прибавляется к `fixed`/`added`/`plates`.

- [ ] **Step 1: Тесты** (минимум):
  - `roundTo(17.4, 2.5) === 17.5`, `roundTo(72.5*0.725, 5) === 55`.
  - fixed: `targetFor('db-bench-press', 2, 1, [], empty).lb === 70`.
  - anchor Н1 из недели 2 (Review Focus 1): лог день 12 `mid-cable-fly` 3 подхода по 30 lb × 15 → `targetFor('mid-cable-fly', 3, 1, log, empty).lb === 35`.
  - Н1 из startWeights: `startWeights: {'ez-curl': 50}` → week 3 → 55.
  - нет якоря → `lb null`, `source 'unknown'`, hint содержит 'Н1'.
  - мода с равенством: веса [30,30,35,35] → 35.
  - недобор: неделя 2 `incline-db-press` 65 lb × [12,12,9,8] (план 12) → неделя 3 → `{lb:65, source:'heldBack'}`; при [12,12,11,10] → 70.
  - inclineW4: неделя 3 70×[10,10,10,10] → 75; 70×[10,10,10,9] → 70, repsMin 10, repsMax 12.
  - pct: неделя 4 `ez-curl` 55 lb → неделя 5 → 40.
  - offsets: `{offsets: {'db-bench-press': 5}}` неделя 1 → 70.
  - другой цикл не влияет: запись цикла 1 не даёт якорь циклу 2.
  - `formatWeight({kind:'plates',perSide:110},110) === '2×45 +20 / стор.'`; `formatWeight({kind:'added',lb:0},0) === 'без веса'`.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5:** Commit `feat: target weight engine`.

### Task 5: Переход цикла

**Files:** Create `src/program/cycle.ts`; Test `src/program/cycle.test.ts`

**Interfaces — Produces:**
```ts
export type CycleMode = 'program' | 'best';
export function nextCycleConfig(prev: CycleConfig, cycle: number, log: LoggedSet[], mode: CycleMode): CycleConfig;
```
Правила — спека §6. «Вес недели k по программе» для `fixed`/`added`/`plates` — из `DAYS`; для `inclineW4` считать 75.
- [ ] **Step 1: Тесты:** `program`: `db-bench-press` offset 5 (70−65), `incline-db-press` offset 0, `leg-press` offset 10, `neutral-pullup` offset 5; `ez-curl` startWeight = Н3 из лога. `best`: `machine-shoulder-press` факт неделя 4 = 110 при плане 100 → offset 0+10 = 10; `ez-curl` startWeight = Н4. Смещения прошлого цикла накапливаются.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5:** Commit `feat: cycle transition`.

### Task 6: Хранилище

**Files:** Create `src/db/db.ts`, `src/db/repo.ts`; Test `src/db/repo.test.ts` (`import 'fake-indexeddb/auto'`)

**Interfaces — Produces:**
```ts
export interface WorkoutRow { id?: number; cycle: number; day: number; startedAt: number; finishedAt?: number }
export interface SetRow extends LoggedSet { id?: number; workoutId: number; doneAt: number }
export interface Position { cycle: number; day: number }
// repo.ts
export async function getPosition(): Promise<Position>;                // по умолчанию {1,12}
export async function setPosition(p: Position): Promise<void>;
export async function getCycleConfig(cycle: number): Promise<CycleConfig>;
export async function saveCycleConfig(cycle: number, c: CycleConfig): Promise<void>;
export async function startWorkout(p: Position): Promise<number>;
export async function getOpenWorkout(): Promise<WorkoutRow | undefined>;
export async function saveSet(s: Omit<SetRow, 'id' | 'doneAt'>): Promise<void>; // upsert по [workoutId+exerciseId+kind+index]
export async function deleteSet(workoutId: number, exerciseId: string, kind: 'warmup'|'work', index: number): Promise<void>;
export async function finishWorkout(id: number): Promise<Position>;    // ставит finishedAt, двигает позицию nextTrainingDay
export async function allSets(): Promise<SetRow[]>;
export async function exportAll(): Promise<string>;                     // JSON {version:1, exportedAt, workouts, sets, settings}
export async function importAll(json: string): Promise<void>;           // валидирует; при ошибке бросает и не трогает БД
```
Dexie схема: `workouts: '++id, cycle, day, finishedAt'`, `sets: '++id, workoutId, &[workoutId+exerciseId+kind+index], exerciseId'`, `settings: 'key'`.
- [ ] **Step 1: Тесты:** позиция по умолчанию `{1,12}`; `saveSet` дважды с тем же ключом → 1 запись с новыми reps (Review Focus 5); `getOpenWorkout` возвращает незавершённую (Review Focus 2); `finishWorkout` на дне 12 → позиция `{1,15}`; `exportAll`→`importAll` восстанавливает те же данные; `importAll('{bad')` бросает и данные на месте (Review Focus 4); `importAll` без `version:1` бросает.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5:** Commit `feat: IndexedDB repository with export/import`.

### Task 7: Экран «Тренировка»

**Files:** Create `src/ui/workout/WorkoutScreen.tsx`, `ExerciseCard.tsx`, `SetRow.tsx`, `RestTimer.tsx`, `ExerciseImage.tsx`, `useNow.ts`, `src/ui/workout/timer.ts`; Test `src/ui/workout/timer.test.ts`

**Interfaces:**
- Consumes: `dayInfo`, `DAYS`, `EXERCISES`, `targetFor`, `formatWeight`, repo-функции Task 6.
- Produces: `export function remainingSec(startedAt: number, durationSec: number, now: number): number` (не меньше 0, округление вверх); `export function formatClock(sec: number): string` (`'1:05:03'` / `'02:00'`).

- [ ] **Step 1: Тесты timer:** `remainingSec(0,120,30_500) === 90`; `remainingSec(0,120,500_000) === 0`; `formatClock(120) === '02:00'`; `formatClock(3903) === '1:05:03'`.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5: UI.** Шапка: «Тренировка», «День 12 · С: …», чип «Неделя 2 · запас 2». Без открытой тренировки — карточка-превью дня и кнопка «Начать тренировку». С открытой — секундомер от `startedAt` (`useNow(1000)`), список `ExerciseCard` (первое невыполненное раскрыто), кнопка «Завершить тренировку» → итог (время, рабочих подходов, тоннаж) → «Готово».
  `ExerciseCard`: номер, название, мышцы, подсказка `target.hint` жёлтым, `ExerciseImage` (3 кадра: `background-size: 300% 100%`, позиции 0/50/100%; 2 кадра — два `<img>`; подписи «Старт / Подъём / Опускание» только для 3 кадров), чипы разминки (тап → отмечено + таймер 60 с), строки `SetRow` по `target.sets` + «план: 3 × 10 · 65 lb».
  `SetRow`: номер; вес — input `inputmode="decimal"` со стрелками ±`stepFor`; повторы — ±1; кнопка ✓ → `saveSet` + старт таймера 120 с; выполненный подход — зелёная галочка, повторный тап на ✓ после правки → перезапись. Значение по умолчанию — спека §5 п.8. Для `added` метка «доп. вес», для `plates` — «на сторону». Последний подход с `dropset` — поле «дроп, повт.».
  `RestTimer`: плавающая панель над TabBar с кругом-прогрессом, «+30 с», «Стоп»; состояние таймера (`startedAt`, `duration`) в `localStorage` (`try/catch`), чтобы пережить перезагрузку; по нулю — короткий бип WebAudio, если `document.visibilityState === 'visible'`.
- [ ] **Step 6:** `npm run build` → успех. Commit `feat: workout screen with rest timer`.

### Task 8: Экран «Прогресс»

**Files:** Create `src/program/stats.ts`, `src/ui/progress/ProgressScreen.tsx`, `src/ui/progress/LineChart.tsx`; Test `src/program/stats.test.ts`

**Interfaces — Produces:**
```ts
export type Period = 'week' | 'month' | 'year';
export function periodStart(period: Period, now: number): number;      // неделя с понедельника 00:00 локально; месяц — 1-е число; год — 1 января
export function summary(workouts: WorkoutRow[], sets: SetRow[], from: number): { count: number; minutes: number; tonnage: number };
export function weightSeries(exerciseId: string, workouts: WorkoutRow[], sets: SetRow[]): { date: number; lb: number }[];
```
Тоннаж: Σ lb × reps рабочих подходов; правило `added` → 0; `plates` → lb × 2. Только завершённые тренировки с `finishedAt >= from`. `weightSeries` — мода рабочего веса за тренировку, по дате `startedAt`.
- [ ] **Step 1: Тесты:** summary считает только рабочие подходы и только в периоде; leg-press 110 × 10 → 2200; pullups added → 0; `weightSeries` по двум тренировкам → 2 точки по возрастанию даты; `periodStart('week', <чт 2026-10-22 15:00>)` → пн 2026-10-19 00:00.
- [ ] **Step 2–4:** FAIL → реализация → PASS.
- [ ] **Step 5: UI** — переключатель Неделя/Месяц/Год, 3 плитки, `<select>` упражнения (только с записями), `LineChart` — SVG 100%×180, линия + точки акцентом, подписи min/max и дат. Пусто → «Пока нет записей».
- [ ] **Step 6:** Build → commit `feat: progress screen`.

### Task 9: Профиль, конец цикла, «Питание»

**Files:** Create `src/ui/profile/ProfileScreen.tsx`, `StartWeights.tsx`, `Backup.tsx`, `CycleDialog.tsx`, `src/ui/nutrition/NutritionScreen.tsx`

- [ ] **Step 1:** «Где я в программе»: `<select>` цикла (1..max+1) и тренировочного дня (`TRAINING_DAYS` с подписью «Нед. 2 · С») → `setPosition`.
- [ ] **Step 2:** «Стартовые веса»: все упражнения, у которых в неделе 1 правило `pick`, с полем lb → `saveCycleConfig(position.cycle, {…startWeights})`.
- [ ] **Step 3:** «Резервная копия»: «Экспорт» → `Blob` + `<a download="artifex-fit-YYYY-MM-DD.json">`; «Импорт» → `<input type=file accept=application/json>` → `confirm('Заменить все данные?')` → `importAll`; ошибки — текстом.
- [ ] **Step 4:** `CycleDialog`: показывается на экране «Тренировка», когда `finishWorkout` вернул позицию с `day === 1` и `cycle > 1` без сохранённого конфига нового цикла; две кнопки (а)/(б) с пояснениями → `nextCycleConfig` → `saveCycleConfig`. Кнопка «Начать новый цикл» в профиле открывает тот же диалог.
- [ ] **Step 5:** `NutritionScreen` — «Питание появится в следующей версии».
- [ ] **Step 6:** При старте `navigator.storage?.persist?.()`. Build → commit `feat: profile, cycle dialog, nutrition placeholder`.

### Task 10: Иконки, деплой, проверка

**Files:** Create `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (генерируются скриптом `scripts/make-icons.mjs` из SVG через `sharp`, dev-зависимость), `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1:** Иконки: жёлтая гантель на тёмном фоне. `index.html`: `apple-mobile-web-app-capable`, `apple-touch-icon`, `theme-color`, `viewport-fit=cover`.
- [ ] **Step 2:** `deploy.yml`: на push в `main` → `npm ci && npx vitest run && npm run build` → `actions/upload-pages-artifact@v3` (`dist`) → `actions/deploy-pages@v4`.
- [ ] **Step 3:** `npm run dev` → встроенный браузер, мобильный вид 375×812: начать тренировку дня 12, записать 2 подхода, перезагрузить — подходы на месте, таймер идёт; «Прогресс» после завершения показывает 1 тренировку; экспорт скачивает файл.
- [ ] **Step 4:** `gh repo create artifex141/artifex-fit --public --source . --push`; включить Pages через `gh api -X POST repos/artifex141/artifex-fit/pages -f build_type=workflow`; дождаться зелёного workflow; открыть `https://artifex141.github.io/artifex-fit/`.
- [ ] **Step 5:** README: что это, как установить на iPhone (Safari → Поделиться → На экран «Домой»), как вести резервную копию. Commit `chore: icons, deploy workflow, README`.
