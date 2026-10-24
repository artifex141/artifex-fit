# «Питание» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Питание» 1:1 с макетом: ввод еды по фото (OpenAI через VPS), штрихкоду (Open Food Facts), поиском и вручную; дневная норма и итоги.

**Architecture:** Чистые расчёты в `src/nutrition/` (норма, пересчёт, итоги) с Vitest. Записи и продукты — Dexie v2 в `src/db/`. Распознавание фото, штрихкод и поиск — новые маршруты сервера `server/src/food.js`, подключённые в `app.js`; ключ и модель из `.env`. UI — `src/ui/nutrition/`.

**Tech Stack:** React 18, TypeScript, Dexie 4, Vitest; Node 22 (`fetch`), `node --test`; OpenAI Responses API; Open Food Facts API v2; `barcode-detector` (zxing-wasm).

**Spec:** `docs/superpowers/specs/2026-10-23-nutrition-design.md`

## Global Constraints
- Граммы, ккал, Б/Ж/У в граммах; округление: ккал до 1, граммы БЖУ до 0,1.
- Размеры экрана — сетка макета: 1rem = 1/94.1 ширины (`.design/nutrition.webp`); цвета и «стеклянные» элементы — из `src/styles/global.css`, `src/ui/kit.tsx`.
- Ключ OpenAI никогда не попадает в клиент и репозиторий; `OPENAI_API_KEY`, `OPENAI_MODEL` (по умолчанию `gpt-6.1-sol`) — в `/opt/artifex-fit-push/.env`.
- Запросы клиента к серверу — обычный `fetch` из PWA (не «Команды»); API базовый адрес — `import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi'`.
- Лимиты фото: ≤ 60 на устройство в сутки, ≤ 300 всего; таймаут OpenAI 30 с; тело ≤ 4 МБ только для `/api/food/photo`.
- Open Food Facts: User-Agent `ArtifexFit/1.0 (fit.artifex.mobi)`; кэш на диске сервера.

## Review Focus
1. Модель вернула мусор (ккал/100 г = 5000, отрицательные граммы, 0 позиций) → сервер чинит/отбрасывает, клиент показывает пустой список с «Добавить вручную» (тест в Task 3).
2. Правка граммов на экране проверки после распознавания → ккал/БЖУ пересчитываются из per100, без повторного запроса (тест `scale` в Task 1).
3. Миграция Dexie v1 → v2 на телефоне с существующим журналом тренировок → тренировки и подходы на месте (тест в Task 2).
4. Нет сети / сервер 5xx при фото → понятная ошибка, фото не теряется до закрытия экрана (Task 5, ручная проверка + обработка в `recognizePhoto`).
5. Повторное сканирование того же штрихкода → один продукт в `foods` (unique barcode), запись с новыми граммами (тест в Task 2).

---

### Task 1: Расчёты питания
**Files:** Create `src/nutrition/calc.ts`; Test `src/nutrition/calc.test.ts`

**Produces:**
```ts
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Per100 { kcal: number; p: number; f: number; c: number }
export interface Macros { kcal: number; p: number; f: number; c: number }
export interface Targets extends Macros { manual: boolean }
export const MEAL_LABEL: Record<Meal, string>; // Завтрак, Обед, Ужин, Перекусы
export function scale(per100: Per100, grams: number): Macros;           // ккал до 1, БЖУ до 0.1
export function sumMacros(list: Macros[]): Macros;
export function mealByTime(date: Date): Meal;                           // <11 завтрак, <16 обед, <21 ужин, иначе перекус
export function autoTargets(p: { weightLb: number; heightCm: number; age: number; goal: 'mass' | 'cut' | 'keep' }): Targets;
export function dayKey(date: Date): string;                              // 'YYYY-MM-DD' по локальному времени
```
- [ ] Тесты: `scale({kcal:350,p:12,f:1.5,c:72}, 150)` → `{kcal:525,p:18,f:2.3,c:108}`; `sumMacros` складывает с округлением; `mealByTime` для 08:00/12:00/18:00/22:00; `autoTargets({weightLb:160.7, heightCm:179, age:28, goal:'mass'})` → `{kcal:2920, p:161, f:81, c:387, manual:false}` (BMR = 10·72.89 + 6.25·179 − 5·28 + 5; ×1.55; +10 %; округление ккал до 10; Б = round(lb); Ж = round(0.25·kcal/9); У = round((kcal − 4Б − 9Ж)/4)); `cut` −20 %, `keep` 0 %; `dayKey(new Date(2026,9,23,23,30))` → `'2026-10-23'`.
- [ ] RED → реализация → GREEN; коммит `feat(nutrition): calculations`.

