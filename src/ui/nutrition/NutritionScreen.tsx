// Экран «Питание» — 1:1 с макетом (941 px): шапка с датой, сводка, плитки, приёмы пищи, нижняя панель.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedBody, inLb, loadBody, metric, type BodyData } from '../../body/body';
import { db } from '../../db/db';
import { deleteEntry, entriesOn, getTargets, type EntryRow } from '../../db/nutrition';
import { getProfile } from '../../db/repo';
import { autoTargets, dayKey, mealByTime, MEALS, sumMacros, type Meal, type Targets } from '../../nutrition/calc';
import { ageFrom, DEFAULT_PROFILE, type ProfileInfo } from '../../profile/profile';
import { ChevronIcon } from '../kit';
import { MealCard } from './MealCard';
import { PhotoReview } from './PhotoReview';
import { Summary } from './Summary';
import { CalendarIcon, DotsIcon, HistoryIcon, PlusIcon, ScanIcon, SearchIcon } from './icons';
import './nutrition.css';

const DAY = 86_400_000;

/** Норма: сохранённая; иначе расчёт из профиля и последнего веса; без данных — null. */
export function resolveTargets(saved: Targets | null, profile: ProfileInfo, body: BodyData, now: number): Targets | null {
  if (saved) return saved;
  const weight = inLb(metric(body.weight, now));
  if (!weight || !profile.birthYear || !profile.heightCm) return null;
  return autoTargets({ weightLb: weight.value, heightCm: profile.heightCm, age: ageFrom(profile.birthYear, now), goal: profile.goal });
}

function dateLabel(date: Date) {
  const key = dayKey(date);
  if (key === dayKey(new Date())) return 'Сегодня';
  if (key === dayKey(new Date(Date.now() - DAY))) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
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
  const [date, setDate] = useState(() => new Date());
  const key = dayKey(date);
  const entries = useLiveQuery(() => entriesOn(key), [key]);
  const saved = useLiveQuery(getTargets);
  const profile = useLiveQuery(getProfile) ?? DEFAULT_PROFILE;
  const [body, setBody] = useState<BodyData>(cachedBody);
  const [open, setOpen] = useState<Set<Meal>>(() => new Set([mealByTime(new Date())]));
  const [dateMenu, setDateMenu] = useState(false);
  const [itemMenu, setItemMenu] = useState<EntryRow | null>(null);
  const [photo, setPhoto] = useState<{ file: Blob; meal: Meal } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const cameraMeal = useRef<Meal>('breakfast');
  useEffect(() => {
    void loadBody().then(setBody);
  }, []);

  const list = entries ?? [];
  const thumbs = useThumbs(list);
  const targets = saved === undefined ? null : resolveTargets(saved, profile, body, Date.now());
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
          <span className="nt-date-label">{dateLabel(date)}</span>
          <ChevronIcon dir="down" />
        </button>
        <button className="glass-btn nt-menu" aria-label="Дневная норма">
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
            // Камера открывается прямо из нажатия — иначе iOS не покажет выбор снимка.
            cameraMeal.current = m;
            camera.current?.click();
          }}
          onItem={setItemMenu}
        />
      ))}

      <nav className="nt-card nt-actions">
        {[
          { icon: <SearchIcon />, label: 'Поиск продуктов' },
          { icon: <ScanIcon />, label: 'Сканировать' },
          { icon: <PlusIcon />, label: 'Добавить вручную' },
          { icon: <HistoryIcon />, label: 'История' },
        ].map((a) => (
          <button key={a.label} className="nt-action">
            <span className="glass-btn nt-action-icon">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </nav>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
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
                  setDate(new Date(Date.now() - back * DAY));
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
                  if (y && mo && d) setDate(new Date(y, mo - 1, d));
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
    </div>
  );
}
