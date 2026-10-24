// Экран «Питание» — 1:1 с макетом (941 px): шапка с датой, сводка, плитки, приёмы пищи, нижняя панель.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedBody, inLb, loadBody, metric, type BodyData } from '../../body/body';
import { db } from '../../db/db';
import { addEntries, deleteEntry, entriesOn, foodByBarcode, getTargets, setEntryGrams, upsertFood, type EntryRow } from '../../db/nutrition';
import { getProfile } from '../../db/repo';
import { autoTargets, dayKey, mealByTime, MEALS, sumMacros, type Meal, type Targets } from '../../nutrition/calc';
import { ageFrom, DEFAULT_PROFILE, type ProfileInfo } from '../../profile/profile';
import { ChevronIcon } from '../kit';
import { useNow } from '../useNow';
import { fetchBarcode } from '../../nutrition/foodApi';
import type { ReviewItem } from '../../nutrition/photo';
import { GramsSheet } from './GramsSheet';
import { HistorySheet } from './HistorySheet';
import { ManualSheet } from './ManualSheet';
import { MealCard } from './MealCard';
import { Scanner } from './Scanner';
import { SearchSheet } from './SearchSheet';
import type { FoodPick } from './Sheet';
import { TargetsSheet } from './TargetsSheet';
import { PhotoReview } from './PhotoReview';
import { Summary } from './Summary';
import { CalendarIcon, DotsIcon, HistoryIcon, PlusIcon, ScanIcon, SearchIcon } from './icons';
import './nutrition.css';

const DAY = 86_400_000;

/** Открытый лист. pick — продукт добавляется в экран проверки фото, а не сразу в дневник. */
type SheetState =
  | { kind: 'search'; meal: Meal; pick?: (it: ReviewItem) => void }
  | { kind: 'scan'; meal: Meal }
  | { kind: 'manual'; meal: Meal; barcode?: string; note?: string; pick?: (it: ReviewItem) => void }
  | { kind: 'grams'; food: FoodPick; meal: Meal; pick?: (it: ReviewItem) => void }
  | { kind: 'edit'; entry: EntryRow }
  | { kind: 'history' }
  | { kind: 'targets' };

/** Норма: сохранённая; иначе расчёт из профиля и последнего веса; без данных — null. */
export function resolveTargets(saved: Targets | null, profile: ProfileInfo, body: BodyData, now: number): Targets | null {
  if (saved) return saved;
  const weight = inLb(metric(body.weight, now));
  if (!weight || !profile.birthYear || !profile.heightCm) return null;
  return autoTargets({ weightLb: weight.value, heightCm: profile.heightCm, age: ageFrom(profile.birthYear, now), goal: profile.goal });
}