### Task 2: Хранилище питания (Dexie v2)
**Files:** Modify `src/db/db.ts`; Create `src/db/nutrition.ts`; Test `src/db/nutrition.test.ts`; Modify `src/db/repo.ts` (экспорт/импорт).

**Produces:**
```ts
export interface FoodRow { id?: number; source: 'ai' | 'off' | 'manual'; name: string; brand?: string; barcode?: string; per100: Per100; image?: string; lastUsedAt: number }
export interface EntryRow extends Macros { id?: number; date: string; meal: Meal; name: string; grams: number; per100: Per100; foodId?: number; photoId?: number; createdAt: number }
export interface PhotoRow { id?: number; blob: Blob; createdAt: number }
// nutrition.ts
export async function upsertFood(f: Omit<FoodRow, 'id' | 'lastUsedAt'>): Promise<number>;   // по barcode, иначе по source+name
export async function addEntries(date: string, meal: Meal, items: { name: string; grams: number; per100: Per100; foodId?: number }[], photo?: Blob): Promise<void>;
export async function entriesOn(date: string): Promise<EntryRow[]>;
export async function setEntryGrams(id: number, grams: number): Promise<void>;           // пересчёт из per100
export async function deleteEntry(id: number): Promise<void>;
export async function recentFoods(limit?: number): Promise<FoodRow[]>;                  // по lastUsedAt
export async function daysWithEntries(): Promise<{ date: string; kcal: number }[]>;     // по убыванию даты
export async function getTargets(): Promise<Targets | null>;
export async function saveTargets(t: Targets): Promise<void>;
```
Dexie `version(2)`: `foods: '++id, &barcode, lastUsedAt, name'`, `entries: '++id, date, meal'`, `photos: '++id'`; таблицы v1 без изменений. В `EntryRow` хранится `per100` — для пересчёта при правке граммов.
- [ ] Тесты: `addEntries` считает КБЖУ через `scale`; `setEntryGrams` пересчитывает; повторный `upsertFood` с тем же barcode → тот же id (Review Focus 5); `daysWithEntries` суммирует ккал по дням; миграция: БД v1 с тренировкой и подходом открывается схемой v2, данные на месте (Review Focus 3; создать v1 отдельным `Dexie` с тем же именем до импорта `db`); `exportAll`/`importAll` включают foods и entries.
- [ ] RED → реализация → GREEN; коммит `feat(nutrition): storage`.

### Task 3: Сервер — фото, штрихкод, поиск
**Files:** Create `server/src/food.js`; Modify `server/src/app.js`, `server/src/index.js`; Test `server/test/food.test.js`

**Produces:**
```js
export function normalizeMeal(raw) // → { items: [{ name, grams, per100:{kcal,p,f,c}, confidence }], dish } ; правила спеки §5
export function createFood({ fetch, apiKey, model, now, cacheFile, log }) // → { photo(body), barcode(code), search(q) } — каждый возвращает { status, body }
```
- `photo`: проверка `deviceId` (UUID), `image` (`data:image/(jpeg|png|webp);base64,…`, ≤ 4 МБ), `hint` ≤ 200; лимиты 60/устройство/сутки и 300/сутки (счётчики по `dayKey` UTC в памяти); нет `apiKey` → 503 «Ключ OpenAI не настроен»; запрос `POST https://api.openai.com/v1/responses` c `{ model, input: [{role:'system', content: INSTRUCTIONS}, {role:'user', content:[{type:'input_text', text: hint || 'Что на тарелке?'}, {type:'input_image', image_url: image, detail:'auto'}]}], text: { format: { type:'json_schema', name:'meal', strict:true, schema: MEAL_SCHEMA } } }`, `AbortSignal.timeout(30000)`; текст ответа — из `output[].content[]` с `type:'output_text'` (или `refusal` → 422); JSON → `normalizeMeal`. Журнал: deviceId[:8], модель, `usage.input_tokens/output_tokens`, мс, число позиций.
- `MEAL_SCHEMA`: `{ type:'object', additionalProperties:false, required:['dish','items'], properties:{ dish:{type:'string'}, items:{ type:'array', items:{ type:'object', additionalProperties:false, required:['name','grams','kcal100','p100','f100','c100','confidence'], properties:{ name:{type:'string'}, grams:{type:'number'}, kcal100:{type:'number'}, p100:{type:'number'}, f100:{type:'number'}, c100:{type:'number'}, confidence:{type:'number'} } } } } }`.
- `normalizeMeal`: 0–15 позиций (лишние отбрасываются); граммы → clamp 1–2000; ккал 0–900, БЖУ 0–100; если 4p+9f+4c > kcal·1.3 → kcal = round(4p+9f+4c); пустое имя → позиция удаляется.
- `barcode(code)`: только цифры 6–14; `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,brands,nutriments,image_front_small_url` с User-Agent; `nutriments['energy-kcal_100g']` (или `energy_100g`/4.184), `proteins_100g`, `fat_100g`, `carbohydrates_100g`; нет продукта → 404; кэш в `cacheFile` (JSON, ключ — код).
- `search(q)`: 2–60 символов; `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=…&json=1&page_size=20&fields=code,product_name,brands,nutriments,image_front_small_url`; без КБЖУ — отбрасываются; кэш 24 ч.
- `app.js`: маршруты `POST /api/food/photo` (лимит тела 4 МБ только тут), `GET /api/food/barcode/:code`, `GET /api/food/search?q=`; CORS как у остальных.
- [ ] Тесты с подменённым `fetch`: корректный ответ модели → нормализованные позиции и «ккал из БЖУ» при противоречии; мусор (`kcal100: 5000`, `grams: -3`, 20 позиций) → обрезано (Review Focus 1); refusal → 422; нет ключа → 503; 61-е фото за сутки → 429; неверный `image` → 400; штрихкод: разбор nutriments, 404, повтор берётся из кэша (fetch вызван 1 раз); поиск отбрасывает продукты без КБЖУ.
- [ ] RED → реализация → GREEN; коммит `feat(server): food photo recognition, barcode and search`.

### Task 4: Экран «Питание» по макету
**Files:** Create `src/ui/nutrition/NutritionScreen.tsx`, `nutrition.css`, `MealCard.tsx`, `Summary.tsx`; Modify `src/ui/App.tsx`
- Перед вёрсткой — вырезать фрагменты `.design/nutrition.webp` (шапка, сводка, плитки, приём раскрытый/свёрнутый, нижняя панель) и снять цвета/координаты, как для других экранов.
- Шапка: «Питание», «Сегодня ▾» (сегодня / вчера / выбор даты), «…» → редактор нормы.
- Сводка: кольцо ккал (дуга с SVG-свечением, «🔥 1 580 из 2 400 ккал»), три полосы БЖУ «x / y г»; плитки ккал/Б/Ж/У; приёмы (иконки: солнце, солнце, луна, чашка; сумма «ккал · Б · Ж · У»; жёлтый «+»; раскрытие); строки продуктов с миниатюрой (фото → `URL.createObjectURL`, OFF → `image`, иначе иконка) и «…» (изменить граммы, удалить).
- Нормы: `getTargets()` → иначе `autoTargets` из профиля и последнего веса (`inLb(metric(body.weight))`), если данных нет — карточка «Заполни профиль».
- [ ] Сборка, сверка в браузере 390 px с макетом; коммит `feat(nutrition): screen`.