function dateLabel(key: string, now: number) {
  if (key === dayKey(new Date(now))) return 'Сегодня';
  if (key === dayKey(new Date(now - DAY))) return 'Вчера';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Миниатюры записей: фото из IndexedDB (object URL) или картинка продукта из Open Food Facts. */
function useThumbs(entries: EntryRow[]) {
  const photoIds = [...new Set(entries.flatMap((e) => (e.photoId !== undefined ? [e.photoId] : [])))];
  const foodIds = [...new Set(entries.flatMap((e) => (e.photoId === undefined && e.foodId !== undefined ? [e.foodId] : [])))];
  const photos = useLiveQuery(() => db.photos.bulkGet(photoIds), [photoIds.join()]);
  const foods = useLiveQuery(() => db.foods.bulkGet(foodIds), [foodIds.join()]);
  const [urls, setUrls] = useState<Map<number, string>>(() => new Map());
  useEffect(() => {
    const map = new Map((photos ?? []).flatMap((p) => (p?.id !== undefined ? [[p.id, URL.createObjectURL(p.blob)] as const] : [])));
    setUrls(map);
    return () => map.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);
  return useMemo(() => {
    const images = new Map((foods ?? []).flatMap((f) => (f?.id !== undefined && f.image ? [[f.id, f.image] as const] : [])));
    const map = new Map<number, string>();
    for (const e of entries) {
      const src = e.photoId !== undefined ? urls.get(e.photoId) : e.foodId !== undefined ? images.get(e.foodId) : undefined;
      if (e.id !== undefined && src) map.set(e.id, src);
    }
    return map;
  }, [entries, urls, foods]);
}

export function NutritionScreen() {
  // picked = null — «Сегодня»: день пересчитывается, когда приложение возвращается из фона (в т.ч. после полуночи).
  const now = useNow(60_000);
  const today = dayKey(new Date(now));
  const [picked, setPicked] = useState<string | null>(null);
  const key = picked ?? today;
  const setDay = (k: string) => setPicked(k === dayKey(new Date()) ? null : k);
  const entries = useLiveQuery(() => entriesOn(key), [key]);
  const saved = useLiveQuery(getTargets);
  const profile = useLiveQuery(getProfile) ?? DEFAULT_PROFILE;
  const [body, setBody] = useState<BodyData>(cachedBody);
  const [open, setOpen] = useState<Set<Meal>>(() => new Set([mealByTime(new Date())]));
  const [dateMenu, setDateMenu] = useState(false);
  const [itemMenu, setItemMenu] = useState<EntryRow | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [looking, setLooking] = useState(false);
  const [photo, setPhoto] = useState<{ file: Blob; meal: Meal } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const cameraMeal = useRef<Meal>('breakfast');
  useEffect(() => {
    void loadBody().then(setBody);
  }, []);

  const list = entries ?? [];
  const thumbs = useThumbs(list);
  const targets = saved === undefined ? null : resolveTargets(saved, profile, body, Date.now());
  const defaultMeal = mealByTime(new Date());

  /** Записать продукт в дневник выбранного дня (или отдать в экран проверки фото). */
  const commit = async (food: FoodPick, grams: number, meal: Meal, pick?: (it: ReviewItem) => void) => {
    if (pick) {
      pick({ name: food.name, grams, per100: food.per100 });
      return setSheet(null);
    }
    const { name, brand, barcode, image, per100, source } = food;
    const foodId = await upsertFood({ source, name, per100, ...(brand && { brand }), ...(barcode && { barcode }), ...(image && { image }) });
    await addEntries(key, meal, [{ name, grams, per100, foodId }]);
    setOpen((s) => new Set(s).add(meal));
    setSheet(null);
  };

  const lookup = async (code: string, meal: Meal) => {
    setLooking(true);
    const own = await foodByBarcode(code);
    if (own) {
      setLooking(false);
      const { name, brand, barcode, image, per100, source } = own;
      return setSheet({ kind: 'grams', food: { name, brand, barcode, image, per100, source }, meal });
    }
    const r = await fetchBarcode(code);
    setLooking(false);
    if ('food' in r) setSheet({ kind: 'grams', food: { ...r.food, source: 'off' }, meal });
    else setSheet({ kind: 'manual', meal, barcode: code, note: 'notFound' in r ? 'Этого продукта нет в базе Open Food Facts' : r.error });
  };
  const toggle = (m: Meal) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });

  return (
    <div className="nt">
      <header className="nt-head">
        <h1 className="nt-title">Питание</h1>
        <button className="nt-date" onClick={() => setDateMenu(true)}>
          <span className="nt-date-icon">
            <CalendarIcon />
          </span>
          <span className="nt-date-label">{dateLabel(key, now)}</span>
          <ChevronIcon dir="down" />
        </button>
        <button className="glass-btn nt-menu" aria-label="Дневная норма" onClick={() => setSheet({ kind: 'targets' })}>
          <DotsIcon />
        </button>
      </header>

      <Summary eaten={sumMacros(list)} targets={targets} />

      {saved !== undefined && !targets && (
        <div className="nt-card nt-fill">
          <b>Заполни профиль</b>
          <span>Год рождения, рост и вес из Zepp Life — по ним посчитаю дневную норму. Или задай её вручную через «…».</span>
        </div>
      )}

      {MEALS.map((m) => (
        <MealCard
          key={m}
          meal={m}
          entries={list.filter((e) => e.meal === m)}
          thumbs={thumbs}
          expanded={open.has(m)}
          onToggle={() => toggle(m)}
          onAdd={() => {
            // Выбор файла открывается прямо из нажатия — иначе iOS его не покажет. Без capture iOS предлагает и камеру, и медиатеку.
            cameraMeal.current = m;
            camera.current?.click();
          }}
          onItem={setItemMenu}
        />
      ))}

      <nav className="nt-card nt-actions">
        {[
          { icon: <SearchIcon />, label: 'Поиск продуктов', open: { kind: 'search', meal: defaultMeal } },
          { icon: <ScanIcon />, label: 'Сканировать', open: { kind: 'scan', meal: defaultMeal } },
          { icon: <PlusIcon />, label: 'Добавить вручную', open: { kind: 'manual', meal: defaultMeal } },
          { icon: <HistoryIcon />, label: 'История', open: { kind: 'history' } },
        ].map((a) => (
          <button key={a.label} className="nt-action" onClick={() => setSheet(a.open as SheetState)}>
            <span className="glass-btn nt-action-icon">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </nav>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) setPhoto({ file, meal: cameraMeal.current });
        }}
      />
      {photo && (
        <PhotoReview
          file={photo.file}
          date={key}
          meal={photo.meal}
          pickProduct={(add) => setSheet({ kind: 'search', meal: photo.meal, pick: add })}
          onManual={() => {
            setSheet({ kind: 'manual', meal: photo.meal });
            setPhoto(null);
          }}
          onClose={() => {
            setOpen((s) => new Set(s).add(photo.meal));
            setPhoto(null);
          }}
        />
      )}

      {dateMenu && (
        <div className="dialog-backdrop" onClick={() => setDateMenu(false)}>
          <div className="dialog card stack nt-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">День</h2>
            {[0, 1].map((back) => (
              <button
                key={back}
                className="btn block"
                onClick={() => {
                  setDay(dayKey(new Date(Date.now() - back * DAY)));
                  setDateMenu(false);
                }}
              >
                {back === 0 ? 'Сегодня' : 'Вчера'}
              </button>
            ))}
            <label className="btn block nt-pick">
              Выбрать дату
              <input
                type="date"
                max={dayKey(new Date())}
                value={key}
                onChange={(e) => {
                  const [y, mo, d] = e.target.value.split('-').map(Number);
                  if (y && mo && d) setDay(dayKey(new Date(y, mo - 1, d)));
                  setDateMenu(false);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {itemMenu && (
        <div className="dialog-backdrop" onClick={() => setItemMenu(null)}>
          <div className="dialog card stack nt-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">{itemMenu.name}</h2>
            <p className="muted nt-sheet-sub">
              {itemMenu.grams} г · {Math.round(itemMenu.kcal)} ккал
            </p>
            <button
              className="btn block"
              onClick={() => {
                setSheet({ kind: 'edit', entry: itemMenu });
                setItemMenu(null);
              }}
            >
              Изменить граммы
            </button>
            <button
              className="btn block nt-danger"
              onClick={async () => {
                if (itemMenu.id !== undefined) await deleteEntry(itemMenu.id);
                setItemMenu(null);
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      )}
      {sheet?.kind === 'search' && (
        <SearchSheet
          onPick={(food) => setSheet({ kind: 'grams', food, meal: sheet.meal, pick: sheet.pick })}
          onManual={() => setSheet({ kind: 'manual', meal: sheet.meal, pick: sheet.pick })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'grams' && (
        <GramsSheet food={sheet.food} meal={sheet.pick ? undefined : sheet.meal} onSave={(g, m) => commit(sheet.food, g, m, sheet.pick)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'manual' && (
        <ManualSheet
          barcode={sheet.barcode}
          note={sheet.note}
          meal={sheet.pick ? undefined : sheet.meal}
          onSave={(food, g, m) => commit(food, g, m, sheet.pick)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'scan' && !looking && <Scanner onCode={(code) => void lookup(code, sheet.meal)} onClose={() => setSheet(null)} />}
      {looking && <div className="dialog-backdrop nt-sheet-back nt-looking">Ищу продукт…</div>}
      {sheet?.kind === 'edit' && (
        <GramsSheet
          food={{ name: sheet.entry.name, per100: sheet.entry.per100, source: 'manual' }}
          grams={sheet.entry.grams}
          onSave={async (g) => {
            if (sheet.entry.id !== undefined) await setEntryGrams(sheet.entry.id, g);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'history' && (
        <HistorySheet
          onPick={(d) => {
            setDay(d);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'targets' && (
        <TargetsSheet auto={resolveTargets(null, profile, body, Date.now())} saved={saved ?? null} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