### Task 5: Ввод по фото
**Files:** Create `src/nutrition/photo.ts` (+ `photo.test.ts`), `src/ui/nutrition/PhotoReview.tsx`
**Produces:** `resizeImage(file: Blob, max: number, quality: number): Promise<Blob>` (canvas); `recognizePhoto(image: Blob, hint: string): Promise<{ items: ReviewItem[]; dish: string } | { error: string }>`; `type ReviewItem = { name: string; grams: number; per100: Per100 }`.
- «+» у приёма → `<input type=file accept="image/*" capture="environment">` → лист: превью, поле подсказки, «Распознать» → экран проверки: строки с граммами (стрелки ±10, ввод), удалить, «+ продукт», итог через `scale`/`sumMacros`, «Сохранить в <приём>» → `addEntries(date, meal, items, thumbnail512)` + `upsertFood(source:'ai')`.
- Ошибка → текст, кнопки «Повторить» и «Добавить вручную»; фото остаётся до закрытия листа.
- [ ] Тест `recognizePhoto` с подменённым fetch: успех, 429/503/сеть → `{error}` с русским текстом. Коммит `feat(nutrition): photo input`.

### Task 6: Сканер, поиск, ручной ввод, история, норма
**Files:** Create `src/ui/nutrition/Scanner.tsx`, `SearchSheet.tsx`, `ManualSheet.tsx`, `HistorySheet.tsx`, `TargetsSheet.tsx`, `GramsSheet.tsx`; `npm i barcode-detector`
- Сканер: `import('barcode-detector/ponyfill')` по требованию; `getUserMedia({video:{facingMode:'environment'}})`; кадры каждые 300 мс; EAN-13/EAN-8/UPC-A/UPC-E; код → `/api/food/barcode/:code` → `GramsSheet` → `upsertFood(source:'off')` + `addEntries`; 404 → `ManualSheet` с barcode; камера запрещена → подсказка + «Ввести вручную».
- Поиск: недавние (`recentFoods`) + OFF `/api/food/search` с задержкой 400 мс → `GramsSheet`.
- Ручной ввод: название, граммы, КБЖУ на 100 г → `upsertFood(source:'manual')` + запись.
- История: `daysWithEntries()` → тап выбирает день.
- Норма: авто (с пояснением формулы) / свои цифры → `saveTargets`.
- [ ] Сборка, ручная проверка в браузере; коммит `feat(nutrition): scanner, search, manual, history, targets`.

### Task 7: Развёртывание и проверка
- [ ] Выложить сервер на VPS (как раньше), проверить `GET /api/food/barcode/<известный код>` и 503 без ключа на `/api/food/photo`.
- [ ] На VPS положить `/opt/artifex-fit-push/redeploy.sh` (build + `docker rm -f` + `docker run --env-file .env …`), т.к. `docker restart` не перечитывает `.env`.
- [ ] Дать пользователю команду для ключа: `ssh -t root@31.97.131.112 "cd /opt/artifex-fit-push && read -s -p 'OPENAI_API_KEY: ' K && echo && sed -i '/^OPENAI_/d' .env && printf 'OPENAI_API_KEY=%s
OPENAI_MODEL=gpt-6.1-sol
' \"\$K\" >> .env && ./redeploy.sh"` (ключ вводит сам, в чат не присылает).
- [ ] Финальное ревью ветки (свежий ревьюер), исправления, публикация, проверка на 390 px.
